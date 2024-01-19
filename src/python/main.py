from io import StringIO
import numpy as np
import numpy.typing as npt
import pandas as pd
import geopandas as gp
from pyodide.http import pyfetch
from pyodide.ffi import to_js
from async_lru import alru_cache
import asyncio
from shapely import wkt
from shapely.geometry import Point
import warnings
import shapely
from shapely.errors import ShapelyDeprecationWarning
from benchmark import timer, timeAll
from layers.line import LineLayer
from layers.utils import dropZ, inRange
from layers.point import PointLayer

warnings.filterwarnings("ignore")


class ImageSource:
    def __init__(self, image: npt.NDArray):
        self._image = image

    def data(self):
        return to_js(self._image)

    def extent(self):
        return (self._image.min(), self._image.max())

    def bins(self, bin_count=256):
        counts, bounds = np.histogram(self._image, bin_count)
        return [to_js(((bounds[i] + bounds[i + 1]) / 2, int(counts[i]))) for i in range(0, len(counts))]


class PixelSource:
    def __init__(self, src_path: str, line_segments: gp.GeoDataFrame, points: gp.GeoDataFrame):
        self._src_path = src_path
        self._line_segments = line_segments
        self._points = points
        self.pendingAnchor = None

    @alru_cache(maxsize=140)
    async def fetch_img(self, time, channel, slice):
        response = await pyfetch(self.path_for_img(time, channel, slice))
        image = await response.memoryview()
        image = np.frombuffer(image, np.uint16)
        return image

    def path_for_img(self, time, channel, slice):
        return self._src_path + "t" + str(time) + "/ch" + str(channel) + "/z" + str(slice) + ".br"

    async def slices(self, time, channel, slices_start, slices_end):
        sls = await self.fetch_slices(time, channel, slices_start, slices_end)
        return ImageSource(sls)

    @alru_cache(maxsize=10)
    async def fetch_slices(self, time, channel, slices_start, slices_end):
        pending = [self.fetch_img(time, channel, i)
                   for i in range(slices_start, slices_end)]
        if len(pending) == 1:
            return await pending[0]

        sls = await asyncio.gather(*pending)

        return np.max(sls, axis=0)

    @timer
    def get_spines(self, options):
        zRange = options['selection']['z']
        selections = options['annotationSelections']
        selectedSpine = selections["spineID"]
        editingSegmentId = selections["segmentID"]
        editing = editingSegmentId is not None
        # index_filter = options["filters"]

        layers = []
        if editing:
            visible_mask = self._points["segmentID"] == editingSegmentId
            not_faded = self._points[visible_mask]["z"].between(
                zRange[0], zRange[1])
        else:
            visible_mask = self._points["z"].between(zRange[0], zRange[1])
            not_faded = None

        points = self._points[visible_mask]

        if len(points) == 0:
            return layers

        if not_faded is None:
            layers.extend(appendPointLayers(options, points))
        else:
            layers.extend(appendPointLayers(
                options, points[not_faded], True))
            for layer in appendPointLayers(options, points[~not_faded], True):
                layers.append(layer.opacity(255*0.5).copy(id="ghost"))

        if selectedSpine is not None:
            self.appendRois(self._points.loc[[selectedSpine]], editing, layers)

        # points_frame = visible_points.to_frame(name="geometry")

        # # render anchors and anchor lines
        # if options["showAnchors"]:
        #     anchors_frame = self.get_anchors(visible_mask, editing)
        #     frames.append(anchors_frame)
        #     frames.append(self.get_anchor_lines(points_frame, anchors_frame))

        # # set point attributes
        # points_frame.properties = {
        #     "selectOn": "spineID",
        #     "editId": "spine"
        # }

        # if editing:
        #     points_frame.properties["edit"] = ["translate", "add", "remove"]
        # else:
        #     points_frame["note"] = "this is a note"

        # selected = get_selected(points_frame, "spineID", selections)

        # points_frame["radius"] = 2

        # # render labels
        # if options["showLabels"]:
        #     frames.append(self.add_labels(visible_points, points_frame))

        # points_frame["fill"] = selection_color(
        #     points_frame, "spineID", selections, [0, 255, 0], [255, 0, 0], selected)
        # frames.append(points_frame)

        # # filter elements
        # filtered_mask = filter_mask(visible_points.index, index_filter)
        # for frame in frames:
        #     if faded_mask is not None:
        #         frame.loc[faded_mask, "opacity"] = 255 * 0.5
        #     else:
        #         frame.loc[filtered_mask, "opacity"] = 255 / 3

        return layers

    @timer
    def appendRois(self, spineDf: gp.GeoDataFrame, editing, layers, **kwargs):
        boarderWidth = 0.5
        outline = 4 / boarderWidth
        headLayer = (PointLayer(spineDf["point"])
                     .id("roi-head")
                     .toLine(spineDf["anchor"])
                     .extend(4)
                     .outline(outline)
                     .strokeWidth(boarderWidth)
                     .stroke([255, 255, 0]))

        segments = spineDf.join(self._line_segments, on="segmentID")
        baseLayer = (LineLayer.subLine(segments, 8, "segment", "anchor")
                     .id("roi-base")
                    #  .simplify(0.8)
                     .outline(outline)
                     .strokeWidth(boarderWidth)
                     .stroke([255, 100, 0]))

        offset = spineDf[["xBackgroundOffset", "yBackgroundOffset"]]
        backgroundRoiHead = (headLayer
                             .copy(id="background")
                             .translate(offset)
                             .stroke([255, 255, 255]))

        backgroundRoiBase = (baseLayer
                             .copy(id="background")
                             .translate(offset)
                             .stroke([255, 100, 255]))
        if editing:
            # Add interaction targets
            layers.append(backgroundRoiHead.copy(id="translate")
                          .outline(None)
                          .strokeWidth(4)
                          .stroke([0, 0, 0, 0])
                          .fixed()
                          .onTranslate("backgroundRoi"))
            layers.append(backgroundRoiBase.copy(id="translate")
                          .outline(None)
                          .strokeWidth(4)
                          .stroke([0, 0, 0, 0])
                          .fixed()
                          .onTranslate("backgroundRoi"))

            backgroundRoiHead = backgroundRoiHead.onTranslate("backgroundRoi")
            backgroundRoiBase = backgroundRoiBase.onTranslate("backgroundRoi")

        layers.append(backgroundRoiHead)
        layers.append(backgroundRoiBase)
        layers.append(headLayer)
        layers.append(baseLayer)

    # @timer
    # def get_rios(self, spine_df, editing, **kwargs):
    #     frames = []
    #     if spine_df.shape[0] == 0:
    #         return frames

    #     roi_lines = spine_df.apply(
    #         lambda x: self.get_roi_for_point(x, **kwargs), axis=1)

    #     rows = roi_lines.shape[0]
    #     foreground_colors = np_tuple_array([0, 0, 255], rows)
    #     background_colors = np_tuple_array([0, 255, 255], rows)

    #     for key in ["roi", "roi_segment"]:
    #         polys = roi_lines[key]
    #         frame = polys.to_frame(name="geometry")
    #         frame["stroke"] = foreground_colors
    #         frames.append(frame)

    #     # background roi
    #     for key in ["background_roi", "background_roi_segment"]:
    #         polys = roi_lines[key]
    #         frame = polys.to_frame(name="geometry")
    #         frame["stroke"] = background_colors
    #         frames.append(frame)

    #     if editing:
    #         for frame in frames:
    #             frame["opacity"] = 255 * 0.4

    #         # Background roi bound
    #         backgroundBounds = roi_lines["background_roi"].union(
    #             roi_lines["background_roi_segment"]).envelope
    #         frame = backgroundBounds.to_frame(name="geometry")
    #         frame.properties = {
    #             "edit": ["translate"],
    #             "editId": "backgroundRoi"
    #         }
    #         frame["fill"] = np_tuple_array([0, 255, 0, 40], rows)
    #         frame["stroke"] = np_tuple_array([0, 255, 0], rows)
    #         frames.append(frame)

    #     return frames

    # @timer
    # def get_roi_for_point(self, x, **kwargs):
    #     segment_line = self._line_segments.loc[x["segmentID"], "segment"]
    #     roi = roi_for_point(segment_line, x["anchor"], x["point"], **kwargs)
    #     roi = roi.apply(drop_z)

    #     x_b_delta = x["xBackgroundOffset"]
    #     y_b_delta = x["yBackgroundOffset"]
    #     def transform(shape): return shapely.affinity.translate(
    #         shape, x_b_delta, y_b_delta)

    #     roi["background_roi"] = transform(roi["roi"])
    #     roi["background_roi_segment"] = transform(roi["roi_segment"])
    #     return roi

    # @timer
    # def get_anchor_lines(self, points_frame, anchors_frame):
    #     anchor_lines_frame = anchors_frame.copy()
    #     anchor_lines_frame["dest"] = points_frame["geometry"]
    #     anchor_lines_frame["geometry"] = anchor_lines_frame.apply(
    #         lambda x:  LineString([x["geometry"], x["dest"]]), axis=1)
    #     anchor_lines_frame.drop("dest", axis=1, inplace=True)
    #     return anchor_lines_frame

    # @timer
    # def add_labels(self, visible_points, points_frame):
    #     points_frame = points_frame.copy()
    #     points_frame["text"] = visible_points.index
    #     points_frame["textColor"] = points_frame["text"].apply(lambda _x: [
    #         255, 255, 255])

    #     points_frame["anchor"] = self._points.loc[points_frame.index,
    #                                               "anchor"].apply(drop_z)
    #     points_frame["textOffset"] = points_frame.apply(
    #         lambda x: text_offset(x["anchor"], x["geometry"]), axis=1)
    #     points_frame.drop("anchor", axis=1, inplace=True)
    #     return points_frame

    # @timer
    # def get_anchors(self, visible_mask, editing):
    #     anchors_frame = gp.GeoDataFrame(
    #         self._points[visible_mask]["anchor"], geometry="anchor")
    #     anchors_frame.rename_geometry("geometry", inplace=True)
    #     anchors_frame["geometry"] = anchors_frame["geometry"].apply(drop_z)
    #     anchors_frame["stroke"] = np_tuple_array(
    #         [0, 0, 255], anchors_frame.shape[0])
    #     anchors_frame["radius"] = 0.5

    #     if editing:
    #         anchors_frame.properties = {
    #             "edit": ["translate"],
    #             "editId": "anchor"
    #         }
    #         anchors_frame["fill"] = np_tuple_array(
    #             [0, 0, 255, 40], anchors_frame.shape[0])

    #     return anchors_frame

    @timer
    def getSegments(self, zRange: (int, int), editSegId: str, showLineSegmentsRadius: bool, radius=4):
        layers = []

        segment = (LineLayer(self._line_segments["segment"])
                   .id("segment")
                   .clipZ(zRange)
                   .on("edit", "segmentID")
                   .stroke([255, 0, 0])
                   .stroke([0, 255, 0], on="edit"))

        boarderWidth = 0.5
        offset = radius / boarderWidth

        # Render the ghost of the edit
        if editSegId is not None:
            self.segmentGhost(editSegId, showLineSegmentsRadius,
                              layers, segment, boarderWidth, offset)

        if showLineSegmentsRadius:
            # Left line
            left = (segment.copy(id="left")
                    .strokeWidth(boarderWidth)
                    .offset(-offset))
            layers.append(left)

            # Right line
            right = (segment.copy(id="right")
                     .strokeWidth(boarderWidth)
                     .offset(offset))
            layers.append(right)

        if editSegId is None:
            # Make the click target larger
            layers.append(segment.copy(id="interaction")
                          .strokeWidth(radius)
                          .stroke([0, 0, 0, 0])
                          .fixed())

        # Add the line segment
        layers.append(segment
                      .strokeWidth(2)
                      .strokeWidth(4, on="edit"))

        return layers

    def segmentGhost(self, segId, showLineSegmentsRadius, layers, segment, boarderWidth, offset):
        segmentSeries = self._line_segments.loc[[segId], "segment"]
        segmentSeries = segmentSeries.apply(dropZ)
        ghost = segment.copy(segmentSeries, id="ghost").opacity(255 * 0.5)

        if showLineSegmentsRadius:
            # Ghost Left line
            layers.append(ghost.copy(id="left-ghost")
                          .strokeWidth(boarderWidth)
                          .offset(-offset))

            # Ghost Right line
            layers.append(ghost.copy(id="right-ghost")
                          .strokeWidth(boarderWidth)
                          .offset(offset))

            # Add the ghost
        layers.append(ghost)

    @timer
    def getAnnotations(self, options):
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore", category=ShapelyDeprecationWarning)
            layers = []

            zRange = options["selection"]["z"]
            zRange = (zRange[0], zRange[1])
            if options["showLineSegments"]:
                layers.extend(self.getSegments(
                    zRange, options["annotationSelections"]["segmentID"], options["showLineSegmentsRadius"]))

            if options["showSpines"]:
                layers.extend(self.get_spines(options))

            return layers

    # JS entry points
    @timeAll
    def getAnnotationsGeoJson(self, options):
        options = options.to_py()
        layers = self.getAnnotations(options)
        return [layer.encodeBin() for layer in layers]

    def getSpinePosition(self, options):
        options = options.to_py()
        t = options["t"]
        spineID = options["spineID"]
        return to_js(list(self._points.loc[spineID, "point"].coords)[0])

    def getSegmentsAndSpines(self, options):
        options = options.to_py()
        z_range = options['selection']['z']
        index_filter = options["filters"]
        segments = []

        for (segmentID, points) in self._points.groupby("segmentID"):
            spines = points.index.to_frame(name="id")
            spines["type"] = "Start"
            spines["invisible"] = ~ inRange(points["point"].z, z_range)
            spines["invisible"] = spines["invisible"] & ~ filter_mask(
                points.index, index_filter)

            segments.append({
                "segmentID": segmentID,
                "spines": spines.to_dict('records')
            })

        return segments

    def deleteSpine(self, spineID):
        self._points.drop(spineID, inplace=True)

    def nearestAnchor(self, segmentID: str, point: Point, brightestPath=False):
        segment = self._line_segments.loc[segmentID, "segment"]
        anchor = segment.interpolate(segment.project(point))
        anchor = roundPoint(anchor, 1)

        # TODO: find brightest path

        return anchor

    def addSpine(self, segmentID, x, y, z) -> str :
        point = Point(x, y, z)
        anchor = self.nearestAnchor(segmentID, point, True)
        spine_id = newUnassignedId(self._points.index)

        self._points.loc[spine_id, "segmentID"] = segmentID
        self._points.loc[spine_id, "point"] = Point(point.x, point.y)
        self._points.loc[spine_id, "anchor"] = Point(anchor.x, anchor.y)
        self._points.loc[spine_id, "z"] = anchor.z
        self._points.loc[spine_id, "xBackgroundOffset"] = 0
        self._points.loc[spine_id, "yBackgroundOffset"] = 0
        
        return spine_id;

    def translate(self, translateId, id, x, y, finished):
        point = self._points.loc[id]
        
        if translateId == "spine":
            point["point"] = shapely.affinity.translate(point["point"], x, y)
        elif translateId == "anchor":
            if self.pendingAnchor is None:
                self.pendingAnchor = point["anchor"]

            self.pendingAnchor = shapely.affinity.translate(
                self.pendingAnchor, x, y)

            # snap to the nearest point
            anchor = self.nearestAnchor(point["segmentID"], self.pendingAnchor)
            point["z"] = anchor.z
            point["anchor"] = Point(anchor.x, anchor.y)

            if finished:
                self.pendingAnchor = None
            # todo: lock to segment
        elif translateId == "backgroundRoi":
            point["xBackgroundOffset"] += x
            point["yBackgroundOffset"] += y

        self._points.loc[id] = point
        return True


def appendPointLayers(options, points, editing=False):
    layers = []
    spines = (PointLayer(points["point"])
              .id("spine")
              .on("select", "spineID")
              .fill([255, 0, 0])
              .fill([0, 255, 0], on="select"))

    anchorLines = None
    if options["showAnchors"] or options["showLabels"]:
        anchorLines = (spines
                       .copy(id="anchorLine")
                       .toLine(points["anchor"])
                       .stroke([0, 0, 255]))

        if options["showAnchors"]:
            layers.append(anchorLines)
            if editing:
                layers.append(PointLayer(points["anchor"])
                              .id("anchor")
                              .onTranslate("anchor")
                              .fill([0, 0, 255])
                              .radius(5))

    if editing:
        layers.append(spines.onTranslate("spine").radius(5))
    else:
        layers.append(spines.radius(2))

    # render labels
    if options["showLabels"]:
        layers.append(anchorLines
                      .copy(id="label")
                      .extend(6)
                      .tail()
                      .label()
                      .fill([255, 255, 255]))

    return layers


def newUnassignedId(indexes: pd.Index):
    prefix = "unassigned"
    uid = prefix
    index = 1

    while uid in indexes:
        index += 1
        uid = prefix + "_" + str(index)

    return uid


# @timer
# def leftRightBounds(geo_frame, radius=4):
#     geo_frame["strokeWidth"] = 0.25
#     left = geo_frame.copy()
#     left.properties = {
#         "offset": radius * 4
#     }
#     geo_frame.properties = {
#         "offset": -radius * 4
#     }
#     return [geo_frame, left]


# @timer
# def parallel_offset(line, direction="right", radius=4):
#     if isinstance(line, MultiLineString):
#         segments = []
#         for l in line.geoms:
#             l = parallel_offset(l, direction, radius)
#             if l is not None and len(l.coords) != 0:
#                 segments.append(l)
#         if len(segments) == 0:
#             return None
#         return MultiLineString(segments)

#     if isinstance(line, LineString):
#         # TODO: USE CURVE OFFSET
#         return line.parallel_offset(radius, direction)

#     return None


# @timer
# def text_offset(fromPoint, toPoint, length=20):
#     return (0, np.sign(toPoint.y - fromPoint.y) * length)


# @timer
# def np_tuple_array(value, size):
#     ar = np.empty(size, object)
#     ar.fill(value)
#     return ar


@timer
def roundPoint(point: Point, ndig=0):
    return Point(round(point.x, ndig), round(point.y, ndig), round(point.z, ndig))


@timer
def filter_mask(d, index_filter):
    if index_filter == None or len(index_filter) == 0:
        return np.full(len(d), False)
    return ~d.isin(index_filter)


# @timer
# def get_selected(df: pd.DataFrame, selection_id: str, selected_ids: [str, str]):
#     if df.index.name == selection_id:
#         return df.index == selected_ids[selection_id]

#     return df[selection_id] == selected_ids[selection_id]


# @timer
# def selection_color(df: pd.DataFrame, selection_id: str, selected_ids: [str, str], selected_color: [int, int, int], unselected_color: [int, int, int], selected=None):
#     rows = df.shape[0]

#     n_selected_cs = np_tuple_array(unselected_color, rows)

#     if not selection_id in selected_ids:
#         return n_selected_cs

#     if selected is None:
#         selected = get_selected(df, selection_id, selected_ids)

#     selected_cs = np_tuple_array(selected_color, rows)
#     return np.where(selected, selected_cs, n_selected_cs)


# def drop_z_point(x, y, z=None):
#     return (x, y)


# def drop_z(shape):
#     return shapely.ops.transform(drop_z_point, shape)


# def in_range(x, range):
#     return np.invert((range[0] > x) | (range[1] < x))


# def push_line(segment, lines):
#     segment = list(dict.fromkeys(segment))
#     if len(segment) <= 1:
#         return
#     lines.append(segment)


# def clip_line(line, z_range: (int, int)):
#     lines = []
#     segment = []

#     for (x, y, z) in line.coords:
#         if in_range(z, z_range):
#             segment.append((x, y))
#         elif len(segment) != 0:
#             push_line(segment, lines)
#             segment = []

#     if len(segment) != 0:
#         push_line(segment, lines)

#     if len(lines) == 0:
#         return None

#     return MultiLineString(lines)

# Rois


# @timer
# def extend_head(x, origin, head_extend=-0.5):
#     # grow by scaler from one direction
#     return shapely.affinity.scale(x, xfact=head_extend, yfact=head_extend, origin=origin)


# @timer
# def scale_length(line, scale, origin=None):
#     if scale == 0:
#         return line
#     scale = 1 + (scale / line.length)
#     return shapely.affinity.scale(line, xfact=scale, yfact=scale, origin=origin)


# @timer
# def line_from_points(base, head, base_extend=0, head_extend=0):
#     line = LineString([base, head])
#     line = scale_length(line, head_extend, origin=base)
#     return scale_length(line, base_extend, origin=head)


# @timer
# def poly_with_point(polygons, point):
#     if isinstance(polygons, Polygon):
#         return polygons
#     return next((poly for poly in polygons.geoms if poly.contains(point)), None)


# @timer
# def roi_for_point(segment_line, anchor, point, extrude_base=4, extrude_top=6, spine_radius=4, segment_length=10, segment_radius=4):
#     roi_segment_line = get_roi_line_segment(
#         segment_line, anchor, segment_length, segment_radius)
#     roi_head_line = get_rio_head(
#         anchor, point, extrude_base, extrude_top, spine_radius, roi_segment_line)
#     return gp.GeoSeries([roi_segment_line, roi_head_line], index=["roi_segment", "roi"])


# @timer
# def get_rio_head(anchor, point, extrude_base, extrude_top, spine_radius, roi_segment_line):
#     roi_head_line = line_from_points(
#         anchor, point, extrude_base, extrude_top)
#     roi_head_line = roi_head_line.buffer(spine_radius, cap_style=2)
#     roi_head_line = roi_head_line.difference(roi_segment_line)
#     roi_head_line = poly_with_point(roi_head_line, point)
#     return roi_head_line


# @timer
# def get_roi_line_segment(segment_line, anchor, segment_length, segment_radius):
#     roi_segment_line = sub_line(segment_line, anchor, segment_length)
#     roi_segment_line = roi_segment_line.buffer(segment_radius, cap_style=2)
#     return roi_segment_line

# # src: https://shapely.readthedocs.io/en/stable/manual.html#linear-referencing-methods


# # todo: use substring
# def cut(line, distance):
#     # Cuts a line in two at a distance from its starting point
#     if distance <= 0.0 or distance >= line.length:
#         return [LineString(line), LineString()]
#     coords = list(line.coords)
#     for i, p in enumerate(coords):
#         pd = line.project(Point(p))
#         if pd == distance:
#             return [
#                 LineString(coords[:i+1]),
#                 LineString(coords[i:])]
#         if pd > distance:
#             cp = line.interpolate(distance)
#             return [
#                 LineString(coords[:i] + [(cp.x, cp.y, cp.z)]),
#                 LineString([(cp.x, cp.y, cp.z)] + coords[i:])]


# def sub_line(line, point, length=10):
#     _, segment = cut(line, line.project(point) - length)
#     segment, _ = cut(segment, segment.project(point) + length)
#     return segment


# def to_json_with_props(gdf, properties=None):
#     geo = gdf._to_geo(na="null", show_bbox=False, drop_id=False)
#     if properties is None:
#         try:
#             properties = gdf.properties
#         except:
#             properties = {}
#     if len(properties) > 0:
#         geo['properties'] = properties

#     return json.dumps(geo)

# CSV


async def load_csv(path, *, index_col=None, dtype=None):
    response = await pyfetch(path)
    csv_text = await response.text()
    csv_text_io = StringIO(csv_text)
    return pd.read_csv(csv_text_io, index_col=index_col, dtype=dtype)


async def load_geo_csv(path, geometry, *, index_col=None, dtype=None):
    lines = await load_csv(path, index_col=index_col, dtype=dtype)
    for g in geometry:
        lines[g] = lines[g].apply(wkt.loads)
    return gp.GeoDataFrame(lines, geometry=geometry[0])


async def newPixelSource(src_path):
    line_segments = await load_geo_csv(src_path + "/line_segments.csv", ['segment'], index_col="segmentID", dtype={'segmentID': str})
    points = await load_geo_csv(src_path + "/points.csv", ['point', 'anchor'], index_col="spineID", dtype={'spineID': str, 'segmentID': str})
    return PixelSource(src_path, line_segments, points)
