import { useAsync } from "react-use";
import { ViewSelection } from "../loaders/annotations";
import { PyPixelSourceTimePoint } from "../loaders/py_loader";
import { Signal, useSignal, useSignalEffect } from "@preact/signals-react";
import {
  DATA_VERSION,
  dataChanged,
  SELECTED_SEGMENT,
  SELECTED_SPINE,
  setFilters,
} from "./plugins/globals";
import { pyImageChannel } from "../python";

export class EmptyImageSource {}

export type ImageSource = string | File | EmptyImageSource;

export let isShiftKeyDown = false;
export let isAltKeyDown = false;

class Notifier {
  #counter = 0;
  #listeners = new Map<number, () => boolean | void>();

  addListener(listener: () => boolean | void): () => void {
    const id = this.#counter++;
    this.#listeners.set(id, listener);
    return () => {
      this.#listeners.delete(id);
    };
  }

  notify() {
    for (const listener of this.#listeners.values()) {
      if (listener()) return true;
    }

    return false;
  }
}

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
 * Loads rasters from the images based on a selection
 * @param loader the loader to load the image from
 * @param selections the slices & time segments to load
 * @returns the set of selected rasters
 */
export function useRasters(
  loader: PyPixelSourceTimePoint | undefined,
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
  loader: PyPixelSourceTimePoint | undefined,
  selections: ViewSelection[]
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
    if (!loader || loader.shape[0] === 0) return [];
    const futures = selections.map((selection) => {
      if (!selection.visible) return Promise.resolve(undefined);
      return loader.source(selection).then((source: any) => {
        if (!source) return undefined;
        source.deleteChannel = () => {
          dataChanged(loader.deleteChannel(selection.c));
        };

        source.loadChannel = () => loader.loadChannel(selection.c);
        source.loadChannelDrop = (e: any) =>
          loader.loadChannelDrop(e, selection.c);
        return source as pyImageChannel;
      });
    });

    return await Promise.all(futures);
  }, [loader, selections, version]);

  return { sources, error, loading };
}
