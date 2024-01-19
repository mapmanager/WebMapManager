import type { PixelData } from "@vivjs/types/src/index";
import { Metadata } from "./metadata";
import {
  AnnotatedPixelSource,
  RasterSelection,
  ViewSelection,
} from "./annotations";
import {
  AnnotationsOptions,
  SegmentsAndSpinesResult,
  newPixelSource,
  pyImageSource,
  pyPixelSource,
} from "../python";
import { SIGNAL_ABORTED } from "@hms-dbmi/viv";
import { ImageViewSelection } from "../components/plugins/ImageView";
import type { PyProxy } from "pyodide/ffi"

export class PyPixelSource extends AnnotatedPixelSource {
  #proxy: pyPixelSource;
  #empty?: Uint16Array;

  private constructor(proxy: pyPixelSource, metadata: Metadata) {
    const defaultStatNames = ["x", "y", "t", "z"];
    super(metadata, defaultStatNames);
    this.#proxy = proxy;
  }

  static async Load(base_url: string): Promise<PyPixelSource> {
    if (!base_url.endsWith("/")) base_url = base_url + "/";

    const metadata = await fetch(base_url + "metadata.json").then((r) =>
      r.json()
    );

    const proxy = await newPixelSource(base_url);
    return new PyPixelSource(proxy, metadata);
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
            data: src.data(),
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
      const [low, high] = PyPixelSource.selectedZRange(selection as any);
      const len = high - low;
      const { c, t } = selection;

      // Don't fetch empty/disabled channels
      if (len <= 0) return undefined;
      (selection as any).src = await this.#proxy.slices(t, c, low, high);
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
    return this.#proxy.getAnnotationsGeoJson(options);
  }

  getSegmentsAndSpines(
    selection: ImageViewSelection,
    filters?: Set<string> | undefined,
    showAll: boolean = false
  ): SegmentsAndSpinesResult {
    return this.#proxy.getSegmentsAndSpines({
      selection,
      filters,
      showAll,
    });
  }

  public getSpinePosition(
    t: number,
    spineID: string
  ): [x: number, y: number, z: number] | undefined {
    return this.#proxy.getSpinePosition({
      t,
      spineID,
    });
  }

  public translate(
    editId: string,
    geometry: object,
    x: number,
    y: number,
    finished: boolean
  ): boolean {
    return this.#proxy.translate(editId, geometry, x, y, finished);
  }

  public addSpine(segmentId: string, x: number, y: number, z: number): string | undefined {
    return this.#proxy.addSpine(segmentId, x, y, z);
  }

  public deleteSpine(spineId: string) {
    this.#proxy.deleteSpine(spineId);
  }

  public getSpineStats(
    statNames?: (string | null)[] | undefined
  ): Record<string, string | number>[] {
    throw new Error("Method not implemented.");
  }
}
