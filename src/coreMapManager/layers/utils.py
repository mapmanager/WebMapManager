import inspect
import numpy as np
from shapely.geometry import MultiPoint, LineString, Point, Polygon, MultiLineString, MultiPolygon
import shapely
from .layer import Layer
from ..benchmark import timer


def getCoords(shape):
    if isinstance(shape, Point):
        return [shape.coords[0]]
    if isinstance(shape, MultiPoint):
        return shape.coords
    if isinstance(shape, LineString):
        return [shape.coords]
    if isinstance(shape, MultiLineString):
        return [line.coords for line in shape.geoms]
    if isinstance(shape, Polygon):
        return [shape.exterior.coords]
    if isinstance(shape, MultiPolygon):
        return [poly.exterior.coords for poly in shape.geoms]
    return shape


@timer
def dropZPoint(x, y, z=None):
    return (x, y)


# TODO: replace with shapely vectorized
@timer
def dropZ(shape):
    if isinstance(shape, LineString):
        return LineString((x, y) for x, y, z in shape.coords)
    return shapely.ops.transform(dropZPoint, shape)


def inRange(x, range):
    return np.invert((range[0] > x) | (range[1] < x))


def Sourced(func):
    def sourced(self, *args, **kwargs):
        layer: Layer = func(self, *args, **kwargs)
        dependencies = inspect.getfullargspec(func).args[1:]
        layer.source(func.__name__, dependencies)
        return layer
    return sourced


def roundPoint(point: Point, ndig=0):
    return Point(round(point.x, ndig), round(point.y, ndig), round(point.z, ndig))
