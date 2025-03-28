import { signal } from "@preact/signals-react";
import { isAltKeyDown, isShiftKeyDown } from "./components/utils";
export { DATA_VERSION, dataChanged } from "@map-manager/core";

/**
 * Global signal to track which segment is selected.
 */
export const SELECTED_SEGMENT = signal<number | undefined>(undefined);

/**
 * Global signal to track which spine is selected.
 */
export const SELECTED_SPINE = signal<number | undefined>(undefined);

/**
 * Global signal tracks which spines are selected as part of a filter.
 * Set of spine ids
 */
export const FILTERS = signal<Set<number> | undefined>(undefined);

/**
 * Updates the filter merging them depending on the selected shortcut
 */
export const setFilters = (selection: number[] | undefined) => {
  if (!selection) {
    FILTERS.value = undefined;
    return;
  }
  let f = FILTERS.peek();
  if (f) {
    if (isShiftKeyDown) {
      // addition
      selection.push(...f);
    } else if (isAltKeyDown) {
      // intersection
      selection = selection.filter((a) => f!.has(a));
    }
  }
  FILTERS.value = new Set(selection);
};
