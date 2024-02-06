from typing import Union
from shapely.geometry import Point
from ...layers.utils import roundPoint
from itertools import count
from .base_mutation import AnnotationsBaseMut


class AnnotationsInteractions(AnnotationsBaseMut):

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
            "anchor": Point(anchor.x, anchor.y),
            "z": anchor.z,
            "xBackgroundOffset": 0,
            "yBackgroundOffset": 0
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

    def translateSpine(self, spineId: str, x: int, y: int, first: bool) -> bool:
        """
        Translates the spine identified by `spineId` by the given `x` and `y` coordinates.

        Args:
            spineId (str): The ID of the spine to be translated.
            x (int): The x-coordinate of the translation.
            y (int): The y-coordinate of the translation.

        Returns:
            bool: True if the spine was successfully translated, False otherwise.
        """
        self.updateSpine(spineId, {
            "point": Point(x, y)
        }, not first)

        return True

    def translateAnchor(self, spineId: str, x: int, y: int, first: bool) -> bool:
        """
        Translates the anchor point of a spine by the given x and y coordinates.

        Args:
            spineId (str): The ID of the spine.
            x (int): The x-coordinate of the translation.
            y (int): The y-coordinate of the translation.
            first (bool): Indicates whether the translation just started.

        Returns:
            bool: True if the anchor point was successfully translated, False otherwise.
        """
        point = self._points.loc[spineId]
        anchor = self.nearestAnchor(point["segmentID"], Point(x, y))

        self.updateSpine(spineId, {
            "z": anchor.z,
            "anchor": Point(anchor.x, anchor.y),
        }, not first)

        return True

    pendingBackgroundRoiTranslation = None

    def translateBackgroundRoi(self, spineId: str, x: int, y: int, first: bool) -> bool:
        """
        Translates the background ROI for a given spine ID by the specified x and y offsets.

        Args:
            spineId (str): The ID of the spine.
            x (int): The x-coordinate of the translation.
            y (int): The y-coordinate of the translation.

        Returns:
            bool: True if the background ROI was successfully translated, False otherwise.
        """
        point = self._points.loc[spineId]

        if not first:
            self.updateSpine(spineId, {
                "xBackgroundOffset": point["xBackgroundOffset"] + x - self.pendingBackgroundRoiTranslation[0],
                "yBackgroundOffset": point["yBackgroundOffset"] + y - self.pendingBackgroundRoiTranslation[1],
            }, not first)

        self.pendingBackgroundRoiTranslation = [x, y]

        return not first

    def translateRoiExtend(self, spineId: str, x: int, y: int, first: bool) -> bool:
        """
        Translates the ROI extend for a given spine ID.
        """

        point = self._points.loc[spineId, "point"]

        self.updateSpine(spineId, {
            "roiExtend": point.distance(Point(x, y))
        }, not first)

        return True

    def translateSegmentRadius(self, segmentId: str, x: int, y: int, first: bool) -> bool:
        """
        Translates the Radius of a segment by the given x and y coordinates.

        Args:
            segmentId (str): The ID of the segment.
            x (int): The x-coordinate of the translation.
            y (int): The y-coordinate of the translation.
            first (bool): Indicates whether the translation just started.

        Returns:
            bool: True if the segment was successfully translated, False otherwise.
        """

        anchor = self.nearestAnchor(segmentId, Point(x, y), True)
        self.updateSegment(segmentId, {
            "radius": Point(anchor.x, anchor.y).distance(Point(x, y))
        }, not first)

        return True
