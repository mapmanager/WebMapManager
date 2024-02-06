from typing import Callable, Tuple, Union
import numpy as np
from .layer import Layer
from .utils import getCoords, inRange, dropZ
from .line import LineLayer
import geopandas as gp
from shapely.geometry import LineString, Point


class PointLayer(Layer):
    # clip the shapes z axis
    def clipZ(self, range: Tuple[int, int]):
        self.series = self.series[inRange(self.series.z, range=range)]
        self.series = self.series.apply(dropZ)
        return self

    def toLine(self, points: gp.GeoSeries):
        self.series = points.combine(
            self.series, lambda x, x1: LineString([x, x1]))
        return LineLayer(self)

    @Layer.setProperty
    def radius(self, radius: Union[int, Callable[[str], int]]):
        ("implemented by decorator", radius)
        return self
    
    """Adds text labels using the index of the series
    """
    @Layer.setProperty
    def label(self, show=True):
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

def tail(self):
    points = PointLayer(self)
    points.series = points.series.apply(lambda x: Point(x.coords[-1]))
    return points
LineLayer.tail = tail
