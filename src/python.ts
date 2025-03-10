import { PyProxy } from "pyodide/ffi";
import { ZRange } from "./components/plugins/ImageView";
import { Position, PyPixelSource } from "./loaders/py_loader";
import wheelInfo from "./wheel_info.json";
import { Signal } from "@preact/signals-react";

export const extractPythonError = (e: any) => {
  console.error(e);
  if (e instanceof py.ffi.PythonError) {
    const type = e.type;
    const message = e.message.split(type).pop()?.slice(2, -1);
    alert(message);
  }
};

export const catchAlertPythonErrors = <T extends any[], U>(
  fn: (...args: T) => U,
  returnFalseOnError = false
) => {
  return (...args: T): U => {
    try {
      return fn(...args);
    } catch (e) {
      extractPythonError(e);
      if (returnFalseOnError) return false as any;
      throw e;
    }
  };
};

export function wrapCatchProxyErrors<T extends object>(proxy: T): T {
  return new Proxy(proxy, {
    get(target, prop, receiver) {
      const output = Reflect.get(target, prop, receiver);
      if (typeof output === "function") {
        return catchAlertPythonErrors(output as any, true);
      }
      return output;
    },
  });
}

// Load python
let newPixelSource: (srcPath?: string) => pyPixelSource;
export const loadPyodide = async () => {
  globalThis.py = await window.loadPyodide().then(async (py) => {
    py.setDebug(import.meta.env.MODE !== "production");
    await py.loadPackage("micropip");
    const micropip = py.pyimport("micropip");
    const coreUrl = new URL(
      `${import.meta.env.BASE_URL}/py/${wheelInfo.fileName}`,
      window.location.href
    ).href;
    await micropip.install(coreUrl);

    return py;
  });

  newPixelSource = catchAlertPythonErrors(
    (await py.runPythonAsync(`
    from mapmanagercore.pyodide_main import createAnnotations
    createAnnotations
    `)) as (srcPath?: string) => pyPixelSource
  );

  // Autosave
  window.loaderSignal = new Signal<PyPixelSource>();
  await PyPixelSource.empty();
};

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
  get(key: "color"): [number, number, number];
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

export interface pyImageChannel extends pyImageSource {
  deleteChannel(): void;
  loadChannel(): Promise<void>;
  loadChannelDrop({
    dataTransfer,
  }: {
    dataTransfer: {
      files: FileList;
    };
  }): Promise<void>;
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
  setSegmentColor(spineId: number, color: [number, number, number]): void;
  loadFile(path: string, channel?: number, name?: string): void;
  
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
  deleteChannel(channel: number): boolean;

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
  analysisParams_js(): string;
  setAnalysisParams(key: string, value: any): any;

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
    destChannel: number
  ): any;

  moveTimePoint(
    srcTimePoint: number,
    destTimePoint: number,
    dropNodePosition: Position
  ): any;
  createTimePoint(): any;
  dataTree(): any;
  nextSpine(spineId: number, offset: 1 | -1): number | undefined;
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
  setMaxChannels(maxChannels: number): any;
}

export { newPixelSource };
