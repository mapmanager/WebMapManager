import warnings
import geopandas as gp
import pandas as pd
import shapely
from typing import Callable, List, Literal, Self, Tuple, Union
from ..benchmark import timer

EventIDs = Literal["edit", "select"]
Color = Tuple[int, int, int, int]


class DragState:
    START = 0
    DRAGGING = 1
    END = 2


class Layer:
    def __init__(self, series: gp.GeoSeries):
        if isinstance(series, Layer):
            self.series = series.series
            self.properties = series.properties
            return
        self.series = series
        self.series.name = "geo"
        self.series.index.name = "id"
        self.properties = {}

    def on(self, event: EventIDs, key: str) -> Self:
        self.properties[event] = key
        return self

    def id(self, id: str) -> Self:
        self.properties["id"] = id
        return self

    def mask(self, by: str = "") -> Self:
        self.properties["mask"] = by
        return self

    def source(self, functionName: str, argsNames: list[str]) -> Self:
        self.properties["source"] = [functionName, argsNames]
        return self

    def setProperty(func):
        def wrapped(self, value=True):
            key = func.__name__
            self.properties[key] = value
            return self
        return wrapped

    def onDrag(self, func: Callable[[str, int, int, DragState, bool], bool]) -> Self:
        self.properties["drag"] = func
        return self

    def fixed(self, fixed: bool = True) -> Self:
        self.properties["fixed"] = fixed
        return self

    def filter(self, mask: pd.Series) -> Self:
        self.series = self.series[mask]
        return self

    def splitGhost(self, visibleMask: pd.Series, opacity=int) -> List[Self]:
        return [self.copy(id="ghost").filter(~visibleMask).opacity(opacity), self.filter(visibleMask)]

    @setProperty
    def stroke(self, color: Union[Color, Callable[[str], Color]]) -> Self:
        ("implemented by decorator", color)
        return self

    @setProperty
    def strokeWidth(self, width: Union[int, Callable[[str], int]]) -> Self:
        ("implemented by decorator", width)
        return self

    @setProperty
    def fill(self, color: Union[Color, Callable[[str], Color]]) -> Self:
        ("implemented by decorator", color)
        return self

    @setProperty
    def opacity(self, opacity: int) -> Self:
        ("implemented by decorator", opacity)
        return self

    def empty(self) -> bool:
        return self.series.empty

    def _encodeBin(self):
        "abstract"

    def encodeBin(self):
        if len(self.series) == 0:
            return {}

        if "id" not in self.properties:
            warnings.warn("missing id")

        return {
            **self._encodeBin(),
            "properties": self.properties
        }

    @timer
    def translate(self, translate: gp.GeoSeries = None) -> Self:
        self.series = self.series.combine(
            translate, lambda g, o: shapely.affinity.translate(g, o.iloc[0, 0], o.iloc[0, 1]))
        return self

    def copy(self, series: gp.GeoSeries = None, id="") -> Self:
        cls = self.__class__
        result = cls.__new__(cls)
        result.properties = self.properties.copy()
        if len(id) != 0:
            result.properties["id"] = result.properties["id"] + "-" + id
        if series is None:
            result.series = self.series
        else:
            result.series = series
        return result

    def __repr__(self):
        return f"<Layer series:{self.series} properties:{self.properties}>"
