import { useAsync } from "react-use";
import { LercPixelSource } from "../loaders/lerc";
import { AnnotatedPixelSource, ViewSelection } from "../loaders/annotations";
import { Signal, useSignal, useSignalEffect } from "@preact/signals-react";
import { setFilters } from "./plugins/globals";

export type ImageSource = string;

export let isShiftKeyDown = false;
export let isAltKeyDown = false;

/**
 * An event listener to keep track of shortcuts
 */
window.addEventListener(
  "keydown",
  (event) => {
    isAltKeyDown = event.altKey;
    isShiftKeyDown = event.shiftKey;
    if (event.key === "Escape") setFilters(undefined);
  },
  { passive: true }
);


/**
 * An event listener to keep track of shortcuts
 */
window.addEventListener(
  "keyup",
  (event) => {
    isAltKeyDown = event.altKey;
    isShiftKeyDown = event.shiftKey;
  },
  { passive: true }
);

/**
 * Allows a signal to be linked to a global signal.
 * Linked signal match global state while linked.
 * @param init initial value of the local signal
 * @param global the global signal to link to
 * @param linked whether the global signal is linked or not
 * @returns the linked signal
 */
export function useLinkedSignal<T>(
  init: T,
  global: Signal<T>,
  linked: Signal<boolean>
): Signal<T> {
  const local = useSignal(linked.peek() ? global.peek() : init);
  useSignalEffect(() => {
    if (!linked.value) return;

    // Changes to the global should update local values
    const gUnSub = global.subscribe((value) => {
      local.value = value;
    });

    // Changes to the local should update global values
    const lUnSub = local.subscribe((value) => {
      global.value = value;
    });

    return () => {
      gUnSub();
      lUnSub();
    };
  });

  return local;
}

/**
 * Loads an pixel source from an async loader
 * @param src the image source
 */
export function useImageLoader(src: ImageSource): {
  loader?: LercPixelSource;
  error?: Error;
  loading: boolean;
} {
  const {
    value: loader,
    error,
    loading,
  } = useAsync(async () => await LercPixelSource.Load(src as any), [src]);
  if (!loader) return { error, loading };
  return { loader, error, loading };
}

/**
 * Loads rasters from the images based on a selection
 * @param loader the loader to load the image from
 * @param selections the slices & time segments to load
 * @returns the set of selected rasters
 */
export function useRasters(
  loader: AnnotatedPixelSource | undefined,
  selections: ViewSelection[]
): {
  rasters?: any[];
  error?: Error;
  loading: boolean;
} {
  const {
    value: rasters,
    error,
    loading,
  } = useAsync(async () => {
    if (!loader) return [];
    const futures = selections.map((selection) => {
      if (!selection.visible) return Promise.resolve(undefined);
      return loader.getRaster({ selection });
    });

    const rasters = await Promise.all(futures);
    return rasters.map((raster) => raster?.data);
  }, [loader, selections]);

  return { rasters, error, loading };
}

// An optimized version of d3 extent for typed arrays
export const typedExtent = (
  slice: number[] | Uint16Array
): [min: number, max: number] => {
  let len = slice.length - 1;
  let min = slice[len];
  let max = min;
  for (; len--; ) {
    const data = slice[len];
    if (data < min) min = data;
    if (data > max) max = data;
  }

  return [min, max];
};
