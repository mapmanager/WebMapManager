import type {
  SupportedDtype,
  Labels,
  PixelSourceMeta,
  PixelData,
} from "@vivjs/types/src/index";
import { Metadata } from "./metadata";
import type { PixelSource } from "@vivjs/types/src/index";
import { ZRange } from "../components/plugins/ImageView";
import { SegmentsAndSpinesResult, pyImageSource } from "../python";

export interface ViewSelection {
  c: number;
  z: [number, number];
  visible: boolean;
}

export interface RasterSelection {
  selection: ViewSelection;
  signal?: AbortSignal;
}

export type Label = ["c", "z"];

export abstract class AnnotatedPixelSource implements PixelSource<Label> {
  shape: number[];
  dtype: SupportedDtype;
  labels: Labels<Label>;
  tileSize: number;
  metadata: Metadata;
  spineStats: string[];
  meta?: PixelSourceMeta;

  constructor(metadata: Metadata, spineStats: string[]) {
    const { c = 1, z = 1, x, y } = metadata.size ?? {};
    this.shape = [c, z, y, x];

    this.dtype = metadata.dtype ?? "Uint16";
    this.labels = ["c", "z", "y", "x"];

    const meta: any = {
      photometricInterpretation: 1,
    };

    // if (metadata.physicalSize) {
    //   meta["physicalSizes"] = {};
    //   ["x", "y"]
    //     .filter((dim) => Object.hasOwn(metadata.physicalSize!, dim))
    //     .forEach((dim) => {
    //       meta["physicalSizes"][dim] = {
    //         size:
    //           metadata.physicalSize![dim as "x" | "y"]! / (dim === "x" ? x : y),
    //         unit: metadata.physicalSize!.unit,
    //       };
    //     });
    // }

    this.tileSize = x;
    this.metadata = metadata;
    this.meta = meta;
    this.spineStats = spineStats;
  }

  public get z(): number {
    return this.shape[1];
  }

  // @ts-ignore: Selection should be converted to src type prior to calling super.
  abstract getRaster(sel: RasterSelection): Promise<PixelData>;
  // @ts-ignore: Selection should be converted to src type prior to calling super.
  abstract getTile(sel: RasterSelection): Promise<PixelData>;

  abstract source(selection: ViewSelection): Promise<pyImageSource | undefined>;

  static selectedZRange(selection: ViewSelection): [low: number, high: number] {
    const z = (selection as any).z;
    if (!z) return [0, 0];

    let low = z[0];
    const high = z[1];
    return [low, high];
  }

  public abstract getSpinePosition(
    t: number,
    spineId: number
  ): [x: number, y: number, z: number] | undefined;

  public abstract getSegmentsAndSpines(
    [low, high]: ZRange,
    filters?: Set<number> | undefined,
    showAll?: boolean
  ): SegmentsAndSpinesResult;

  public get scalerDimensions(): string[] {
    return this.spineStats;
  }
}
