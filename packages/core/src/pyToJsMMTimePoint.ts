// Python MapManager Single Time Point Annotation object
// to JS MapManager Single time point glue

import type {
  Labels,
  PixelData,
  PixelSource,
  PixelSourceMeta,
  RasterSelection,
  SupportedDtype,
  SupportedTypedArray,
} from "@vivjs/types/src/index";
import { pdDataFrame, pdSeries, pyImageSource } from "./pyTypes";
import { wrapCatchProxyErrors } from "./utils";
import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import type { PyProxy } from "pyodide/ffi";
import { dataChanged } from "./index";
import {
  AnnotationsOptions,
  ColumnAttributes,
  Label,
  ViewState,
} from "./types";

export type SegmentsAndSpinesResult = {
  get(key: "segmentID"): string;
  get(key: "color"): [number, number, number];
  get(key: "spines"): {
    get(key: "id"): string;
    get(key: "type"): "Start" | "End" | "";
    get(key: "invisible"): boolean;
  }[];
}[];

// The types of the python annotations proxy object
export interface pyMapManagerTimePointMap {
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
    z: number,
  ): number | undefined;

  setSegmentOrigin(
    segmentId: number,
    x: number,
    y: number,
    z: number,
  ): number | undefined;

  newSegment(): number;
  deleteChannel(channel: number): boolean;

  shape: any;

  getSegmentsAndSpines(options: {
    zRange: [number, number];
    filters?: Set<number> | undefined;
    showAll?: boolean;
  }): SegmentsAndSpinesResult;

  getSpinePosition(
    spineID: number,
  ): [x: number, y: number, z: number] | undefined;

  columnsAttributes_json(): string;
  getColumn(name: string): Promise<pdSeries>;
  table(): Promise<pdDataFrame>;

  undo(): void;
  redo(): void;

  onDelete(): boolean;
}

export class MapManagerTimePointMap implements PixelSource<Label> {
  #proxy: pyMapManagerTimePointMap;
  #empty?: SupportedTypedArray;
  dtype: SupportedDtype;
  labels: Labels<Label>;
  spineStats: string[];
  meta?: PixelSourceMeta;

  constructor(proxy: pyMapManagerTimePointMap) {
    this.dtype = "Uint16";
    this.labels = ["c", "z", "y", "x"];
    this.meta = {
      photometricInterpretation: 1,
    };
    this.spineStats = ["x", "y", "z"];
    this.#proxy = wrapCatchProxyErrors(proxy);
  }

  get tileSize(): number {
    return this.shape[2];
  }

  public get z(): number {
    return this.shape[0];
  }

  static selectedZRange(selection: ViewState): [low: number, high: number] {
    const z = (selection as any).z;
    if (!z) return [0, 0];

    let low = z[0];
    const high = z[1];
    return [low, high];
  }

  public get scalerDimensions(): string[] {
    return this.spineStats;
  }

  get shape(): [number, number, number] {
    return this.#proxy.shape.toJs();
  }

  async getRaster(selection: RasterSelection<Label>): Promise<PixelData> {
    try {
      // Cache the raster data
      if (!(selection.selection as any).raster) {
        const src = await this.source(selection.selection as any);
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
    selection: ViewState,
  ): Promise<pyImageSource | undefined> {
    if (!(selection as any).src) {
      const [low, high] = MapManagerTimePointMap.selectedZRange(
        selection as any,
      );
      const len = high - low;
      const { c } = selection;

      // Don't fetch empty/disabled channels
      if (len <= 0) return undefined;
      (selection as any).src = await this.#proxy.slices_js(c, [low, high]);
    }
    return (selection as any).src;
  }

  getTile(sel: RasterSelection<Label>): Promise<PixelData> {
    return this.getRaster(sel);
  }

  onTileError(err: Error) {
    console.error(err);
  }

  empty(): SupportedTypedArray {
    if (!this.#empty) {
      this.#empty = new Uint16Array(this.tileSize * this.tileSize * 2);
    }

    return this.#empty;
  }

  getAnnotations(options?: AnnotationsOptions): PyProxy[] {
    return this.#proxy.getAnnotations_js(options);
  }

  getSegmentsAndSpines(
    zRange: [number, number],
    filters?: Set<number> | undefined,
    showAll: boolean = false,
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

  deleteChannel(channel: number) {
    return this.#proxy.deleteChannel(channel);
  }

  async loadFile(
    src: File,
    channel: number | undefined = undefined,
  ): Promise<void> {
    const data = await src.arrayBuffer();
    const name = src.name;
    const dest = "/tmp/temp." + name.split(".").pop();
    try {
      py.FS.writeFile(dest, new Uint8Array(data));
      this.#proxy.loadFile(dest, channel, name.split("/").pop());
      py.FS.unlink(dest);
    } catch (e) {
      console.error(e);
    }
  }

  async loadChannelDrop(
    {
      dataTransfer,
    }: {
      dataTransfer: {
        files: FileList;
      };
    },
    channel?: number,
  ): Promise<void> {
    const droppedFiles = dataTransfer?.files;
    if (!droppedFiles) return;

    for (const file of droppedFiles) {
      if (file.name.endsWith(".tif")) {
        await this.loadFile(file, channel);
        continue;
      }
      alert("Invalid file type. Please upload a '.tif' file.");
      return;
    }
    dataChanged();
  }

  async loadChannel(channel?: number) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mmap,.tif";
    input.multiple = false;
    const promise = new Promise<string>((resolve, reject) => {
      input.onchange = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target as HTMLInputElement;
        if (target.files) {
          this.loadChannelDrop(
            {
              dataTransfer: { files: target.files },
            },
            channel,
          );
        }
      };

      input.oncancel = () => {
        reject(new Error("User cancelled"));
      };
    });

    input.click();
    return promise;
  }

  public getSpinePosition(
    spineID: number,
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
    z: number,
  ): number | undefined {
    return this.#proxy.addSpine(segmentId, x, y, z);
  }

  public setSegmentOrigin(
    segmentId: number,
    x: number,
    y: number,
    z: number,
  ): number | undefined {
    return this.#proxy.setSegmentOrigin(segmentId, x, y, z);
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

  public setSegmentColor(segmentID: number, color: [number, number, number]) {
    try {
      this.#proxy.setSegmentColor(segmentID, color);
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }
}
