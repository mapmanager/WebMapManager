import numpy as np
from layers.layer import Layer
from layers.utils import dropZ, getCoords
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import substring, clip_by_rect
import shapely
import geopandas as gp
from benchmark import timer
from layers.polygon import PolygonLayer

class MultiLineLayer(Layer):
    @timer
    def buffer(self, *args, **kwargs):
        self.series = self.series.apply(lambda x: x.buffer(*args, **kwargs))
        return PolygonLayer(self)

    @Layer.__withEvent__
    def offset(self, offset: int):
        ("implemented by decorator", offset)
        return self

    @Layer.__withEvent__
    def outline(self, outline: int):
        ("implemented by decorator", outline)
        return self

    def _encodeBin(self):
        coords = self.series.apply(getCoords)
        featureId = coords.index
        coords = coords.reset_index(drop=True)
        coords = coords.explode()
        pathIndices = coords.apply(len).cumsum()
        coords = coords.explode()

        return {"lines": {
            "ids": featureId,
            "featureIds": coords.index.to_numpy(dtype=np.uint16),
            "pathIndices": np.insert(pathIndices.to_numpy(dtype=np.uint16), 0, 0, axis=0),
            "positions": coords.explode().to_numpy(dtype=np.float32),
        }}


class LineLayer(MultiLineLayer):
    # clip the shapes z axis
    def clipZ(self, zRange: (int, int)):
        self.series = self.series.apply(clipLine, zRange=zRange)
        self.series.dropna(inplace=True)
        return MultiLineLayer(self)

    @timer
    def subLine(df: gp.GeoDataFrame, distance: int, linc: str, originc: str):
        series = df.apply(lambda d: calcSubLine(d[linc], d[originc], distance), axis=1)
        return LineLayer(series)

    @timer
    def simplify(self, res: int):
        self.series = self.series.simplify(res)
        return self

    def extend(self, distance=0.5, originIdx=0):
        self.series = self.series.apply(
            lambda x: extend(x, x.coords[originIdx], distance=distance))
        return self


@timer
def calcSubLine(line: LineLayer, origin: Point, distance: int):
    root = line.project(origin)
    sub = substring(line, start_dist=max(root - distance, 0), end_dist=root + distance)
    return sub


def extend(x: LineString, origin, distance):
    scale = 1 + distance / x.length
    # grow by scaler from one direction
    return shapely.affinity.scale(x, xfact=scale, yfact=scale, origin=origin)


def pushLine(segment, lines):
    if len(segment) <= 1:
        return
    lines.append(segment)


def clipLine(line: LineString, zRange: (int, int)):
    z_min, z_max = zRange

    zInRange = [z_min <= p[2] < z_max for p in line.coords]
    if not any(zInRange):
        return None

    # Initialize a list to store the clipped 2D LineString segments
    lines = []
    segment = []

    # Iterate through the line coordinates
    for i in range(len(line.coords) - 1):
        z1InRange, z2InRange = zInRange[i], zInRange[i+1]
        p1 = line.coords[i]

        # Check if the segment is within the z-coordinate bounds
        if z1InRange:
            # Include the entire segment in the clipped 2D LineString
            segment.append((p1[0], p1[1]))

            if not z2InRange:
                # The segment exits the bounds
                point = interpolateAcross(z_min, z_max, p1, line.coords[i+1])
                segment.append(point)

            continue

        p2 = line.coords[i+1]
        if z2InRange:
            # The segment enters the bounds
            point = interpolateAcross(z_min, z_max, p2, p1)
            segment.append(point)
        elif (p1[2] < z_min and p2[2] > z_max) or (p2[2] < z_min and p1[2] > z_max):
            # The segment crosses the z bounds; clip and include both parts
            segment.extend((interpolate(p1, p2, z_min),
                           interpolate(p1, p2, z_max)))

        if len(segment) != 0:
            pushLine(segment, lines)
            segment = []

    if zInRange[-1]:
        x, y, z = line.coords[-1]
        segment.append((x, y))

    pushLine(segment, lines)

    if not lines:
        return None

    if len(lines) == 1:
        return LineString(lines[0])

    return MultiLineString(lines)


# 1 is in and 2 is out
def interpolateAcross(z_min, z_max, p1, p2):
    if p2[2] >= z_max:
        return interpolate(p1, p2, z_max)
    return interpolate(p1, p2, z_min)


def interpolate(p1, p2, crossZ):
    x1, y1, z1 = p1
    x2, y2, z2 = p2
    t = (crossZ - z1) / (z2 - z1)

    x_interpolated = x1 + t * (x2 - x1)
    y_interpolated = y1 + t * (y2 - y1)
    return (x_interpolated, y_interpolated)
