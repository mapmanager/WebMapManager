from typing import List, TypeVar, Union


class RecordLog:
    T = TypeVar('T')
    operations: List[T] = []
    index = -1

    def __init__(self):
        return

    def peak(self) -> Union[T, None]:
        """
        Peeks the next operation to be undone.

        Returns:
            Union[T, None]: The next operation to be undone, or None if there are no more operations to undo.
        """
        if self.index < 0:
            return None

        self.operations = self.operations[:self.index + 1]
        return self.operations[self.index]
        
    def push(self, operation: T):
        """
        Pushes an operation to the log.

        Args:
            operation (T): The operation to be pushed to the log.
        """
        if self.index < len(self.operations) - 1:
            self.operations = self.operations[:self.index + 1]

        self.operations.append(operation)
        self.index += 1

    def undo(self) -> Union[T, None]:
        """
        Undoes the last operation in the log.

        Returns:
            Union[T, None]: The undone operation, or None if there are no more operations to undo.
        """
        if self.index < 0:
            return None

        operation = self.operations[self.index]
        self.index -= 1
        return operation

    def redo(self) -> Union[T, None]:
        """
        Redoes the last undone operation in the log.

        Returns:
            Union[T, None]: The redone operation, or None if there are no more operations to redo.
        """
        if self.index >= len(self.operations) - 1:
            return None

        self.index += 1
        operation = self.operations[self.index]
        return operation
