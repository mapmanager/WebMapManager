import warnings
import geopandas as gp
from ..types import AnnotationsOptions
from ...layers import LineLayer, PointLayer, Layer
from ...layers.utils import dropZ
from ...benchmark import timer
import warnings
from shapely.errors import ShapelyDeprecationWarning
from .interactions import AnnotationsInteractions
from typing import List, Tuple
from typing import List
from ...layers.layer import Layer


class AnnotationsLayers(AnnotationsInteractions):
    """Annotations Layers Generation"""

    @timer
    def getAnnotations(self, options: AnnotationsOptions) -> list[Layer]:
        """
        Generates the annotations based on the provided options.

        Args:
            options (AnnotationsOptions): The options for retrieving annotations.

        Returns:
            list: A list of layers containing the retrieved annotations.
        """
        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore", category=ShapelyDeprecationWarning)
            layers = []

            zRange = options["selection"]["z"]
            if options["showLineSegments"]:
                layers.extend(self._getSegments(
                    zRange, options["annotationSelections"]["segmentID"], options["showLineSegmentsRadius"]))

            if options["showSpines"]:
                layers.extend(self._getSpines(options))

            return layers

    @timer
    def _getSpines(self, options: AnnotationsOptions) -> list[Layer]:
        zRange = options["selection"]["z"]
        selections = options["annotationSelections"]
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
            layers.extend(self._appendPointLayers(options, points))
        else:
            layers.extend(self._appendPointLayers(
                options, points[not_faded], True))
            for layer in self._appendPointLayers(options, points[~not_faded], True):
                layers.append(layer.opacity(255*0.5).copy(id="ghost"))

        if selectedSpine in self._points.index:
            self._appendRois(
                self._points.loc[[selectedSpine]], editing, layers)

        return layers

    def _appendPointLayers(self, options: AnnotationsOptions, points: gp.GeoDataFrame, editing=False):
        layers = []
        selectedSpine = options["annotationSelections"]["spineID"]
        spines = (PointLayer(points["point"])
                  .id("spine")
                  .on("select", "spineID")
                  .fill(lambda id: [0, 255, 255] if id == selectedSpine else [255, 0, 0]))

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
                                  .onTranslate(self.translateAnchor)
                                  .fill([0, 0, 255])
                                  .radius(5))

        if editing:
            layers.append(spines.onTranslate(self.translateSpine).radius(5))
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

    @timer
    def _appendRois(self, spineDf: gp.GeoDataFrame, editing: bool, layers: List[Layer]):
        boarderWidth = 0.5
        outline = 4 / boarderWidth
        headLayer = (PointLayer(spineDf["point"])
                     .id("roi-head")
                     .toLine(spineDf["anchor"])
                     .extend(spineDf["roiExtend"])
                     .outline(outline)
                     .strokeWidth(boarderWidth)
                     .stroke([255, 255, 0]))

        segments = spineDf.join(
            self._lineSegments[["segment", "radius"]], on="segmentID",)
        baseLayer = (LineLayer.createSubLine(segments, 8, "segment", "anchor")
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
                          .onTranslate(self.translateBackgroundRoi))
            layers.append(backgroundRoiBase.copy(id="translate")
                          .outline(None)
                          .strokeWidth(4)
                          .stroke([0, 0, 0, 0])
                          .fixed()
                          .onTranslate(self.translateBackgroundRoi))

            backgroundRoiHead = backgroundRoiHead.onTranslate(
                self.translateBackgroundRoi)
            backgroundRoiBase = backgroundRoiBase.onTranslate(
                self.translateBackgroundRoi)

        layers.append(backgroundRoiHead)
        layers.append(backgroundRoiBase)
        layers.append(headLayer)
        layers.append(baseLayer)

        if editing:
            # Add the extend interaction target
            layers.append(headLayer.copy(id="translate-extend")
                          .outline(None)
                          .strokeWidth(outline * boarderWidth)
                          .subLine(1)
                          .stroke([0, 255, 0])
                          .onTranslate(self.translateRoiExtend)
                          .fixed())

    @timer
    def _getSegments(self, zRange: Tuple[int, int], editSegId: str, showLineSegmentsRadius: bool):
        layers = []

        segment = (LineLayer(self._lineSegments["segment"])
                   .id("segment")
                   .clipZ(zRange)
                   .on("edit", "segmentID")
                   .stroke(lambda id: [0, 255, 0] if id == editSegId else [255, 0, 0]))

        boarderWidth = 0.5
        def offset(
            id): return self._lineSegments.loc[id, "radius"] / boarderWidth

        # Render the ghost of the edit
        if editSegId is not None:
            self._segmentGhost(editSegId, showLineSegmentsRadius,
                               layers, segment, boarderWidth, offset)

        if showLineSegmentsRadius:
            # Left line
            left = (segment.copy(id="left")
                    .strokeWidth(boarderWidth)
                    .offset(lambda id: -offset(id)))

            layers.append(left)

            # Right line
            right = (segment.copy(id="right")
                     .strokeWidth(boarderWidth)
                     .offset(offset))
            layers.append(right)

            if editSegId:
                left = left.onTranslate(self.translateSegmentRadius)
                right = right.onTranslate(self.translateSegmentRadius)

        if editSegId is None:
            # Make the click target larger
            layers.append(segment.copy(id="interaction")
                          .strokeWidth(lambda id: self._lineSegments.loc[id, "radius"])
                          .stroke([0, 0, 0, 0])
                          .fixed())

        # Add the line segment
        layers.append(segment.strokeWidth(
            lambda id: 4 if id == editSegId else 2))

        return layers

    def _segmentGhost(self, segId, showLineSegmentsRadius, layers, segment, boarderWidth, offset):
        segmentSeries = self._lineSegments.loc[[segId], "segment"]
        segmentSeries = segmentSeries.apply(dropZ)
        ghost = segment.copy(segmentSeries, id="ghost").opacity(255 * 0.5)

        if showLineSegmentsRadius:
            # Ghost Left line
            layers.append(ghost.copy(id="left-ghost")
                          .strokeWidth(boarderWidth)
                          .offset(lambda id: -offset(id)))

            # Ghost Right line
            layers.append(ghost.copy(id="right-ghost")
                          .strokeWidth(boarderWidth)
                          .offset(offset))

            # Add the ghost
        layers.append(ghost)
