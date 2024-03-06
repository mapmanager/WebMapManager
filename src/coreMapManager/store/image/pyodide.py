import asyncio
from typing import List, Tuple
import numpy as np
from pyodide.http import pyfetch
from async_lru import alru_cache
from .base import ImageLoader, ArrayImageLoader
from tifffile import imread, imwrite
from io import BytesIO


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

    # async def getPolygons(self, polygons: gp.GeoDataFrame, zExpand: int = 0, channel: int = 0):
    #     # Cache optimization, read all ROIs in order to increase cache hits
    #     polygons.sort_values(by=["t", "z"], inplace=True)

    #     async def processImage(row):
    #         xs, ys = polygonIndexes(row["polygon"])
    #         return await self.get(row["t"], z=(row["z"] - zExpand, row["z"] + zExpand + 1), x=xs, y=ys, channel=channel)

    #     pending = [processImage(row) for _, row in polygons.iterrows()]
    #     ready = await asyncio.gather(*pending)
    #     return pd.Series(ready, index=polygons.index)


async def fetchBytes(url: str):
    response = await pyfetch(url)
    return await response.memoryview()


async def loadTiffsFromUrl(urls: List[List[List[str]]]) -> ArrayImageLoader:
    pending = []

    for time in urls:
        for channels in time:
            for url in channels:
                pending.append(fetchBytes(url))

    if len(pending) == 1:
        results = [await pending[0]]
    else:
        results = await asyncio.gather(*pending)

    # TODO: use a single file
    images = []
    for time in urls:
        channelsImages = []
        for channels in time:
            for url in channels:
                buffer = bytearray(results.pop(0))
                channelsImages.append(imread(BytesIO(buffer)))
        images.append(channelsImages)

    return ArrayImageLoader(np.array(images))

ArrayImageLoader.loadTiffsFromUrl = loadTiffsFromUrl
