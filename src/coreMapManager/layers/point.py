from typing import Callable, Self, Tuple, Union
import numpy as np
import geopandas as gp
from shapely.geometry import LineString
from .layer import Layer
from .utils import getCoords, inRange, dropZ


class PointLayer(Layer):
    # clip the shapes z axis
    def clipZ(self, range: Tuple[int, int]) -> Self:
        self.series = self.series[inRange(self.series.z, range=range)]
        self.series = self.series.apply(dropZ)
        return self

    def toLine(self, points: gp.GeoSeries):
        from .line import LineLayer
        self.series = points.combine(
            self.series, lambda x, x1: LineString([x, x1]))
        return LineLayer(self)

    @Layer.setProperty
    def radius(self, radius: Union[int, Callable[[str], int]]) -> Self:
        ("implemented by decorator", radius)
        return self

    """Adds text labels using the index of the series
    """
    @Layer.setProperty
    def label(self, show=True) -> Self:
        ("implemented by decorator", show)
        return self

    def _encodeBin(self):
        coords = self.series.apply(getCoords)
        coords = coords.explode()
        featureId = coords.index
        coords = coords.reset_index(drop=True)
        return {"points": {
            "ids": featureId,
            "featureIds": coords.index.to_numpy(dtype=np.uint16),
            "positions": coords.explode().to_numpy(dtype=np.float32),
        }}
