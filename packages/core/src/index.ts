export { loadCore, mapSignal } from "./load";
export * from "./utils";
import { signal } from "@preact/signals-react";
export { MapManagerMap } from "./pyToJsMM";
export { MapManagerTimePointMap } from "./pyToJsMMTimePoint";
export type * from "./types";
export type * from "./pyTypes";

/**
 * Global signal tracks which spines are selected as part of a filter.
 * Set of spine ids
 */
export const DATA_VERSION = signal<number>(0);

export const dataChanged = (didChange: boolean = true) => {
  if (!didChange) return;
  DATA_VERSION.value = DATA_VERSION.peek() + 1;
};
