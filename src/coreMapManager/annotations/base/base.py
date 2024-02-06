from typing import Tuple
import geopandas as gp
from ..types import ImageSlice
from ...utils import sync
from ...store.image.base import ImageLoader


@sync
class AnnotationsBase:
    loader: ImageLoader  # used for the brightest path
    _points: gp.GeoDataFrame
    _lineSegments: gp.GeoDataFrame

    def __init__(self, loader: ImageLoader, lineSegments: gp.GeoDataFrame, points: gp.GeoDataFrame):
        self._lineSegments = lineSegments
        self._points = points
        self.loader = loader

    async def slices(self, time: int, channel: int, zRange: Tuple[int, int]) -> ImageSlice:
        """
        Loads the image data for a slice.

        Args:
          time (int): The time slot index.
          channel (int): The channel index.
          zRange (Tuple[int, int]): The visible z slice range.

        Returns:
          ImageSlice: The image slice.
        """
        return ImageSlice(await self.loader.fetchSlices(time, channel, zRange))