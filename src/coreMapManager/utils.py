import asyncio
import numpy as np
import pandas as pd
from shapely import wkt
import geopandas as gp

# def ToJs(func):
#     """
#     Crates a js wrapper for the given function.
#     """
#     def toJs(*args, **kwargs):
#         return to_js(func(*args, **kwargs))

#     setattr(func.__self__.__class__, func.__name__ + '_js', toJs)
#     return func


def sync(cls):
    """
    Decorator that injects a synchronous version of asynchronous functions.
    Synchronous functions are named by postfixed with '_sync'.
    """
    methods = [(name, method) for name, method in cls.__dict__.items(
    ) if asyncio.iscoroutinefunction(method)]
    for name, method in methods:
        def wrapped(self, *args, **kwargs):
            return asyncio.run(method(self, *args, **kwargs))

        setattr(cls, f"{name}_sync", wrapped)
    return cls


def toGeoData(data: pd.DataFrame, geometryCols: [str]):
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
