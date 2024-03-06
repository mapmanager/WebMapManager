from typing import Self, Tuple, Union
from async_lru import alru_cache
import numpy as np
import asyncio

import pandas as pd

from ...utils import sync, polygonIndexes
import geopandas as gp


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

    @alru_cache(maxsize=15)
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
                   for i in range(int(sliceRange[0]), int(sliceRange[1]))]

        if len(pending) == 1:
            return await pending[0]

        sls = await asyncio.gather(*pending)

        return np.max(sls, axis=0)

    async def get(self, time: int, channel: int, z: Union[Tuple[int, int], int, np.ndarray], x: Union[Tuple[int, int, np.ndarray], int], y: Union[Tuple[int, int], int, np.ndarray]) -> np.array:
        """
        Fetches a range of slices for the given time, channel, and slice range.

        Args:
          time (int): The time index.
          channel (int): The channel index.
          z (tuple): The range of slice indices.
          x (tuple): The range of x indices.
          y (tuple): The range of y indices.

        Returns:
          np.ndarray: The fetched slices.
        """
        z = z if isinstance(z, tuple) else (z, z + 1)

        if isinstance(x, np.ndarray):
            x = bounds(x)
        else:
            x = x if isinstance(x, tuple) else (x, x + 1)

        if isinstance(y, np.ndarray):
            y = bounds(y)
        else:
            y = y if isinstance(y, tuple) else (y, y + 1)

        if z[0] == z[1] - 1:
            slices = await self.loadSlice(time, channel, int(z[0]))
        else:
            slices = await self.fetchSlices(time, channel, z)

        if isinstance(x, np.ndarray) and isinstance(y, np.ndarray):
            return slices[x, y]
        if isinstance(x, np.ndarray):
            return slices[x, y[0]:y[1]]
        if isinstance(y, np.ndarray):
            return slices[x[0]:x[1], y]

        return slices[x[0]:x[1], y[0]:y[1]]

    async def getPolygons(self, polygons: gp.GeoDataFrame, zExpand: int = 0, channel: int = 0):
        results = []
        indexes = []

        polygons["z"] = polygons["z"].astype(int)

        async def processGroup(group: pd.DataFrame, t, z):
            if zExpand == 0:
                image = await self.loadSlice(t, channel, z)
            else:
                image = await self.fetchSlices(t, channel, (z - zExpand, z + zExpand + 1))

            for idx, row in group.iterrows():
                xs, ys = polygonIndexes(row["polygon"])
                xLim, yLim = image.shape

                results.append(
                    image[np.clip(xs, 0, xLim-1), np.clip(ys, 0, yLim-1)])
                indexes.append(idx)

        pending = [processGroup(group, t, z) for (
            t, z), group in polygons.groupby(by=["t", "z"])]
        await asyncio.gather(*pending)
        return pd.Series(results, indexes)


class ImageLoaderBuilder:
    def build(self) -> ImageLoader:
        "abstract method"


class ArrayImageLoaderBuilder(ImageLoaderBuilder):
    """
    Class for building images into a 5D array.
    """

    def __init__(self):
        self.images = []

    def read(self, path: str, time: int = 0, channel: int = 0):
        """
        Load an image from the given path and store it in the images array.

        Args:
          path (str): The path to the image file.
          time (int): The time index.
          channel (int): The channel index.
        """
        from imageio import imread
        self.images.append([time, channel, imread(path)])

    def build(self):
        maxTime = max(time for time, _, _ in self.images) + 1
        maxChannel = max(channel for _, channel, _ in self.images) + 1
        maxSlice, maxX, maxY = self.images[0][2].shape

        dimensions = [maxTime, maxChannel, maxSlice, maxX, maxY]
        images = np.zeros(dimensions, dtype=np.uint16)

        for time, channel, image in self.images:
            images[time, channel] = image

        return ArrayImageLoader(images)


@sync
class ArrayImageLoader(ImageLoader):
    """
    A loader class for loading from tifs.
    """

    def __init__(self, images: np.ndarray):
        """
        Initialize the BaseImage class.

        Args:
          images (np.ndarray): [time, channel, slice].

        """
        super().__init__()
        self.images = images

    def builder(self) -> ArrayImageLoaderBuilder:
        """
        Returns a builder for creating an ArrayImageLoader.
        """
        return ArrayImageLoaderBuilder()

    def imread(path: str) -> Self:
        """
        Load an image using imageio.imread.

        Args:
          path (str): The path to the image.
        """
        from imageio import imread
        return ArrayImageLoader(imread(path))

    async def loadSlice(self, time: int, channel: int, slice: int) -> np.ndarray:
        return self.images[time][channel][slice]

    @alru_cache(maxsize=15)
    async def fetchSlices(self, time: int, channel: int, sliceRange: Tuple[int, int]) -> np.ndarray:
        return np.max(self.images[time][channel][sliceRange[0]:sliceRange[1]], axis=0)


def bounds(x: np.array):
    return (x.min(), int(x.max()) + 1)
