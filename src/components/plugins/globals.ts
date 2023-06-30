import { signal } from "@preact/signals-react";
import { isAltKeyDown, isShiftKeyDown } from "../utils";

/**
 * Global signal to track which segment is selected.
 */
export const selectedSegment = signal<string | undefined>(undefined);

/**
 * Global signal to track which spine is selected.
 */
export const selectedSpine = signal<string | undefined>(undefined);

/**
 * Global signal tracks which spines are selected as part of a filter.
 * Set of spine ids
 */
export const filters = signal<Set<string> | undefined>(undefined);

/**
 * Updates the filter merging them depending on the selected shortcut
 */
export const setFilters = (selection: string[] | undefined) => {
  if (!selection) {
    filters.value = undefined;
    return;
  }
  let f = filters.peek();
  if (f) {
    if (isShiftKeyDown) {
      // addition
      selection.push(...f);
    } else if (isAltKeyDown) {
      // intersection
      selection = selection.filter((a) => f!.has(a));
    }
  }
  filters.value = new Set(selection);
};
