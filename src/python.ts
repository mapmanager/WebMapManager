import { PyProxy } from "pyodide/ffi";
import { ImageViewSelection } from "./components/plugins/ImageView";
// @ts-ignore
import requirements from "./MapManagerCore/requirements.json";

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
  const r = (require as any).context("./MapManagerCore/MapManagerCore", true, /\.py$/);
  for (const key of r.keys()) {
    const content = r(key);
    const path = ("./MapManagerCore" + key.slice(1)) as string;
    createAllParentDirs(path);

    py.FS.writeFile(path, content, {
      encoding: "utf8",
    });
  }

  return py;

  function createAllParentDirs(path: string) {
    const dirs = path.split("/");
    dirs.pop();
    let current = "";
    for (const dir of dirs) {
      current += dir;
      try {
        py.FS.mkdir(current);
      } catch (_) {}
      current += "/";
    }
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
  data(): { toJs: () => Uint16Array };
  extent(): [number, number];
  bins(nBin?: number): [counts: number, means: number][];
}

export interface pyQuery {
  getTitle(): string;
  isCategorical(): boolean;
}

export type pdSeries = any;
export type pdDataFrame = any;

export interface pyPixelSource {
  slices_js(
    time: number,
    channel: number,
    zRange: [number, number]
  ): Promise<pyImageSource>;
  getAnnotations_js(options?: AnnotationsOptions): PyProxy[];

  deleteSpine(spineId: string): void;
  addSpine(
    segmentId: string,
    x: number,
    y: number,
    z: number
  ): string | undefined;

  getSegmentsAndSpines(options: {
    selection: ImageViewSelection;
    filters?: Set<string> | undefined;
    showAll?: boolean;
  }): SegmentsAndSpinesResult;

  getSpinePosition(
    t: number,
    spineID: string
  ): [x: number, y: number, z: number] | undefined;

  queries(): any;
  runQuery(query: pyQuery): Promise<pdSeries>;
  table(): Promise<pdDataFrame>;

  undo(): void;
  redo(): void;
}

const newPixelSource = (await py.runPythonAsync(`
from MapManagerCore.pyodide_main import createAnnotations
createAnnotations
`)) as (srcPath: string) => Promise<pyPixelSource>;

export { newPixelSource };
