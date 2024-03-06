from copy import copy
import numpy as np
import pandas as pd
from typing import List

from ....benchmark import timeAll
from ....layers.line import calcSubLine, extend
from .utils import PLOT_ABLE_QUERIES, QUERIES, Query, queryable
from ..base_mutation import AnnotationsBaseMut
from ...types import AnnotationsOptions
from ....layers.utils import inRange
from ....utils import filterMask, sync
from shapely.geometry import LineString
import shapely
import traceback


@sync
class QueryAnnotations(AnnotationsBaseMut):
    def getSegmentsAndSpines(self, options: AnnotationsOptions):
        z_range = options['selection']['z']
        index_filter = options["filters"]
        segments = []

        for (segmentID, points) in self._points.groupby("segmentID"):
            spines = points.index.to_frame(name="id")
            spines["type"] = "Start"
            spines["invisible"] = ~ inRange(points["z"], z_range)
            spines["invisible"] = spines["invisible"] & ~ filterMask(
                points.index, index_filter)

            segments.append({
                "segmentID": segmentID,
                "spines": spines.to_dict('records')
            })

        return segments

    def filter(self, index: pd.Index):
        filtered = copy(self)
        filtered._points = filtered._points[index]
        return filtered

    # ?
    def __getitem__(self, key):
        return self._points[key]

    def getSpinePosition(self, t: int, spineID: str):
        return list(self._points.loc[spineID, "point"].coords)[0]

    def queries(self) -> List[Query]:
        return PLOT_ABLE_QUERIES

    async def runQuery(self, query: Query) -> pd.Series:
        return await query.runWith(self)

    @timeAll
    async def table(self, queries: List[Query] = PLOT_ABLE_QUERIES) -> pd.DataFrame:
        return pd.DataFrame({
            query.getTitle(): await query.runWith(self) for query in queries
        })

    async def dataFrame(self, queries: List[Query] = QUERIES) -> pd.DataFrame:
        return await self.table(queries)

    @queryable(title="Spine ID", categorical=True)
    def spineID(self):
        return self._points.index

    @queryable(title="Segment ID", categorical=True)
    def segmentID(self):
        return self._points["segmentID"]

    @queryable(title="x")
    def pointX(self):
        return self._points["point"].apply(lambda p: p.x)

    @queryable(title="y")
    def pointX(self):
        return self._points["point"].apply(lambda p: p.y)

    @queryable(title="z")
    def pointZ(self):
        return self._points["z"]

    @queryable(title="Anchor X")
    def anchorX(self):
        return self._points["anchor"].apply(lambda p: p.x)

    @queryable(title="Anchor Y")
    def anchorY(self):
        return self._points["anchor"].apply(lambda p: p.y)

    @queryable(title="Spine Length")
    def spineLength(self):
        return self._points.apply(lambda x: round(LineString(
            [x["anchor"], x["point"]]).length, 2), axis=1)

    @queryable(title="X Background Offset")
    def xBackgroundOffset(self):
        return self._points["xBackgroundOffset"]

    @queryable(title="Y Background Offset")
    def yBackgroundOffset(self):
        return self._points["yBackgroundOffset"]

    @queryable(title="ROI Head Extend")
    def roiExtend(self):
        return self._points["roiExtend"]

    @queryable(title="Point", plotAble=False)
    def points(self):
        return self._points["point"]

    @queryable(title="Anchor", plotAble=False)
    def anchors(self):
        return self._points.apply(lambda x: LineString([x["anchor"], x["point"]]), axis=1)

    @queryable(title="Anchor Point", plotAble=False)
    def anchorPoint(self):
        return self._points["anchor"]

    def _segments(self):
        return self._lineSegments.loc[self._points["segmentID"].drop_duplicates()]

    def segments(self):
        return self._segments()["segment"]

    def segmentsLeft(self):
        return self._segments().apply(lambda x: shapely.offset_curve(x["segment"], x["radius"]), axis=1)

    def segmentsRight(self):
        return self._segments().apply(lambda x: shapely.offset_curve(x["segment"], -x["radius"]), axis=1)

    @queryable(title="Radius", segmentDependencies=["radius"])
    def radius(self):
        return pd.Series(
            self._lineSegments.loc[self._points["segmentID"], "radius"].values,
            index=self._points.index
        )

    @queryable(dependencies=["point", "anchor", "roiExtend", "radius"], plotAble=False)
    def roiHead(self):
        return self._points.apply(
            lambda x: extend(LineString(
                [x["anchor"], x["point"]]), origin=x["anchor"], distance=x["roiExtend"]).buffer(x["radius"], cap_style=2),
            axis=1)

    @queryable(dependencies=["roiHead", "xBackgroundOffset", "yBackgroundOffset"], plotAble=False)
    def roiHeadBg(self):
        return self._points.apply(
            lambda x: shapely.affinity.translate(
                x["roiHead"], x["xBackgroundOffset"], x["yBackgroundOffset"]),
            axis=1)

    @queryable(dependencies=["anchor", "radius"], segmentDependencies=["segment"], plotAble=False)
    def roiBase(self):
        df = self._points.join(self._lineSegments[["segment"]], on="segmentID")
        return df.apply(lambda d: calcSubLine(d["segment"], d["anchor"], distance=8).buffer(d["radius"], cap_style=2), axis=1)

    @queryable(dependencies=["roiBase", "xBackgroundOffset", "yBackgroundOffset"], plotAble=False)
    def roiBaseBg(self):
        return self._points.apply(
            lambda x: shapely.affinity.translate(
                x["roiBase"], x["xBackgroundOffset"], x["yBackgroundOffset"]),
            axis=1)

    @queryable(dependencies=["roiBase", "roiHead"], plotAble=False)
    def roi(self):
        return self.roiBase().union(self.roiHead())

    @queryable(dependencies=["roiBaseBg", "roiHeadBg"], plotAble=False)
    def roiBg(self):
        return self.roiBaseBg().union(self.roiHeadBg())

    # Should cache?
    async def roiPixels(self, channel: int = 0, zExpand: int = 0):
        return await self.getPolygonPixels(self.roi(), channel, zExpand)

    async def roiBgPixels(self, channel: int = 0, zExpand: int = 0):
        return await self.getPolygonPixels(self.roiBg(), channel, zExpand)

    @queryable(titles=[
        "Roi Channel 0 (sum)",
        "Roi Channel 0 (mean)",
    ], dependencies=["roi"])
    async def _roiChannel0Stats(self):
        stats = (await self.roiPixels(channel=0)).apply(getStats)
        return list(zip(*stats))

    @queryable(titles=[
        "Roi Channel 1 (sum)",
        "Roi Channel 1 (mean)",
    ], dependencies=["roi"])
    async def _roiChannel1Stats(self):
        stats = (await self.roiPixels(channel=1)).apply(getStats)
        return list(zip(*stats))

    @queryable(titles=[
        "Bg Roi Channel 0 (sum)",
        "Bg Roi Channel 0 (mean)",
    ], dependencies=["roiBg"])
    async def _roiBgChannel0Stats(self):
        stats = (await self.roiBgPixels(channel=0)).apply(getStats)
        return list(zip(*stats))

    @queryable(titles=[
        "Bg Roi Channel 1 (sum)",
        "Bg Roi Channel 1 (mean)",
    ], dependencies=["roiBg"])
    async def _roiBgChannel1Stats(self):
        stats = (await self.roiBgPixels(channel=1)).apply(getStats)
        return list(zip(*stats))


def getStats(img):
    return (np.sum(img), np.mean(img))
