import warnings
import geopandas as gp
import shapely
from typing import Literal
from benchmark import timer

EventIDs = Literal["edit", "select"]


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

    def on(self, event: EventIDs, key: str):
        self.properties[event] = key
        return self

    def id(self, id: str):
        self.properties["id"] = id
        return self

    def mask(self, by: str = ""):
        self.properties["mask"] = by
        return self

    def source(self, functionName: str, argsNames: list[str]):
        self.properties["source"] = [functionName, argsNames]
        return self

    def __withEvent__(func):
        def wrapped(self, value=True, on=None):
            key = func.__name__
            if on is not None:
                key = on + "." + key
            self.properties[key] = value
            return self
        return wrapped

    def onTranslate(self, id: str):
        self.properties["translate"] = id
        return self

    def fixed(self, fixed: bool = True):
        self.properties["fixed"] = fixed
        return self

    @__withEvent__
    def stroke(self, color: [int, int, int, int], on: EventIDs = None):
        ("implemented by decorator", color, on)
        return self

    @__withEvent__
    def strokeWidth(self, width: int, on: EventIDs = None):
        ("implemented by decorator", width, on)
        return self

    @__withEvent__
    def fill(self, color: [int, int, int, int], on: EventIDs = None):
        ("implemented by decorator", color, on)
        return self

    @__withEvent__
    def opacity(self, opacity: int, on: EventIDs = None):
        ("implemented by decorator", opacity, on)
        return self

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
    def translate(self, translate: gp.GeoSeries = None):
        self.series = self.series.combine(
            translate, lambda g, o: shapely.affinity.translate(g, o.iloc[0, 0], o.iloc[0, 1]))
        return self

    def copy(self, series: gp.GeoSeries = None, id=""):
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
