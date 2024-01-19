import { useAsync } from "react-use";
import { ViewSelection } from "../loaders/annotations";
import { PyPixelSource } from "../loaders/py_loader";
import { Signal, useSignal, useSignalEffect } from "@preact/signals-react";
import {
  SELECTED_SEGMENT,
  SELECTED_SPINE,
  setFilters,
} from "./plugins/globals";
import { pyImageSource } from "../python";

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
    if (event.key === "Escape") {
      if (SELECTED_SEGMENT.peek() && SELECTED_SPINE.peek()) {
        SELECTED_SPINE.value = undefined;
        return;
      }
      SELECTED_SPINE.value = undefined;
      SELECTED_SEGMENT.value = undefined;
      setFilters(undefined);
    }
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
  loader?: PyPixelSource;
  error?: Error;
  loading: boolean;
} {
  const {
    value: loader,
    error,
    loading,
  } = useAsync(async () => await PyPixelSource.Load(src as any), [src]);
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
  loader: PyPixelSource | undefined,
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

export function useRasterSources(
  loader: PyPixelSource | undefined,
  selections: ViewSelection[]
): {
  sources?: (pyImageSource | undefined)[];
  error?: Error;
  loading: boolean;
} {
  const {
    value: sources,
    error,
    loading,
  } = useAsync(async () => {
    if (!loader) return [];
    const futures = selections.map((selection) => {
      if (!selection.visible) return Promise.resolve(undefined);
      return loader.source(selection);
    });

    return await Promise.all(futures);
  }, [loader, selections]);

  return { sources, error, loading };
}
