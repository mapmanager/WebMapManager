export interface AnalysisParam {
  value: any;
  description: string;
  title: string;
  type: string;
}

export type AnalysisParams = Record<string, AnalysisParam>;
export type AnalysisParamsUpdate = Record<string, any>;
