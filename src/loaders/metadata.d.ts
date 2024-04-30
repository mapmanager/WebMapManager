import type { SupportedDtype } from "@vivjs/types/src/index";

export interface Metadata {
  size: {
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
}
