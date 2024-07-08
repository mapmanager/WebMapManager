import type { PixelData } from "@vivjs/types/src/index";
import {
  AnnotatedPixelSource,
  RasterSelection,
  ViewSelection,
} from "./annotations";
import {
  AnnotationsOptions,
  ColumnAttributes,
  SegmentsAndSpinesResult,
  newPixelSource,
  pdDataFrame,
  pdSeries,
  pyImageSource,
  pyPixelSource,
  pyPixelSourceTimePoint,
} from "../python";
import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import { ZRange } from "../components/plugins/ImageView";
import type { PyProxy } from "pyodide/ffi";
import { ImageSource } from "../components/utils";

export class PyPixelSourceTimePoint extends AnnotatedPixelSource {
  #proxy: pyPixelSourceTimePoint;
  #empty?: Uint16Array;

  constructor(proxy: pyPixelSourceTimePoint) {
    const defaultStatNames = ["x", "y", "z"];
    super(defaultStatNames);
    this.#proxy = proxy;
  }

  get shape(): [number, number, number, number] {
    return this.#proxy.shape.toJs();
  }

  async getRaster(selection: RasterSelection): Promise<PixelData> {
    try {
      if (!(selection.selection as any).raster) {
        const src = await this.source(selection.selection);
        if (!src) {
          (selection.selection as any).raster = {
            data: this.empty(),
            width: this.tileSize,
            height: this.tileSize,
          };
        } else {
          (selection.selection as any).raster = {
            data: src.data().toJs(),
            width: this.tileSize,
            height: this.tileSize,
          };
        }
      }
      return (selection.selection as any).raster;
    } catch (e) {
      if (selection.signal && selection.signal.aborted) throw SIGNAL_ABORTED;
      throw e;
    }
  }

  public async source(
    selection: ViewSelection
  ): Promise<pyImageSource | undefined> {
    if (!(selection as any).src) {
      const [low, high] = PyPixelSourceTimePoint.selectedZRange(
        selection as any
      );
      const len = high - low;
      const { c } = selection;

      // Don't fetch empty/disabled channels
      if (len <= 0) return undefined;
      (selection as any).src = await this.#proxy.slices_js(c, [low, high]);
    }
    return (selection as any).src;
  }

  getTile(sel: RasterSelection): Promise<PixelData> {
    return this.getRaster(sel);
  }

  onTileError(err: Error) {
    console.error(err);
  }

  empty(): Uint16Array {
    if (!this.#empty) {
      this.#empty = new Uint16Array(this.tileSize * this.tileSize * 2);
    }

    return this.#empty;
  }

  getAnnotations(options?: AnnotationsOptions): PyProxy[] {
    return this.#proxy.getAnnotations_js(options);
  }

  getSegmentsAndSpines(
    zRange: ZRange,
    filters?: Set<number> | undefined,
    showAll: boolean = false
  ): SegmentsAndSpinesResult {
    return this.#proxy.getSegmentsAndSpines({
      zRange,
      filters,
      showAll,
    });
  }

  undo() {
    this.#proxy.undo();
  }

  onDelete() {
    return this.#proxy.onDelete();
  }

  redo() {
    this.#proxy.redo();
  }

  newSegment() {
    return this.#proxy.newSegment();
  }

  public getSpinePosition(
    spineID: number
  ): [x: number, y: number, z: number] | undefined {
    return this.#proxy.getSpinePosition(spineID);
  }

  public columnsAttributes(): Record<string, ColumnAttributes> {
    return JSON.parse(this.#proxy.columnsAttributes_json());
  }

  public getColumn(key: string): Promise<pdSeries> {
    return this.#proxy.getColumn(key);
  }

  public table(): Promise<pdDataFrame> {
    return this.#proxy.table();
  }

  public addSpine(
    segmentId: number,
    x: number,
    y: number,
    z: number
  ): number | undefined {
    return this.#proxy.addSpine(segmentId, x, y, z);
  }

  public deleteSpine(spineId: number) {
    this.#proxy.deleteSpine(spineId);
  }

  public deleteSegment(segmentID: number) {
    try {
      this.#proxy.deleteSegment(segmentID);
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }
}

export class PyPixelSource {
  #proxy: pyPixelSource;

  private constructor(proxy: pyPixelSource) {
    this.#proxy = proxy;
  }

  static async Load(src: ImageSource): Promise<PyPixelSource> {
    if (src instanceof PyPixelSource) return src;
    let data: ArrayBuffer;
    if (src instanceof File) {
      data = await src.arrayBuffer();
    } else {
      const response = await fetch(src);
      if (!response.ok)
        throw new Error(`Failed to load image: ${response.statusText}`);

      data = await response.arrayBuffer();
    }

    await py.FS.writeFile("/tmp/map.mmap", new Uint8Array(data));
    const proxy = await newPixelSource("/tmp/map.mmap");
    return new PyPixelSource(proxy);
  }

  getTimePoint(timePoint: number): PyPixelSourceTimePoint {
    return new PyPixelSourceTimePoint(this.#proxy.timePoint_js(timePoint));
  }

  undo() {
    this.#proxy.undo();
  }

  redo() {
    this.#proxy.redo();
  }

  public columnsAttributes(): Record<string, ColumnAttributes> {
    return JSON.parse(this.#proxy.columnsAttributes_json());
  }

  public getColumn(key: string): pdSeries {
    return (this.#proxy.getColumn(key) as any).toJs();
  }

  public getColors(key?: string): pdSeries {
    return (this.#proxy.getColors(key) as any).toJs();
  }

  public getSymbols(key?: string): pdSeries {
    return (this.#proxy.getSymbols(key) as any).toJs();
  }

  public table(): pdDataFrame {
    return this.#proxy.table();
  }
}
