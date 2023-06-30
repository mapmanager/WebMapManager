import type { PixelData } from "@vivjs/types/src/index";
import { LRUCache } from "lru-cache";

const MAX_CACHE_SIZE = 512 * 1024 * 1024; // 512 MB

type Fetcher = (
  url: String,
  signal: AbortSignal
) => Promise<PixelData | undefined>;

/**
 * LRU Cache
 */
export class LoaderCache extends LRUCache<String, PixelData> {
  constructor(fetcher: Fetcher, maxSize = MAX_CACHE_SIZE) {
    super({
      maxSize,
      allowStale: true,
      sizeCalculation: (value) => value.data.length,
      fetchMethod: (url, _, { signal }) => fetcher(url, signal),
    });
  }

  /**
   * @param tileSize size of the empty tile
   * @returns Cached empty array
   */
  empty(tileSize: number): PixelData {
    const emptyKey = String(tileSize);

    let empty = this.get(emptyKey);
    if (empty) return empty;

    empty = {
      data: new Uint16Array(tileSize * tileSize),
      width: tileSize,
      height: tileSize,
    } as any;
    this.set(emptyKey, empty);

    return empty!;
  }
}
