import { loadPyodide as loadPyodideType, PyodideInterface } from "pyodide";

declare global {
  interface Window {
    loadPyodide: typeof loadPyodideType;
  }
  var py: PyodideInterface;
}
