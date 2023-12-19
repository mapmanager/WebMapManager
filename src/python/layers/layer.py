import geopandas as gp
from typing import Literal

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

        return {
            **self._encodeBin(),
            "properties": self.properties
        }

    def copy(self, series: gp.GeoSeries = None):
        cls = self.__class__
        result = cls.__new__(cls)
        if series is None:
            result.series = self.series
        else:
            result.series = series
        result.properties = self.properties.copy()
        return result

    def __repr__(self):
        return f"<Layer series:{self.series} properties:{self.properties}>"
