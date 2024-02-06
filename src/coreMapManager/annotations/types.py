from typing import TypedDict, Tuple

import numpy as np

SpineId = str

class AnnotationsSelection(TypedDict):
    """
    Represents a selection of annotations.

    Attributes:
      segmentID (str): The ID of the segment.
      spineID (str): The ID of the spine.
    """
    segmentID: str
    spineID: str


class ImageViewSelection(TypedDict):
    """
    Represents the image view state.

    Attributes:
      t (int): the time slot index.
      z (Tuple[int, int]): The visible z slice range.
    """
    t: int
    z: Tuple[int, int]


class AnnotationsOptions(TypedDict):
    """
    Represents the options for annotations.

    Attributes:
      selection (ImageViewSelection): The image view state.
      annotationSelections (AnnotationsSelection): The selected annotations.
      showLineSegments (bool): Flag indicating whether to show line segments.
      showLineSegmentsRadius (bool): Flag indicating whether to show line segment radius.
      showLabels (bool): Flag indicating whether to show labels.
      showAnchors (bool): Flag indicating whether to show anchors.
      showSpines (bool): Flag indicating whether to show spines.
    """
    selection: ImageViewSelection
    annotationSelections: AnnotationsSelection
    showLineSegments: bool
    showLineSegmentsRadius: bool
    showLabels: bool
    showAnchors: bool
    showSpines: bool


class ImageSlice:
    """
    Represents an image slice.
    """

    def __init__(self, image: np.ndarray):
        self._image = image

    def data(self) -> np.ndarray:
        """
        Returns the image data.

        Returns:
          np.ndarray: The image data.
        """
        return self._image

    def extent(self) -> Tuple[int, int]:
        """
        The range of the image data

        Returns:
            Tuple[int, int]: min and max range of the image data
        """
        return (self._image.min(), self._image.max())

    def bins(self, binCount: int = 256) -> [Tuple[int, int]]:
        """
        Calculate the histogram bins for the image.

        Args:
          binCount (int): The number of bins to use for the histogram. Default is 256.

        Returns:
          list: A list of tuples representing the histogram bins. Each tuple contains the bin center and the count.
        """
        counts, bounds = np.histogram(self._image, binCount)
        return [((bounds[i] + bounds[i + 1]) / 2, int(counts[i])) for i in range(0, len(counts))]

