import { ImageViewSelection } from "../components/plugins/ImageView";
// @ts-ignore
import mainPy from "./main.py";
// @ts-ignore
import requirements from "./requirements.json";

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
  return py;
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
  getAnnotationsGeoJson(options?: AnnotationsOptions): string[];

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

const newPixelSource = (await py.runPythonAsync(mainPy)) as (
  srcPath: string
) => Promise<pyPixelSource>;

export { newPixelSource };
