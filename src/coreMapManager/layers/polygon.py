import numpy as np
from .layer import Layer
from .utils import getCoords


class PolygonLayer(Layer):
    def _encodeBin(self):
        coords = self.series.apply(getCoords)
        featureId = coords.index
        coords = coords.reset_index(drop=True)
        coords = coords.explode()
        polygonIndices = coords.apply(len).cumsum()
        coords = coords.explode()

        return {"polygons": {
            "ids": featureId,
            "featureIds": coords.index.to_numpy(dtype=np.uint16),
            "polygonIndices": np.insert(polygonIndices.to_numpy(dtype=np.uint16), 0, 0, axis=0),
            "positions": coords.explode().to_numpy(dtype=np.float32),
        }}
