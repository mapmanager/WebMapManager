from typing import TypedDict, Tuple, Union

Color = Union[Tuple[int, int, int], Tuple[int, int, int, int]]

class Colors(TypedDict):
    selectedSpine: Color
    spine: Color
    anchorLine: Color
    label: Color
    roiHead: Color
    roiBase: Color
    roiHeadBg: Color
    roiBaseBg: Color
    backgroundRoiHead: Color
    backgroundRoiBase: Color
    segment: Color
    segmentSelected: Color
    segmentEditing: Color
    intractable: Color


TRANSPARENT = [0, 0, 0, 0]


class Config(TypedDict):
    colors: Colors
    ghostOpacity: int
    labelExtension: int
    segmentBoldWidth: int
    segmentWidth: int
    segmentLeftRightStrokeWidth: int
    roiStrokeWidth: int
    pointRadius: int
    pointRadiusEditing: int
    labelOffset: int


CONFIG: Config = {
    "colors": {
        "selectedSpine": [0, 255, 255],
        "spine": [255, 0, 0],
        "anchorPoint": [0, 0, 255],
        "anchorLine": [0, 0, 255],
        "label": [255, 255, 255],
        "roiHead": [255, 255, 0],
        "roiBase": [255, 100, 0],
        "roiHeadBg": [255, 255, 0],
        "roiBaseBg": [255, 100, 0],
        "backgroundRoiHead": [255, 255, 255],
        "backgroundRoiBase": [255, 100, 255],
        "segment": [255, 0, 0],
        "segmentSelected": [0, 255, 255],
        "segmentEditing": [0, 255, 0],
        "intractable": [0, 255, 0],
    },
    "ghostOpacity": 255 * 0.5,
    "labelExtension": 6,
    "segmentBoldWidth": 4,
    "segmentWidth": 2,
    "segmentLeftRightStrokeWidth": 0.5,
    "roiStrokeWidth": 0.5,
    "pointRadius": 2,
    "pointRadiusEditing": 5,
    "labelOffset": 6
}

COLORS = CONFIG["colors"]
