// Raw python proxy types
import { PyProxy } from "pyodide/ffi";
import type { SupportedTypedArray } from "@vivjs/types/src/index";
import { AnnotationsOptions, DropPosition } from "./types";

export interface pyImageSource {
  data(): { toJs: () => SupportedTypedArray };
  extent(): [number, number];
  bins(nBin?: number): [counts: number, means: number][];
}

export interface pyImageChannel extends pyImageSource {
  deleteChannel(): void;
  loadChannel(): Promise<void>;
  loadChannelDrop({
    dataTransfer,
  }: {
    dataTransfer: {
      files: FileList;
    };
  }): Promise<void>;
}

export type pdSeries = any;
export type pdDataFrame = any;
