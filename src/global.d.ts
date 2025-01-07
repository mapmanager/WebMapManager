import { loadPyodide as loadPyodideType, PyodideInterface } from "pyodide";
import { Signal } from "@preact/signals-react";

declare global {
  interface Window {
    loadPyodide: typeof loadPyodideType;
    loaderSignal: Signal<PyPixelSource>;
  }

  var py: PyodideInterface;
}
