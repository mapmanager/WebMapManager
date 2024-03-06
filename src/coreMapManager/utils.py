import asyncio
import inspect
import traceback
from typing import List
import numpy as np
import pandas as pd
from shapely import wkt
import geopandas as gp
from shapely.geometry import Polygon
import skimage.draw

USE_ASYNC = False

try:
    import pyodide
    USE_ASYNC = True
except ImportError as e:
    import nest_asyncio
    nest_asyncio.apply()
    pass


def isCoreMapManager():
    """
    Returns true if the caller is in the coreMapManager module.
    """
    frm = inspect.stack()[2]
    mod = inspect.getmodule(frm[0])
    if mod == None:
        return False
    return "coreMapManager" in mod.__name__


def wrapAsync(method):
    def wrapped(self, *args, **kwargs):
        result = method(self, *args, **kwargs)
        if isCoreMapManager():
            # If the caller is in the coreMapManager module, then we return the
            # async version for the module ot await.
            return result
        return asyncio.run(result)
    return wrapped


def sync(cls):
    """
    Converts all async methods in the given class to sync methods.
    If the async flag is false
    """

    if USE_ASYNC:
        return cls

    for name, method in cls.__dict__.items():
        if not asyncio.iscoroutinefunction(method):
            continue

        wrapped = wrapAsync(method)

        # Replace the async method with the sync method
        setattr(cls, name, wrapped)

    return cls


def toGeoData(data: pd.DataFrame, geometryCols: List[str]):
    """
    Reads a CSV file with geometry columns from the given path into a geopandas GeoDataFrame.

    Args:
        path (str): The path to the CSV file.
        geometryCols (list): The list of column names containing geometry data.

    Returns:
        gp.GeoDataFrame: The loaded CSV data as a geopandas GeoDataFrame.
    """
    for column in geometryCols:
        data[column] = data[column].apply(wkt.loads)
    return gp.GeoDataFrame(data, geometry=geometryCols[0])


def filterMask(d, index_filter):
    if index_filter == None or len(index_filter) == 0:
        return np.full(len(d), False)
    return ~d.isin(index_filter)


def polygonIndexes(d: Polygon):
    x, y = zip(*d.exterior.coords)
    return skimage.draw.polygon(x, y)
