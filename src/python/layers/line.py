import numpy as np
from layers.layer import Layer
from layers.utils import clipLine, getCoords
import shapely


class MultiLineLayer(Layer):
    def buffer(self, *args, **kwargs):
        self.series = self.series.buffer(*args, **kwargs)
        return self

    @Layer.__withEvent__
    def offset(self, offset: int):
        ("implemented by decorator", offset)
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
    def clipZ(self, range: (int, int)):
        self.series = self.series.apply(clipLine, range=range)
        self.series.dropna(inplace=True)
        return MultiLineLayer(self)

    def extend(self, scale=0.5, originIdx = 1):
        self.series = self.series.apply(
            lambda x: extend(x, x.coords[originIdx], scale=scale))
        return self


def extend(x, origin, scale=-0.5):
    # grow by scaler from one direction
    return shapely.affinity.scale(x, xfact=scale, yfact=scale, origin=origin)
