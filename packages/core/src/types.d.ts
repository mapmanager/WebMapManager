export interface AnalysisParam {
  value: any;
  description: string;
  title: string;
  type: string;
}

export type AnalysisParams = Record<string, AnalysisParam>;

export type AnalysisParamsUpdate = Record<string, any>;

export interface ViewState {
  c: number;
  z: [number, number];
  visible: boolean;
}

export type Label = ["c", "z"];

export interface AnnotationsOptions {
  filters?: Set<number>;
  zRange: [number, number];
  annotationSelections: Record<string, number | undefined>;

  // View toggles
  showLineSegments?: boolean;
  showLineSegmentsOrigin?: boolean;
  showLineSegmentsRadius?: boolean;
  showLabels?: boolean;
  showAnchors?: boolean;
  showSpines?: boolean;
}

export const enum DropPosition {
  OVER = 0,
  AT = 1,
}

export interface ColumnAttributes {
  title: string;
  group: string;
  categorical: boolean;
  divergent: boolean;
  description: string;
  key: string;
  plot: boolean;
}
