import type {
  SupportedDtype,
  Labels,
  PixelSourceMeta,
  PixelData,
} from "@vivjs/types/src/index";
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
  dtype: SupportedDtype;
  labels: Labels<Label>;
  spineStats: string[];
  meta?: PixelSourceMeta;

  constructor(spineStats: string[]) {
    this.dtype = "Uint16";
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

    this.meta = meta;
    this.spineStats = spineStats;
  }

  abstract get shape(): [number, number, number];

  get tileSize(): number {
    return this.shape[2];
  }

  public get z(): number {
    return this.shape[0];
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
