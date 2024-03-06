from typing import Union
import numpy as np
import pandas as pd

from ..store.image.base import ArrayImageLoader, ImageLoader, ImageLoaderBuilder
from ..utils import toGeoData
from .base.interactions import AnnotationsInteractions


class MapAnnotations(AnnotationsInteractions):

    def __init__(self, lineSegmentsPath: Union[str, pd.DataFrame], pointsPath: Union[str, pd.DataFrame], imagePath: str = None, loader: Union[ImageLoader, ImageLoaderBuilder] = None):

        if isinstance(lineSegmentsPath, str):
            lineSegments = pd.read_csv(
                lineSegmentsPath, index_col="segmentID", dtype={'segmentID': str})
        else:
            lineSegments = lineSegmentsPath.set_index('segmentID', drop=True)
            lineSegments["segmentID"] = lineSegments["segmentID"].astype(str)

        if isinstance(pointsPath, str):
            points = pd.read_csv(pointsPath, index_col="spineID", dtype={
                'spineID': str, 'segmentID': str})
        else:
            points = pointsPath.set_index('spineID', drop=True)
            points["spineID"] = points["spineID"].astype(str)
            points["segmentID"] = points["segmentID"].astype(str)

        lineSegments = toGeoData(lineSegments, ['segment'])
        points = toGeoData(points, ['point', 'anchor'])

        if loader is None:
            if imagePath is None:
                loader = ArrayImageLoader(np.array([]))
            else:
                loader = ArrayImageLoader.imread(imagePath)

        if isinstance(loader, ImageLoaderBuilder):
            loader = loader.build()

        super().__init__(loader, lineSegments, points)
