import { Signal } from "@preact/signals-react";
import { catchAlertPythonErrors } from "./utils";
import { pyWheelPath } from "./wheel_info.js";
import { loadPyodide, version } from "pyodide";
import { DATA_VERSION } from ".";
import { MapManagerMap, pyMapManagerMap } from "./pyToJsMM";

// Load python
let newPyMapManager: (srcPath?: string) => pyMapManagerMap;
export const mapSignal = new Signal<MapManagerMap>();

/**
 * Load the core of the MapManager
 */
export const loadCore = async () => {
  globalThis.py = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
  }).then(async (py) => {
    py.setDebug(import.meta.env.MODE !== "production");
    await py.loadPackage("micropip");
    const micropip = py.pyimport("micropip");
    const coreUrl = new URL(pyWheelPath, window.location.href).href;

    await micropip.install(coreUrl);

    return py;
  });

  newPyMapManager = catchAlertPythonErrors(
    (await py.runPythonAsync(`
    from mapmanagercore.pyodide_main import createAnnotations
    createAnnotations
    `)) as (srcPath?: string) => pyMapManagerMap,
  );

  // Autosave
  await MapManagerMap.empty();
};

window.addEventListener("beforeunload", (event) => {
  const map = mapSignal.peek();
  if (!map) return;
  if (MapManagerMap.lastSaved.peek() < DATA_VERSION.peek()) {
    event.preventDefault();
    return "You have attempted to leave this page without saving your changes.";
  }
});

export { newPyMapManager };
