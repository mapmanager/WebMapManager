import { useAsync } from "react-use";
import { Signal, useSignal, useSignalEffect } from "@preact/signals-react";
import {
  DATA_VERSION,
  dataChanged,
  SELECTED_SEGMENT,
  SELECTED_SPINE,
  setFilters,
} from "../globals";
import {
  MapManagerTimePointMap,
  pyImageChannel,
  ViewState,
} from "@map-manager/core";
import type { SupportedTypedArray } from "@vivjs/types";

export let isShiftKeyDown = false;
export let isAltKeyDown = false;

/**
 * A notifier class to notify a set of listeners
 */
class Notifier {
  #counter = 0;
  #listeners = new Map<number, () => boolean | void>();

  /**
   * Adds a listener to the notifier
   * @param listener the listener to add
   * @returns a function to remove the listener
   */
  addListener(listener: () => boolean | void): () => void {
    const id = this.#counter++;
    this.#listeners.set(id, listener);
    return () => {
      this.#listeners.delete(id);
    };
  }

  /**
   * Notifies all listeners
   * @returns exits early if any listener returned true and returns true
   */
  notify() {
    for (const listener of this.#listeners.values()) {
      if (listener()) return true;
    }

    return false;
  }
}

/**
 * A notifier for the escape key
 */
export const onEscape = new Notifier();

/**
 * An event listener to keep track of shortcuts
 */
window.addEventListener(
  "keydown",
  (event) => {
    isAltKeyDown = event.altKey;
    isShiftKeyDown = event.shiftKey;
    if (event.key === "Escape") {
      if (onEscape.notify()) return;
      SELECTED_SPINE.value = undefined;
      SELECTED_SEGMENT.value = undefined;
      setFilters(undefined);
    }
  },
  { passive: true },
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
  { passive: true },
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
  linked: Signal<boolean>,
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
 * Loads rasters from the images based on a selection
 * @param map the map to load the image from
 * @param viewState the slices & time segments to load
 * @returns the set of selected rasters
 */
export function useRasters(
  map: MapManagerTimePointMap | undefined,
  viewState: ViewState[],
): {
  rasters?: (SupportedTypedArray | undefined)[];
  error?: Error;
  loading: boolean;
} {
  const {
    value: rasters,
    error,
    loading,
  } = useAsync(async () => {
    if (!map) return [];
    const futures = viewState.map((selection) => {
      if (!selection.visible) return Promise.resolve(undefined);
      return map.getRaster({ selection: selection as any });
    });

    const rasters = await Promise.all(futures);
    return rasters.map((raster) => raster?.data);
  }, [map, viewState]);

  return { rasters, error, loading };
}

/**
 * Loads raster sources from the images based on a selection
 * @param map the map to load the image from
 * @param viewState the slices & time segments to load
 * @returns the set of selected raster sources
 */
export function useRasterSources(
  map: MapManagerTimePointMap | undefined,
  viewState: ViewState[],
): {
  sources?: (pyImageChannel | undefined)[];
  error?: Error;
  loading: boolean;
} {
  const version = DATA_VERSION.value;
  const {
    value: sources,
    error,
    loading,
  } = useAsync(async () => {
    if (!map || map.shape[0] === 0) return [];
    const futures = viewState.map((state) => {
      if (!state.visible) return Promise.resolve(undefined);
      return map.source(state).then((source: any) => {
        if (!source) return undefined;
        source.deleteChannel = () => {
          dataChanged(map.deleteChannel(state.c));
        };

        source.loadChannel = () => map.loadChannel(state.c);
        source.loadChannelDrop = (e: any) => map.loadChannelDrop(e, state.c);
        return source as pyImageChannel;
      });
    });

    return await Promise.all(futures);
  }, [map, viewState, version]);

  return { sources, error, loading };
}
