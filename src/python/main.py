from io import StringIO
import json
import numpy as np
import numpy.typing as npt
import pandas as pd
import geopandas as gp
from pyodide.http import pyfetch
from pyodide.ffi import to_js
from async_lru import alru_cache
import asyncio
from shapely import wkt
from shapely.ops import nearest_points
from shapely.geometry import LineString, Point, MultiLineString, Polygon
import warnings
import shapely
from shapely.errors import ShapelyDeprecationWarning

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

    def get_spines(self, options):
        z_range = options['selection']['z']
        selections = options['annotationSelections']
        index_filter = options["filters"]

        frames = []

        faded_mask = None
        # find visible points
        visible_mask = in_range(self._points["point"].z, z_range)

        visible_points = self._points[visible_mask]["point"].apply(drop_z)
        visible_points = visible_points.dropna()

        # Opt: dont compute anything if empty
        if visible_points.shape[0] == 0:
            return frames

        points_frame = visible_points.to_frame(name="geometry")

        # render anchors and anchor lines
        if options["showAnchors"]:
            anchors_frame = self.get_anchors(visible_mask)
            frames.append(anchors_frame)
            frames.append(self.get_anchor_lines(points_frame, anchors_frame))

        # set point attributes
        points_frame.properties = {
            "selectOn": "spineID",
            "editId": "spine"
        }

      
        points_frame["note"] = "this is a note"

        selected = get_selected(points_frame, "spineID", selections)

        points_frame["radius"] = 2

        # render labels
        if options["showLabels"]:
            frames.append(self.add_labels(visible_points, points_frame))

        points_frame["fill"] = selection_color(
            points_frame, "spineID", selections, [0, 255, 0], [255, 0, 0], selected)
        frames.append(points_frame)

        # filter elements
        filtered_mask = filter_mask(visible_points.index, index_filter)
        for frame in frames:
            if faded_mask is not None:
                frame.loc[faded_mask, "opacity"] = 255 * 0.5
            else:
                frame.loc[filtered_mask, "opacity"] = 255 / 3

        roiFrames = self.get_rios(
            self._points[visible_mask][selected])

        frames.extend(roiFrames)

        return frames

    def get_rios(self, spine_df, **kwargs):
        frames = []
        if spine_df.shape[0] == 0:
            return frames

        roi_lines = spine_df.apply(
            lambda x: self.get_roi_for_point(x, **kwargs), axis=1)

        rows = roi_lines.shape[0]
        foreground_colors = np_tuple_array([0, 0, 255], rows)
        background_colors = np_tuple_array([0, 255, 255], rows)

        for key in ["roi", "roi_segment"]:
            polys = roi_lines[key]
            frame = polys.to_frame(name="geometry")
            frame["stroke"] = foreground_colors
            frames.append(frame)

        # background roi
        for key in ["background_roi", "background_roi_segment"]:
            polys = roi_lines[key]
            frame = polys.to_frame(name="geometry")
            frame["stroke"] = background_colors
            frames.append(frame)

        return frames

    def get_roi_for_point(self, x, **kwargs):
        segment_line = self._line_segments.loc[x["segmentID"], "segment"]
        roi = roi_for_point(segment_line, x["anchor"], x["point"], **kwargs)
        roi = roi.apply(drop_z)

        x_b_delta = x["xBackgroundOffset"]
        y_b_delta = x["yBackgroundOffset"]
        def transform(shape): return shapely.affinity.translate(
            shape, x_b_delta, y_b_delta)

        roi["background_roi"] = transform(roi["roi"])
        roi["background_roi_segment"] = transform(roi["roi_segment"])
        return roi

    def get_anchor_lines(self, points_frame, anchors_frame):
        anchor_lines_frame = anchors_frame.copy()
        anchor_lines_frame["dest"] = points_frame["geometry"]
        anchor_lines_frame["geometry"] = anchor_lines_frame.apply(
            lambda x:  LineString([x["geometry"], x["dest"]]), axis=1)
        anchor_lines_frame.drop("dest", axis=1, inplace=True)
        return anchor_lines_frame

    def add_labels(self, visible_points, points_frame):
        points_frame = points_frame.copy()
        points_frame["text"] = visible_points.index
        points_frame["textColor"] = points_frame["text"].apply(lambda _x: [
            255, 255, 255])

        points_frame["anchor"] = self._points.loc[points_frame.index,
                                                  "anchor"].apply(drop_z)
        points_frame["textOffset"] = points_frame.apply(
            lambda x: text_offset(x["anchor"], x["geometry"]), axis=1)
        points_frame.drop("anchor", axis=1, inplace=True)
        return points_frame

    def get_anchors(self, visible_mask):
        anchors_frame = gp.GeoDataFrame(
            self._points[visible_mask]["anchor"], geometry="anchor")
        anchors_frame.rename_geometry("geometry", inplace=True)
        anchors_frame["geometry"] = anchors_frame["geometry"].apply(drop_z)
        anchors_frame["stroke"] = np_tuple_array(
            [0, 0, 255], anchors_frame.shape[0])
        anchors_frame["radius"] = 0.5

        return anchors_frame

    def get_segments(self, options):
        z_range = options['selection']['z']
        selections = options['annotationSelections']

        # clip the lines
        visible_segments = self._line_segments["segment"]
        visible_segments = visible_segments.apply(clip_line, z_range=z_range)
        visible_segments = visible_segments.dropna()

        # set segment attributes
        segments_frame = visible_segments.to_frame(name="geometry")
        segments_frame.properties = {
            "editOn": "segmentID"
        }
        segments_frame["stroke"] = selection_color(
            segments_frame, "segmentID", selections, [0, 255, 0], [255, 0, 0])

        frames = []

        if options["showLineSegmentsRadius"]:
            frames.extend(leftRightBounds(segments_frame.copy()))

        segments_frame["strokeWidth"] = 3
        frames.append(segments_frame)

        return frames

    def getAnnotations(self, options):
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore", category=ShapelyDeprecationWarning)
            frames = []

            if options["showLineSegments"]:
                frames.extend(self.get_segments(options))

            if options["showSpines"]:
                frames.extend(self.get_spines(options))

            for frame in frames:
                frame.reset_index(inplace=True)

            return frames

    # JS entry points
    def getAnnotationsGeoJson(self, options):
        options = options.to_py()
        frames = self.getAnnotations(options)
        return to_js([to_json_with_props(frame) for frame in frames])

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
            spines["invisible"] = ~ in_range(points["point"].z, z_range)
            spines["invisible"] = spines["invisible"] & ~ filter_mask(
                points.index, index_filter)

            segments.append({
                "segmentID": segmentID,
                "spines": spines.to_dict('records')
            })

        return segments


def leftRightBounds(geo_frame):
    left = geo_frame.copy()
    left["geometry"] = left["geometry"].apply(
        parallel_offset, direction="left")
    geo_frame["geometry"] = geo_frame["geometry"].apply(parallel_offset)
    return [geo_frame, left]


def parallel_offset(line, direction="right", radius=4):
    if isinstance(line, MultiLineString):
        segments = []
        for l in line.geoms:
            l = parallel_offset(l, direction, radius)
            if l is not None and len(l.coords) != 0:
                segments.append(l);
        if len(segments) == 0:
            return None;
        return MultiLineString(segments)

    if isinstance(line, LineString):
        return line.parallel_offset(radius, direction)

    return None;


def text_offset(fromPoint, toPoint, length=20):
    return (0, np.sign(toPoint.y - fromPoint.y) * length)


def np_tuple_array(value, size):
    ar = np.empty(size, object)
    ar.fill(value)
    return ar


def filter_mask(d, index_filter):
    if index_filter == None or len(index_filter) == 0:
        return np.full(len(d), False)
    return ~d.isin(index_filter)


def get_selected(df: pd.DataFrame, selection_id: str, selected_ids: [str, str]):
    if df.index.name == selection_id:
        return df.index == selected_ids[selection_id]

    return df[selection_id] == selected_ids[selection_id]


def selection_color(df: pd.DataFrame, selection_id: str, selected_ids: [str, str], selected_color: [int, int, int], unselected_color: [int, int, int], selected=None):
    rows = df.shape[0]

    n_selected_cs = np_tuple_array(unselected_color, rows)

    if not selection_id in selected_ids:
        return n_selected_cs

    if selected is None:
        selected = get_selected(df, selection_id, selected_ids)

    selected_cs = np_tuple_array(selected_color, rows)
    return np.where(selected, selected_cs, n_selected_cs)


def drop_z_point(x, y, z=None):
    return (x, y)


def drop_z(shape):
    return shapely.ops.transform(drop_z_point, shape)


def in_range(x, range):
    return np.invert((range[0] > x) | (range[1] < x))


def push_line(segment, lines):
    segment = list(dict.fromkeys(segment))
    if len(segment) <= 1:
        return
    lines.append(segment)


def clip_line(line, z_range: (int, int)):
    lines = []
    segment = []

    for (x, y, z) in line.coords:
        if in_range(z, z_range):
            segment.append((x, y))
        elif len(segment) != 0:
            push_line(segment, lines)
            segment = []

    if len(segment) != 0:
        push_line(segment, lines)

    if len(lines) == 0:
        return None

    return MultiLineString(lines)

# Rois


def extend_head(x, origin, head_extend=-0.5):
    # grow by scaler from one direction
    return shapely.affinity.scale(x, xfact=head_extend, yfact=head_extend, origin=origin)


def scale_length(line, scale, origin=None):
    if scale == 0:
        return line
    scale = 1 + (scale / line.length)
    return shapely.affinity.scale(line, xfact=scale, yfact=scale, origin=origin)


def line_from_points(base, head, base_extend=0, head_extend=0):
    line = LineString([base, head])
    line = scale_length(line, head_extend, origin=base)
    return scale_length(line, base_extend, origin=head)


def poly_with_point(polygons, point):
    if isinstance(polygons, Polygon):
        return polygons
    return next((poly for poly in polygons.geoms if poly.contains(point)), None)


def roi_for_point(segment_line, anchor, point, extrude_base=4, extrude_top=6, spine_radius=4, segment_length=10, segment_radius=4):
    roi_segment_line = sub_line(segment_line, anchor, segment_length)
    roi_segment_line = roi_segment_line.buffer(segment_radius, cap_style=2)

    roi_head_line = line_from_points(
        anchor, point, extrude_base, extrude_top)
    roi_head_line = roi_head_line.buffer(spine_radius, cap_style=2)
    roi_head_line = roi_head_line.difference(roi_segment_line)
    roi_head_line = poly_with_point(roi_head_line, point)

    return gp.GeoSeries([roi_segment_line, roi_head_line], index=["roi_segment", "roi"])

# src: https://shapely.readthedocs.io/en/stable/manual.html#linear-referencing-methods


def cut(line, distance):
    # Cuts a line in two at a distance from its starting point
    if distance <= 0.0 or distance >= line.length:
        return [LineString(line), LineString()]
    coords = list(line.coords)
    for i, p in enumerate(coords):
        pd = line.project(Point(p))
        if pd == distance:
            return [
                LineString(coords[:i+1]),
                LineString(coords[i:])]
        if pd > distance:
            cp = line.interpolate(distance)
            return [
                LineString(coords[:i] + [(cp.x, cp.y, cp.z)]),
                LineString([(cp.x, cp.y, cp.z)] + coords[i:])]


def sub_line(line, point, length=10):
    _, segment = cut(line, line.project(point) - length)
    segment, _ = cut(segment, segment.project(point) + length)
    return segment


def to_json_with_props(gdf, properties=None):
    geo = gdf._to_geo(na="null", show_bbox=False, drop_id=False)
    if properties is None:
        try:
            properties = gdf.properties
        except:
            properties = {}
    if len(properties) > 0:
        geo['properties'] = properties

    return json.dumps(geo)

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

newPixelSource
