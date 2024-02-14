from typing import Union
import geopandas as gp
import numpy as np
import pandas as pd
from ..types import SpineId
from ...log import Op, RecordLog
from enum import Enum
from .base import AnnotationsBase


class AnnotationType(Enum):
    Point = 1
    LineSegment = 2


class AnnotationsBaseMut(AnnotationsBase):
    _log: RecordLog[AnnotationType]

    def __init__(self, loader: gp.GeoDataFrame, points: gp.GeoDataFrame, lineSegments: gp.GeoDataFrame):
        super().__init__(loader, points, lineSegments)
        self._log = RecordLog()

    #  TODO: create from log: withLog(self, loader: ImageLoader, log: RecordLog):

    def undo(self):
        """
        Undo the last operation.
        """
        op = self._log.undo()
        if op is None:
            return

        self._update(op.type, op.id, op.diff["before"], skipLog=True)

    def redo(self):
        """
        Redo the last undone operation.
        """
        op = self._log.redo()
        if op is None:
            return

        self._update(op.type, op.id, op.diff["after"], skipLog=True)

    def _getDf(self, type: AnnotationType) -> gp.GeoDataFrame:
        return {
            AnnotationType.Point: self._points,
            AnnotationType.LineSegment: self._lineSegments
        }[type]

    def deleteSpine(self, spineId: SpineId, skipLog=False) -> None:
        self._delete(AnnotationType.Point, spineId, skipLog=skipLog)

    def deleteSegment(self, segmentId: str, skipLog=False) -> None:
        self._delete(AnnotationType.LineSegment, segmentId, skipLog=skipLog)

    def _delete(self, type: AnnotationType, id: SpineId, skipLog=False) -> None:
        """
        Deletes a spine or segment.

        Args:
          Id (str): The ID of the spine or segment.
        """
        df = self._getDf(type)
        if not skipLog:
            self._log.push(Op(id, type, pd.DataFrame({
                "before": df.loc[id].copy(),
                "after": pd.Series()
            })))

        df.drop(id, inplace=True)

    def updateSpine(self, spineId: str, value: Union[dict, gp.GeoSeries, pd.Series], replaceLog=False, skipLog=False):
        """
        Set the spine with the given ID to the specified value.

        Parameters:
            spineId (str): The ID of the spine.
            value (Union[dict, gp.Series, pd.Series]): The value to set for the spine.
        """
        return self._update(AnnotationType.Point, spineId, value, replaceLog, skipLog)

    def updateSegment(self, segmentId: str, value: Union[dict, gp.GeoSeries, pd.Series], replaceLog=False, skipLog=False):
        """
        Set the segment with the given ID to the specified value.

        Parameters:
            segmentId (str): The ID of the spine.
            value (Union[dict, gp.Series, pd.Series]): The value to set for the spine.
        """
        return self._update(AnnotationType.LineSegment, segmentId, value, replaceLog, skipLog)

    def _update(self, type: AnnotationType, id: str, value: Union[dict, gp.GeoSeries, pd.Series], replaceLog=False, skipLog=False):
        df = self._getDf(type)

        if isinstance(value, dict):
            value = pd.Series(value)

        if id in df.index:
            # merge the new value with the old one
            original = df.loc[id]
            updated = original.copy()

            for key, val in value.items():
                updated[key] = val

            # delete if the value is empty
            if updated.drop("modified").dropna().empty:
                return self._delete(type, id, skipLog=skipLog)

            df.loc[id] = updated

            # create a diff of the changes
            diff = original.compare(updated)
            diff.rename(columns={"self": "before",
                        "other": "after"}, inplace=True)
        else:
            # add a new value
            df.loc[id] = value
            diff = pd.DataFrame({
                "before": pd.Series(),
                "after": df.loc[id].copy()
            })

        df.loc[id, "modified"] = np.datetime64("now")

        if skipLog:
            return

        # Add the operation to the log
        if diff.empty:
            if replaceLog:
                return
            
            diff = pd.DataFrame({
                "before": value,
                "after": value,
            })

            if diff.empty:
                self._log.createState()
                return


        self._log.push(Op(id, type, diff), replace=replaceLog)
