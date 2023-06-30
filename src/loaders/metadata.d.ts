import type { SupportedDtype } from "@vivjs/types/src/index";

export type Point2d = [x: number, y: number];
export type Point3d = [x: number, y: number, z: number];
export type Polygon2d = Point2d[];

export interface Spine {
  position: Point3d;
  brightestIndex: number;
  segmentID: string;
  backgroundOffset: Point2d;
  stats: {
    [stat_name: string]: number;
  };
  spine: Polygon2d;
  segment: Polygon2d;
  spineBackground: Polygon2d;
  segmentBackground: Polygon2d;
  note?: string
}

export interface Segment {
  points: Point3d[];
}

export interface Metadata {
  size: {
    t?: number;
    c?: number;
    z?: number;
    x: number;
    y: number;
  };
  voxel?: {
    x?: number;
    y?: number;
    z?: number;
  };
  dtype: SupportedDtype;
  physicalSize?: {
    x?: number;
    y?: number;
    unit?: string;
  };
  annotations: {
    [time_point: number]: {
      spines: {
        [id: string]: Spine;
      };
      lineSegments: {
        [id: string]: Segment;
      };
    };
  };
}
