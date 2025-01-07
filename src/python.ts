import { PyProxy } from "pyodide/ffi";
import { ZRange } from "./components/plugins/ImageView";
// @ts-ignore
import requirements from "./MapManagerCore/requirements.json";
import { Position } from "./loaders/py_loader";

// Load python
globalThis.py = await window.loadPyodide().then(async (py) => {
  py.setDebug("production" !== process.env.NODE_ENV);
  if (requirements.micropip.length > 0) {
    requirements.loadPackage.push("micropip");
  }
  await py.loadPackage(requirements.loadPackage);
  if (requirements.micropip.length > 0) {
    const micropip = py.pyimport("micropip");
    await micropip.install(requirements.micropip);
  }

  // preloads all python files in the py dir to pyodide.
  const r = (require as any).context(
    "./MapManagerCore/mapmanagercore",
    true,
    /\.py$/
  );
  for (const key of r.keys()) {
    const content = r(key);
    const path = ("./mapmanagercore" + key.slice(1)) as string;
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
  filters?: Set<number>;
  zRange: ZRange;
  annotationSelections: Record<string, number | undefined>;

  // View toggles
  showLineSegments?: boolean;
  showLineSegmentsOrigin?: boolean;
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

export interface ColumnAttributes {
  title: string;
  group: string;
  categorical: boolean;
  divergent: boolean;
  description: string;
  key: string;
  plot: boolean;
}

export interface pyPixelSourceTimePoint {
  getAnnotations_js(options?: AnnotationsOptions): PyProxy[];
  metadata_json(): string;
  slices_js(channel: number, zRange: [number, number]): Promise<pyImageSource>;
  deleteSpine(spineId: number): void;
  deleteSegment(spineId: number): void;

  addSpine(
    segmentId: number,
    x: number,
    y: number,
    z: number
  ): number | undefined;

  setSegmentOrigin(
    segmentId: number,
    x: number,
    y: number,
    z: number
  ): number | undefined;

  newSegment(): number;

  shape: any;

  getSegmentsAndSpines(options: {
    zRange: ZRange;
    filters?: Set<number> | undefined;
    showAll?: boolean;
  }): SegmentsAndSpinesResult;

  getSpinePosition(
    spineID: number
  ): [x: number, y: number, z: number] | undefined;

  columnsAttributes_json(): string;
  getColumn(name: string): Promise<pdSeries>;
  table(): Promise<pdDataFrame>;

  undo(): void;
  redo(): void;

  onDelete(): boolean;
}

export interface pyPixelSource {
  timePoint_js(timePoint: number): pyPixelSourceTimePoint;
  metadata_json(timePoint: number): string;

  columnsAttributes_json(): string;
  getColumn(name: string): Promise<pdSeries>;
  getColors(name?: string): Promise<pdSeries>;
  getSymbols(name?: string): Promise<pdSeries>;
  mergeFile(
    path: string,
    timePoint: number | undefined,
    channel: number | undefined,
    name: string | undefined,
    dropNodePosition: Position | undefined
  ): Promise<void>;
  table(): Promise<pdDataFrame>;

  undo(): void;
  redo(): void;

  save(path: string): void;

  appendChannelToTimePoint(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number
  ): any;

  moveChannel(
    srcTimePoint: number,
    srcChannel: number,
    destTimePoint: number,
    destChannel: number,
  ): any;

  moveTimePoint(
    srcTimePoint: number,
    destTimePoint: number,
    dropNodePosition: Position
  ): any;
  createTimePoint(): any;
  dataTree(): any;
  deleteTimePoint(timePoint: number): any;
  deleteChannel(timePoint: number, channel: number): any;
  updateChannel(
    timePoint: number,
    channel: number,
    updates: Record<string, any>
  ): any;
  updateTimePoint(timePoint: number, updates: Record<string, any>): any;
  maxChannels(): any;
  timePoints_js(): any;
  setMaxChannels(maxChannels: number): any;
}

const newPixelSource = (await py.runPythonAsync(`
from mapmanagercore.pyodide_main import createAnnotations
createAnnotations
`)) as (srcPath?: string) => Promise<pyPixelSource>;

export { newPixelSource };
