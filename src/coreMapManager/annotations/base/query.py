from .layers import AnnotationsLayers
from ..types import AnnotationsOptions
from ...layers.utils import inRange
from ...utils import filterMask


class QueryAnnotations(AnnotationsLayers):
    def getSegmentsAndSpines(self, options: AnnotationsOptions):
        z_range = options['selection']['z']
        index_filter = options["filters"]
        segments = []

        for (segmentID, points) in self._points.groupby("segmentID"):
            spines = points.index.to_frame(name="id")
            spines["type"] = "Start"
            spines["invisible"] = ~ inRange(points["z"], z_range)
            spines["invisible"] = spines["invisible"] & ~ filterMask(
                points.index, index_filter)

            segments.append({
                "segmentID": segmentID,
                "spines": spines.to_dict('records')
            })

        return segments

    def getSpinePosition(self, t: int, spineID: str):
        return list(self._points.loc[spineID, "point"].coords)[0]
