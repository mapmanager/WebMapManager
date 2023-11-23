import type {
  SupportedDtype,
  Labels,
  PixelSourceMeta,
  PixelData,
} from "@vivjs/types/src/index";
import { Metadata, Point2d, Polygon2d, Spine } from "./metadata";
import type { PixelSource } from "@vivjs/types/src/index";
import { Color } from "@deck.gl/core/typed";
import { ImageViewSelection } from "../components/plugins/ImageView";
import {
  AnnotationsOptions,
  SegmentsAndSpinesResult,
  pyImageSource,
} from "../python";

export interface ViewSelection {
  c: number;
  t: number;
  z: [number, number];
  visible: boolean;
}

export interface RasterSelection {
  selection: ViewSelection;
  signal?: AbortSignal;
}

export type Label = ["t", "c", "z"];

const TRACE_KEYS = ["segment", "segmentBackground", "spineBackground", "spine"];

interface ColoredPolygon {
  polygon: Polygon2d;
  strokeColor: Color;
}

export abstract class AnnotatedPixelSource implements PixelSource<Label> {
  shape: number[];
  dtype: SupportedDtype;
  labels: Labels<Label>;
  tileSize: number;
  metadata: Metadata;
  spineStats: string[];
  meta?: PixelSourceMeta;

  constructor(metadata: Metadata, spineStats: string[]) {
    const { t = 1, c = 1, z = 1, x, y } = metadata.size ?? {};
    this.shape = [t, c, z, y, x];

    this.dtype = metadata.dtype ?? "Uint16";
    this.labels = ["t", "c", "z", "y", "x"];

    const meta: any = {
      photometricInterpretation: 1,
    };

    if (metadata.physicalSize) {
      meta["physicalSizes"] = {};
      ["x", "y"]
        .filter((dim) => Object.hasOwn(metadata.physicalSize!, dim))
        .forEach((dim) => {
          meta["physicalSizes"][dim] = {
            size:
              metadata.physicalSize![dim as "x" | "y"]! / (dim === "x" ? x : y),
            unit: metadata.physicalSize!.unit,
          };
        });
    }

    this.tileSize = x;
    this.metadata = metadata;
    this.meta = meta;
    this.spineStats = spineStats;
  }

  public get z(): number {
    return this.shape[2];
  }

  // @ts-ignore: Selection should be converted to src type prior to calling super.
  abstract getRaster(sel: RasterSelection): Promise<PixelData>;
  // @ts-ignore: Selection should be converted to src type prior to calling super.
  abstract getTile(sel: RasterSelection): Promise<PixelData>;

  abstract getAnnotationsGeoJson(options?: AnnotationsOptions): string[];
  abstract source(selection: ViewSelection): Promise<pyImageSource | undefined>;

  static selectedZRange(selection: ViewSelection): [low: number, high: number] {
    const z = (selection as any).z;
    if (!z) return [0, 0];

    let low = z[0];
    const high = z[1];
    return [low, high];
  }

  public getLineSegments({ t, z }: ImageViewSelection): {
    position: Point2d;
    id: string;
    color: Color;
  }[] {
    const annotations = this.metadata.annotations[t];
    const [low, high] = z;

    const result: any = [];

    for (const [id, { points }] of Object.entries(annotations.lineSegments)) {
      for (const [x, y, z] of points) {
        if (z < low || z > high) continue;

        result.push({
          position: [x, y],
          id,
          color: [255, 0, 0],
        });
      }
    }

    return result;
  }

  public abstract getSpinePosition(
    t: number,
    spineId: string
  ): [x: number, y: number, z: number] | undefined;

  public getSpine(
    selection: { t: number; z?: [number, number] },
    spineId?: string
  ): Spine | undefined {
    if (!spineId) return;
    const annotations = this.metadata.annotations[selection.t];
    const spine = annotations.spines[spineId];

    if (selection.z) {
      const z = spine.position[2];
      const [low, high] = selection.z;
      if (z < low || z > high) return;
    }

    return spine;
  }

  public getSpineTraces(
    selection: ImageViewSelection,
    spineId?: string
  ): void | ColoredPolygon[] {
    const spine = this.getSpine(selection, spineId);
    if (!spine) return;

    return TRACE_KEYS.map((key) => (spine as any)[key] as Polygon2d)
      .filter((polygon) => !!polygon)
      .map((polygon) => ({
        polygon,
        strokeColor: [0, 0, 255],
      }));
  }

  public getSpines(
    { t, z: [low, high] }: ImageViewSelection,
    filter?: Set<string> | undefined
  ): {
    position: Point2d;
    anchor: Point2d;
    id: string;
    color: Color;
    anchorColor: Color;
    textColor: Color;
    note?: string;
    filtered: boolean;
  }[] {
    const annotations = this.metadata.annotations[t];

    const result: any[] = [];

    for (const [id, spine] of Object.entries(annotations.spines)) {
      const [x, y, z] = spine.position;
      if (z < low || z > high) continue;

      const segment = annotations.lineSegments[spine.segmentID];
      const anchor = segment.points[spine.brightestIndex];
      result.push({
        position: [x, y],
        anchor: [anchor[0], anchor[1]],
        id,
        color: [0, 0, 255],
        anchorColor: [200, 200, 200, 255],
        textColor: [255, 255, 255],
        note: spine.note,
        filtered: (filter && !filter.has(id)) || false,
      });
    }

    return result;
  }

  public abstract getSegmentsAndSpines(
    {
      t,
      z: [low, high],
    }: ImageViewSelection,
    filters?: Set<string> | undefined,
    showAll?: boolean
  ): SegmentsAndSpinesResult;

  public get scalerDimensions(): string[] {
    return this.spineStats;
  }

  public abstract getSpineStats(
    statNames?: (string | null)[]
  ): Record<string, number | string>[];
}
