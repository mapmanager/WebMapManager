import inspect
import numpy as np
from shapely.geometry import MultiPoint, LineString, Point, Polygon, MultiLineString,MultiPolygon
import shapely
from layers.layer import Layer

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

def dropZPoint(x, y, z=None):
    return (x, y)


# TODO: replace with shapely vectorized
def dropZ(shape):
    return shapely.ops.transform(dropZPoint, shape)


def inRange(x, range):
    return np.invert((range[0] > x) | (range[1] < x))


def pushLine(segment, lines):
    segment = list(dict.fromkeys(segment))
    if len(segment) <= 1:
        return
    lines.append(segment)


def clipLine(line, range: (int, int)):
    lines = []
    segment = []

    for (x, y, z) in line.coords:
        if inRange(z, range):
            segment.append((x, y))
        elif len(segment) != 0:
            pushLine(segment, lines)
            segment = []

    if len(segment) != 0:
        pushLine(segment, lines)

    if len(lines) == 0:
        return None

    if len(lines) == 1:
        return LineString(lines[0])

    return MultiLineString(lines)
