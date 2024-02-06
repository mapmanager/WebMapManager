from io import StringIO
import pandas as pd
from .types import AnnotationsOptions, ImageSlice
from ..store.image.pyodide import PyodideImageLoader
from ..utils import toGeoData
from .base import Annotations
from pyodide.http import pyfetch
from pyodide.ffi import to_js


class PyodideAnnotations(Annotations):
    async def load(url: str):
        lineSegments = await loadGeoCsv(url + "/line_segments.csv", ['segment'], index_col="segmentID", dtype={'segmentID': str})
        points = await loadGeoCsv(url + "/points.csv", ['point', 'anchor'], index_col="spineID", dtype={'spineID': str, 'segmentID': str})
        loader = PyodideImageLoader(url)
        return PyodideAnnotations(loader, lineSegments, points)

    def getAnnotations_js(self, options: AnnotationsOptions):
        """
        A JS version of getAnnotations.
        """
        options = options.to_py()
        layers = self.getAnnotations(options)
        return [layer.encodeBin() for layer in layers]

    async def slices_js(self, time: int, channel: int, zRange: [int, int]) -> ImageSlice:
        """
        Loads the image data for a slice.

        Args:
          time (int): The time slot index.
          channel (int): The channel index.
          zRange ([int, int]): The visible z slice range.

        Returns:
          ImageSlice: The image slice.
        """
        return self.slices(time, channel, (zRange[0], zRange[1]))

    def getSpinePosition(self, t: int, spineID: str):
        return to_js(super().getSpinePosition(t, spineID))

    def getSegmentsAndSpines(self, options: AnnotationsOptions):
        options = options.to_py()
        return super().getSegmentsAndSpines(options)


async def loadGeoCsv(path, geometryCols, index_col=None, dtype=None):
    response = await pyfetch(path)
    csv_text = await response.text()
    csv_text_io = StringIO(csv_text)
    return toGeoData(pd.read_csv(csv_text_io, index_col=index_col, dtype=dtype), geometryCols)
