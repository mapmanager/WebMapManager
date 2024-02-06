from typing import Tuple
import numpy as np
from pyodide.http import pyfetch
from async_lru import alru_cache
from .base import ImageLoader


class PyodideImageLoader(ImageLoader):
    """
    A loader class for loading data using Pyodide.
    """

    def __init__(self, url: str):
        super().__init__()
        self.url = url

    @alru_cache(maxsize=140)
    async def loadSlice(self, time: int, channel: int, slice: int) -> np.ndarray:
        """
          Loads a slice of data for the given time, channel, and slice index.

          Args:
            time (int): The time index.
            channel (int): The channel index.
            slice (int): The slice index.

          Returns:
            np.ndarray: The loaded slice of data.
        """
        response = await pyfetch(self.urlForImg(time, channel, slice))
        image = await response.memoryview()
        return np.frombuffer(image, np.uint16)

    @alru_cache(maxsize=10)
    async def fetchSlices(self, time: int, channel: int, sliceRange: Tuple[int, int]) -> np.ndarray:
        """
        Fetches a range of slices for the given time, channel, and slice range.

        Args:
          time (int): The time index.
          channel (int): The channel index.
          sliceRange (tuple): The range of slice indices.

        Returns:
          np.ndarray: The fetched slices.
        """
        return await super().fetchSlices(time, channel, sliceRange)

    def urlForImg(self, time: int, channel: int, slice: int) -> str:
        """
            Loads a slice of data for the given time, channel, and slice index.

            Args:
              time (int): The time index.
              channel (int): The channel index.
              slice (int): The slice index.

            Returns:
              str: The url to the image.
        """
        return f"{self.url}t{time}/ch{channel}/z{slice}.br"
