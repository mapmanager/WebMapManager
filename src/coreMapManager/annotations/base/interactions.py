from typing import Union
from shapely.geometry import Point
from ...layers.layer import DragState
from .query import QueryAnnotations
from ...layers.utils import roundPoint
from itertools import count


class AnnotationsInteractions(QueryAnnotations):

    def nearestAnchor(self, segmentID: str, point: Point, brightestPath=False):
        """
        Finds the nearest anchor point on a given line segment to a given point.

        Args:
            segmentID (str): The ID of the line segment.
            point (Point): The point to find the nearest anchor to.
            brightestPath (bool, optional): Flag indicating whether to find the brightest path should be used. Defaults to False.

        Returns:
            Point: The nearest anchor point.
        """
        segment = self._lineSegments.loc[segmentID, "segment"]
        anchor = segment.interpolate(segment.project(point))
        anchor = roundPoint(anchor, 1)

        # TODO: find brightest path, needs to be async

        return anchor

    def addSpine(self, segmentId: str, x: int, y: int, z: int) -> Union[str, None]:
        """
        Adds a spine.

        segmentId (str): The ID of the segment.
        x (int): The x coordinate of the spine.
        y (int): The y coordinate of the spine.
        z (int): The z coordinate of the spine.
        """
        point = Point(x, y, z)
        anchor = self.nearestAnchor(segmentId, point, True)
        spineId = self.newUnassignedSpineId()

        self.updateSpine(spineId, {
            "segmentID": segmentId,
            "point": Point(point.x, point.y),
            "z": z,
            "anchor": Point(anchor.x, anchor.y),
            "anchorZ": anchor.z,
            "xBackgroundOffset": 0,
            "yBackgroundOffset": 0,
            "roiExtend": 4,
        })

        return spineId

    def newUnassignedSpineId(self):
        """
        Generates a new unique spine ID that is not assigned to any existing spine.

        Returns:
            str: new spine's ID.
        """
        prefix = "unassigned"

        for index in count(1):
            uid = f"{prefix}_{index}"
            if uid not in self._points.index:
                return uid

    def moveSpine(self, spineId: str, x: int, y: int, z: int, state: DragState = DragState.START) -> bool:
        """
        Moves the spine identified by `spineId` to the given `x` and `y` coordinates.

        Args:
            spineId (str): The ID of the spine to be translated.
            x (int): The x-coordinate of the cursor.
            y (int): The y-coordinate of the cursor.

        Returns:
            bool: True if the spine was successfully translated, False otherwise.
        """
        self.updateSpine(spineId, {
            "point": Point(x, y),
            "z": z,
        }, state != DragState.START)

        return True

    def moveAnchor(self, spineId: str, x: int, y: int, z: int, state: DragState = DragState.START) -> bool:
        """
        Moves the anchor point of a spine to the given x and y coordinates.

        Args:
            spineId (str): The ID of the spine.
            x (int): The x-coordinate of the cursor.
            y (int): The y-coordinate of the cursor.
            state (DragState): The state of the translation.

        Returns:
            bool: True if the anchor point was successfully translated, False otherwise.
        """
        point = self._points.loc[spineId]
        anchor = self.nearestAnchor(point["segmentID"], Point(x, y))

        self.updateSpine(spineId, {
            "anchorZ": anchor.z,
            "anchor": Point(anchor.x, anchor.y),
        }, state != DragState.START)

        return True

    pendingBackgroundRoiTranslation = None

    def translateBackgroundRoi(self, spineId: str, x: int, y: int, z: int, state: DragState = DragState.START) -> bool:
        """
        Translates the background ROI for a given spine ID by the specified x and y offsets.

        Args:
            spineId (str): The ID of the spine.
            x (int): The x-coordinate of the cursor.
            y (int): The y-coordinate of the cursor.
            state (DragState): The state of the translation.

        Returns:
            bool: True if the background ROI was successfully translated, False otherwise.
        """
        point = self._points.loc[spineId]

        if self.pendingBackgroundRoiTranslation is None or state == DragState.START:
            self.pendingBackgroundRoiTranslation = [x, y]

        self.updateSpine(spineId, {
            "xBackgroundOffset": point["xBackgroundOffset"] + x - self.pendingBackgroundRoiTranslation[0],
            "yBackgroundOffset": point["yBackgroundOffset"] + y - self.pendingBackgroundRoiTranslation[1],
        }, state != DragState.START)

        self.pendingBackgroundRoiTranslation = [x, y]

        if state == DragState.END:
            self.pendingBackgroundRoiTranslation = None

        return True

    def moveRoiExtend(self, spineId: str, x: int, y: int, z: int, state: DragState = DragState.START) -> bool:
        """
        Move the ROI extend for a given spine ID.

        Args:
            spineId (str): The ID of the spine.
            x (int): The x-coordinate of the cursor.
            y (int): The y-coordinate of the cursor.
            state (DragState): The state of the translation.

        returns:
            bool: True if the ROI extend was successfully translated, False otherwise.
        """

        point = self._points.loc[spineId, "point"]

        self.updateSpine(spineId, {
            "roiExtend": point.distance(Point(x, y))
        }, state != DragState.START)

        return True

    def moveSegmentRadius(self, segmentId: str, x: int, y: int, z: int, state: DragState = DragState.START) -> bool:
        """
        Move the Radius of a segment by the given x and y coordinates.

        Args:
            segmentId (str): The ID of the segment.
            x (int): The x-coordinate of the cursor.
            y (int): The y-coordinate of the cursor.
            state (DragState): The state of the translation.

        Returns:
            bool: True if the segment was successfully translated, False otherwise.
        """

        anchor = self.nearestAnchor(segmentId, Point(x, y), True)
        self.updateSegment(segmentId, {
            "radius": Point(anchor.x, anchor.y).distance(Point(x, y))
        }, state != DragState.START)

        return True
