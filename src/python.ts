import { PyProxy } from "pyodide/ffi";
import { ImageViewSelection } from "./components/plugins/ImageView";
// @ts-ignore
import requirements from "./python/requirements.json";

// Load python
globalThis.py = await window.loadPyodide({}).then(async (py) => {
  if (requirements.micropip.length > 0) {
    requirements.loadPackage.push("micropip");
  }

  await py.loadPackage(requirements.loadPackage);
  if (requirements.micropip.length > 0) {
    const micropip = py.pyimport("micropip");
    await micropip.install(requirements.micropip);
  }

  // preloads all python files in the py dir to pyodide.
  const r = (require as any).context("./python", true, /\.py$/);
  for (const key of r.keys()) {
    const content = r(key);
    const path = key.slice(2) as string;

    const parent = parentDir(path);
    if (parent.length) {
      try {
        py.FS.mkdir(parent);
      } catch (_) {}
    }

    py.FS.writeFile(key.slice(2), content, {
      encoding: "utf8",
    });
    console.log("loaded python file: " + key);
  }

  return py;

  function parentDir(path: string) {
    return path.split("/").slice(0, -1).join("/");
  }
});

export interface AnnotationsOptions {
  filters?: Set<string>;
  selection: ImageViewSelection;
  annotationSelections: Record<string, string | undefined>;

  // View toggles
  showLineSegments?: boolean;
  showLineSegmentsRadius?: boolean;
  showLabels?: boolean;
  showAnchors?: boolean;
  showSpines?: boolean;
}

export type SegmentsAndSpinesResult = {
  get(key: "segmentID"): string;
  get(key: "spines"): {
    get(key: "id"): string;
    get(key: "type"): "Start" | "End" | "";
    get(key: "invisible"): boolean;
  }[];
}[];

export interface pyImageSource {
  data(): Uint16Array;
  extent(): [number, number];
  bins(nBin?: number): [counts: number, means: number][];
}

export interface pyPixelSource {
  slices(
    time: number,
    channel: number,
    zLow: number,
    zHigh: number
  ): Promise<pyImageSource>;
  getAnnotationsGeoJson(options?: AnnotationsOptions): PyProxy[];

  deleteSpine(spineId: string): void;
  translate(
    editId: string,
    geometry: object,
    x: number,
    y: number,
    finished: boolean
  ): boolean;

  addSpine(segmentId: string, x: number, y: number, z: number): string | undefined;

  getSegmentsAndSpines(options: {
    selection: ImageViewSelection;
    filters?: Set<string> | undefined;
    showAll?: boolean;
  }): SegmentsAndSpinesResult;
  getSpinePosition(options: {
    t: number;
    spineID: string;
  }): [x: number, y: number, z: number] | undefined;
}

const newPixelSource = (await py.runPythonAsync(`
from main import newPixelSource
newPixelSource
`)) as (srcPath: string) => Promise<pyPixelSource>;

export { newPixelSource };
