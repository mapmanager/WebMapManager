import numpy as np
import shapely
import inspect
import pandas as pd
from typing import Callable, Dict, List
from pandas.util import hash_pandas_object
from copy import copy
from ....benchmark import timer


class Query:
    def __init__(self, title: str, func: Callable[[], pd.Series], categorical: bool = False, idx: int = None):
        self.title = title
        self.categorical = categorical
        self.isAsync = inspect.iscoroutinefunction(func)
        self.func = func
        self.idx = idx

    @timer
    async def runWith(self, annotations, insureCached=False) -> pd.Series:
        if self.isAsync:
            result = await self.func(annotations, insureCached=insureCached)
        else:
            result = self.func(annotations, insureCached=insureCached)

        if insureCached:
            return
        return result if self.idx is None else result[self.idx]

    def isCategorical(self) -> bool:
        return self.categorical

    def getTitle(self) -> str:
        return self.title


PLOT_ABLE_QUERIES: List[Query] = []
QUERIES: List[Query] = []
QUERIES_MAP: Dict[str, Query] = {}


def queryable(title: str = None, titles: List[str] = None, categorical: bool = False, dependencies: List[str] = None, segmentDependencies: List[str] = None, plotAble: bool = True):
    def wrapper(func):
        fullTitle = title
        if fullTitle is None:
            fullTitle = func.__name__

        key = func.__name__
        depKey = key + ".deps"
        modKey = key + ".m"
        isAsync = inspect.iscoroutinefunction(func)

        if dependencies is not None or segmentDependencies is not None:
            deps = dependencies or []
            if isAsync:
                async def callCached(self, insureCached=False):
                    # Look for changes using the mod date (fast)
                    [newModDate, invalid] = _invalidEntriesModDate(
                        self, modKey, segmentDependencies)

                    # Fall back to comparing hashes (slow)
                    if newModDate is not None:
                        # insure dependencies are computed
                        for dep in deps:
                            if dep in QUERIES_MAP:
                                await QUERIES_MAP[dep].runWith(self, insureCached=True)

                        [missing, newHashes] = _withInvalidEntriesHash(
                            self, depKey, invalid, deps, segmentDependencies)

                        missingIndex = newHashes.index

                        if missing is not None:
                            # compute missing values
                            results = await func(missing)

                            _updateMissingValues(
                                self, key, titles, results, missingIndex, depKey, newHashes)

                        if newModDate is not None:
                            self._points.loc[missingIndex, modKey] = newModDate

                    if insureCached:
                        return

                    return _getResults(self, key, titles)
            else:
                def callCached(self, insureCached=False):
                    # Look for changes using the mod date (fast)
                    [newModDate, invalid] = _invalidEntriesModDate(
                        self, modKey, segmentDependencies)

                    # Fall back to comparing hashes (slow)
                    if newModDate is not None:
                        # insure dependencies are computed
                        for dep in deps:
                            if dep in QUERIES_MAP:
                                QUERIES_MAP[dep].func(self, insureCached=True)

                        [missing, newHashes] = _withInvalidEntriesHash(self,
                                                                       depKey, invalid, deps, segmentDependencies)

                        missingIndex = newHashes.index

                        if missing is not None:
                            # compute missing values
                            results = func(missing)
                            _updateMissingValues(
                                self, key, titles, results, missingIndex, depKey, newHashes)

                        if newModDate is not None:
                            self._points.loc[missingIndex, modKey] = newModDate

                    if insureCached:
                        return

                    return _getResults(self, key, titles)

            finalFunc = callCached
        else:
            def finalFunc(self, insureCached=False):
                return func(self)

        query = Query(fullTitle, finalFunc, categorical)
        QUERIES_MAP[key] = query

        if titles is not None:
            for i, ti in enumerate(titles):
                query = Query(ti, finalFunc, categorical, idx=i)
                if plotAble:
                    PLOT_ABLE_QUERIES.append(query)

                QUERIES.append(query)
        else:
            if plotAble:
                PLOT_ABLE_QUERIES.append(query)
            QUERIES.append(query)

        return finalFunc
    return wrapper

@timer
def _updateMissingValues(self, key, titles, results, missingIndex, depKey, newHashes):
    if titles is not None:
        for i, r in enumerate(results):
            self._points.loc[missingIndex, f"{key}.{i}"] = r
    else:
        self._points.loc[missingIndex, key] = results
    self._points.loc[missingIndex, depKey] = newHashes

@timer
def _getResults(self, key, titles):
    if titles is not None:
        results = []
        for i, _ in enumerate(titles):
            results.append(self._points[f"{key}.{i}"])
        return results

    return self._points[key]

@timer
def _invalidEntriesModDate(self, modKey: str, segmentDependencies: List[str] = None):
    # opt avoid the cost of a hash by checking the modified data
    newModDate = self._points["modified"]
    if segmentDependencies is not None:
        newModDate = np.maximum(
            self._lineSegments["modified"][self._points["segmentID"]].values, newModDate)

    invalid = None
    if modKey in self._points:

        invalid = self._points[modKey] != newModDate
        if invalid.any() == 0:
            return [None, None]

    return [newModDate, invalid]


@timer
def _withInvalidEntriesHash(self, depKey: str, invalid, dependencies: List[str], segmentDependencies: List[str] = None):
    # check for changes using the hash of the dependencies
    if invalid is not None:
        df = df[invalid]

    df = self._points.loc[:, self._points.columns.intersection(
        dependencies).union(["segmentID"])]

    if segmentDependencies is not None:
        segmentsHash = hash_pandas_object(
            self._lineSegments[self._lineSegments.columns.intersection(segmentDependencies)], index=False)
        df["segmentHash"] = segmentsHash[df["segmentID"]].values

    hash = hash_pandas_object(df, index=False)
    if depKey in self._points:
        invalid = self._points.loc[hash.index, depKey] != hash
        hash = hash[invalid]

    if hash.shape[0] == 0:
        return [None, None]

    # create a copy of the annotations that needs to be updated
    selfCopy = copy(self)
    selfCopy._points = selfCopy._points.loc[hash.index]
    return [selfCopy, hash]


# bug fix for shapely hash
shapely.geometry.base.BaseGeometry.__hash__ = lambda x: hash(x.wkb)
