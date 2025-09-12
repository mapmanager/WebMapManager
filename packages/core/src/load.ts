import { Signal } from "@preact/signals-react";
import { catchAlertPythonErrors } from "./utils";
import { pyWheelPath } from "./wheel_info.js";
import { loadPyodide, version } from "pyodide";
import { DATA_VERSION } from ".";
import { MapManagerMap, pyMapManagerMap } from "./pyToJsMM";

// abcursor: Pyodide caching for faster development reloads
let pyodideInitialized = false;
let pyodideInstance: any = null;
let newPyMapManager: (srcPath?: string) => pyMapManagerMap;
export const mapSignal = new Signal<MapManagerMap>();

// abcursor: Pre-install all required packages once
const initializePyodide = async () => {
  if (pyodideInitialized && pyodideInstance) {
    return pyodideInstance;
  }

  const py = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
  });

  py.setDebug(import.meta.env.MODE !== "production");
  
  // abcursor: Install all required packages at once
  await py.loadPackage("micropip");
  const micropip = py.pyimport("micropip");
  
  const requiredPackages = [
    "numpy", "pandas", "shapely", "geopandas", 
    "scikit-image", "zarr", "imageio", "matplotlib"
  ];
  
  await micropip.install(requiredPackages);
  
  pyodideInstance = py;
  pyodideInitialized = true;
  return py;
};

/**
 * Load the core of the MapManager
 */
export const loadCore = async () => {
  // abcursor: In development, reuse existing Pyodide instance
  const developmentMode = import.meta.env.MODE === "development";
  
  if (developmentMode && pyodideInstance) {
    globalThis.py = pyodideInstance;
    // abcursor: Only reinstall custom wheel in development
    const micropip = pyodideInstance.pyimport("micropip");
    const coreUrl = new URL(pyWheelPath, window.location.href).href;
    await micropip.install(coreUrl);
    
    newPyMapManager = catchAlertPythonErrors(
      (await pyodideInstance.runPythonAsync(`
      from mapmanagercore.pyodide_main import createAnnotations
      createAnnotations
      `)) as (srcPath?: string) => pyMapManagerMap,
    );
    
    await MapManagerMap.empty();
    return;
  }

  // abcursor: Normal initialization for production or first load
  globalThis.py = await initializePyodide();
  
  // abcursor: Install custom wheel
  const micropip = globalThis.py.pyimport("micropip");
  const coreUrl = new URL(pyWheelPath, window.location.href).href;
  await micropip.install(coreUrl);

  newPyMapManager = catchAlertPythonErrors(
    (await globalThis.py.runPythonAsync(`
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
