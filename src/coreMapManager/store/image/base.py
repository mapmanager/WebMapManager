from typing import Tuple
import numpy as np
import asyncio
from ...utils import sync

@sync
class ImageLoader:
    """
    Base class for image loaders.
    """

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
        ("implemented by subclass", time, channel, slice)

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
        pending = [self.loadSlice(time, channel, i)
                   for i in range(sliceRange[0], sliceRange[1])]

        if len(pending) == 1:
            return await pending[0]

        sls = await asyncio.gather(*pending)

        return np.max(sls, axis=0)
