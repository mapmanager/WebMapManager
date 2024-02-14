from __future__ import annotations
from enum import Enum
from typing import Generic, List, Union, TypeVar
import pandas as pd

T = TypeVar('T')


class Op(Generic[T]):
    type: T
    diff: pd.DataFrame
    id: str

    def __init__(self, id: str, type: T, diff: pd.DataFrame):
        self.type = type
        self.diff = diff
        self.id = id

    def update(self, operation: Op) -> bool:
        if self.type != operation.type or self.id != operation.id:
            return False
        for key, val in operation.diff["after"].items():
            self.diff["after"][key] = val
        return True


class RecordLog(Generic[T]):
    operations: List[Op[T]]

    def __init__(self):
        self.operations = []
        self.index = -1
        self.replaceable = False
        return

    def createState(self):
        self.replaceable = False

    def _peakReplaceable(self) -> Union[Op[T], None]:
        """
        Peeks the next operation to be undone if replaceable.

        Returns:
            Union[Op[T], None]: The next operation to be undone, or None if there are no more operations to undo.
        """
        if self.index < 0 or not self.replaceable:
            return None

        self.operations = self.operations[:self.index + 1]
        return self.operations[self.index]

    def push(self, operation: Op[T], replace=False):
        """
        Pushes an operation to the log.

        Args:
            operation (T): The operation to be pushed to the log.
        """

        if replace:
            # replace the last operation in the log
            peak = self._peakReplaceable()
            if peak is not None and peak.update(operation):
                return

        if self.index < len(self.operations) - 1:
            self.operations = self.operations[:self.index + 1]

        self.operations.append(operation)
        self.index += 1
        self.replaceable = True

    def undo(self) -> Union[Op[T], None]:
        """
        Undoes the last operation in the log.

        Returns:
            Union[Op[T], None]: The undone operation, or None if there are no more operations to undo.
        """
        self.replaceable = False
        if self.index < 0:
            return None

        operation = self.operations[self.index]
        self.index -= 1
        return operation

    def redo(self) -> Union[Op[T], None]:
        """
        Redoes the last undone operation in the log.

        Returns:
            Union[Op[T], None]: The redone operation, or None if there are no more operations to redo.
        """
        self.replaceable = False
        if self.index >= len(self.operations) - 1:
            return None

        self.index += 1
        operation = self.operations[self.index]
        return operation
