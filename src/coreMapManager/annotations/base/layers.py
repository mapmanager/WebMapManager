import warnings
import geopandas as gp

from ...config import COLORS, CONFIG, TRANSPARENT
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
from typing import List


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
            selections = options["annotationSelections"]

            if options["showLineSegments"]:
                layers.extend(self._getSegments(
                    zRange, selections["segmentIDEditing"], selections["segmentID"], options["showLineSegmentsRadius"]))

            if options["showSpines"]:
                layers.extend(self._getSpines(options))

            layers = [layer for layer in layers if not layer.empty()]

            return layers

    @timer
    def _getSpines(self, options: AnnotationsOptions) -> list[Layer]:
        zRange = options["selection"]["z"]
        selections = options["annotationSelections"]
        selectedSpine = selections["spineID"]
        editingSegmentId = selections["segmentIDEditing"]
        editing = editingSegmentId is not None
        # index_filter = options["filters"]

        layers = []
        if editing:
            # only show selected points
            points = self._points[self._points["segmentID"]
                                  == editingSegmentId]
        else:
            points = self._points

        visiblePoints = points["z"].between(
            zRange[0], zRange[1], inclusive="left")
        visibleAnchors = points["anchorZ"].between(
            zRange[0], zRange[1], inclusive="left")

        if not editing:
            points = points[visiblePoints | visibleAnchors]

        if len(points) == 0:
            return layers

        spines = (PointLayer(points["point"])
                  .id("spine")
                  .on("select", "spineID")
                  .fill(lambda id: COLORS["spine"] if id == selectedSpine else COLORS["selectedSpine"]))

        labels = None
        if options["showAnchors"] or options["showLabels"]:
            anchorLines = (spines
                           .copy(id="anchorLine")
                           .toLine(points["anchor"])
                           .stroke(COLORS["anchorLine"]))

            if options["showLabels"]:
                labels = (anchorLines
                          .copy(id="label")
                          .extend(CONFIG["labelOffset"])
                          .tail()
                          .label()
                          .fill(COLORS["label"]))

            if options["showAnchors"]:
                layers.extend(anchorLines.splitGhost(
                    visiblePoints & visibleAnchors, opacity=CONFIG["ghostOpacity"]))

                anchors = (PointLayer(points["anchor"]).id("anchor")
                           .fill(COLORS["anchorPoint"]))
                if editing:
                    anchors = (anchors.onDrag(self.moveAnchor)
                               .radius(CONFIG["pointRadiusEditing"]))
                else:
                    anchors = anchors.radius(CONFIG["pointRadius"])

                layers.extend(anchors.splitGhost(
                    visibleAnchors, opacity=CONFIG["ghostOpacity"]))

        if editing:
            spines = (spines.onDrag(self.moveSpine)
                      .radius(CONFIG["pointRadiusEditing"]))
        else:
            spines = spines.radius(CONFIG["pointRadius"])

        # partially show spines that are not in scope with anchors in scope
        layers.extend(spines.splitGhost(
            visiblePoints, opacity=CONFIG["ghostOpacity"]))

        # render labels
        if options["showLabels"]:
            layers.extend(labels.splitGhost(
                visiblePoints, opacity=CONFIG["ghostOpacity"]))

        if selectedSpine in self._points.index:
            self._appendRois(
                self._points.loc[[selectedSpine]], editing, layers)

        return layers

    @timer
    def _appendRois(self, spineDf: gp.GeoDataFrame, editing: bool, layers: List[Layer]):
        boarderWidth = CONFIG["roiStrokeWidth"]
        segments = spineDf[["anchor", "segmentID"]].join(
            self._lineSegments[["segment", "radius"]], on="segmentID",)

        def radius(id):
            return segments.loc[id, "radius"]

        def outline(id):
            return radius(id) / boarderWidth

        headLayer = (PointLayer(spineDf["point"])
                     .id("roi-head")
                     .toLine(spineDf["anchor"])
                     .extend(spineDf["roiExtend"])
                     .outline(outline)
                     .strokeWidth(boarderWidth)
                     .stroke(COLORS["roiHead"]))

        baseLayer = (LineLayer.createSubLine(segments, 8, "segment", "anchor")
                     .id("roi-base")
                     .outline(outline)
                     .strokeWidth(boarderWidth)
                     .stroke(COLORS["roiBase"]))

        offset = spineDf[["xBackgroundOffset", "yBackgroundOffset"]]
        backgroundRoiHead = (headLayer
                             .copy(id="background")
                             .translate(offset)
                             .stroke(COLORS["roiHeadBg"]))

        backgroundRoiBase = (baseLayer
                             .copy(id="background")
                             .translate(offset)
                             .stroke(COLORS["roiBaseBg"]))
        if editing:
            # Add larger interaction targets
            layers.append(backgroundRoiHead.copy(id="translate")
                          .outline(None)
                          .strokeWidth(radius)
                          .stroke(TRANSPARENT)
                          .fixed()
                          .onDrag(self.translateBackgroundRoi))
            layers.append(backgroundRoiBase.copy(id="translate")
                          .outline(None)
                          .strokeWidth(radius)
                          .stroke(TRANSPARENT)
                          .fixed()
                          .onDrag(self.translateBackgroundRoi))

            backgroundRoiHead = backgroundRoiHead.onDrag(
                self.translateBackgroundRoi)
            backgroundRoiBase = backgroundRoiBase.onDrag(
                self.translateBackgroundRoi)

        layers.append(backgroundRoiHead)
        layers.append(backgroundRoiBase)
        layers.append(headLayer)
        layers.append(baseLayer)

        if editing:
            # Add the extend interaction target
            layers.append(headLayer.copy(id="translate-extend")
                          .outline(None)
                          .strokeWidth(lambda id: outline(id) * boarderWidth)
                          .subLine(1)
                          .stroke(COLORS["intractable"])
                          .onDrag(self.moveRoiExtend)
                          .fixed())

    @timer
    def _getSegments(self, zRange: Tuple[int, int], editSegId: str, selectedSegId: str, showLineSegmentsRadius: bool) -> List[Layer]:
        layers = []

        segment = (LineLayer(self._lineSegments["segment"])
                   .id("segment")
                   .clipZ(zRange)
                   .on("edit", "segmentIDEditing")
                   .stroke(lambda id: COLORS["segmentSelected"] if id == selectedSegId else (COLORS["segmentEditing"] if id == editSegId else COLORS["segment"])))

        boarderWidth = CONFIG["segmentLeftRightStrokeWidth"]

        def offset(id: str):
            return self._lineSegments.loc[id, "radius"] / boarderWidth

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
                left = left.onDrag(self.moveSegmentRadius)
                right = right.onDrag(self.moveSegmentRadius)

        if editSegId is None:
            # Make the click target larger
            layers.append(segment.copy(id="interaction")
                          .strokeWidth(lambda id: self._lineSegments.loc[id, "radius"])
                          .stroke(TRANSPARENT)
                          .fixed())

        # Add the line segment
        layers.append(segment.strokeWidth(
            lambda id: CONFIG["segmentBoldWidth"] if id == editSegId else CONFIG["segmentWidth"]))

        return layers

    def _segmentGhost(self, segId: str, showLineSegmentsRadius: bool, layers: List[Layer], segment: LineLayer, boarderWidth: int, offset: int):
        segmentSeries = self._lineSegments.loc[[segId], "segment"]
        segmentSeries = segmentSeries.apply(dropZ)
        ghost = (segment.copy(segmentSeries, id="ghost")
                 .opacity(CONFIG["ghostOpacity"]))

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
