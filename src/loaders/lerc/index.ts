// @ts-ignore
import "lerc";
import type { PixelData } from "@vivjs/types/src/index";
import { mergeImageSlices as maxProjection } from "../zProject";
import { Metadata } from "../metadata";
import { AnnotatedPixelSource, RasterSelection } from "../annotations";
import { LoaderCache } from "../cache";

const MAX_PROJECTION_CACHE_SIZE = 256 * 1024 * 1024; // 256 MB

const Lerc = (window as any).Lerc;

/**
 * Global LRU cache with Lerc decoding embedded
 */
const LERC_CACHE = new LoaderCache(async (url, signal) => {
  const buf = await fetch(url as any, { signal }).then((res) =>
    res.arrayBuffer()
  );

  if (signal.aborted) return undefined;

  const { height, width, pixels } = Lerc.decode(buf);

  return {
    data: pixels[0],
    width,
    height,
  };
});

export class LercPixelSource extends AnnotatedPixelSource {
  base_url: string;
  projection_cache: LoaderCache;

  private constructor(base_url: string, metadata: Metadata) {
    super(metadata);
    this.base_url = base_url;

    this.projection_cache = new LoaderCache(async (url, signal) => {
      let [len, low, high, channel_path] = JSON.parse(url as any);
      const promises = [];
      promises.length = len;

      // Fetch all the slices
      for (let i = 0; low < high; low++, i++) {
        promises[i] = LERC_CACHE.fetch(channel_path + "z" + low + ".lerc.br", {
          signal,
        }) as any;
      }

      const slices = await Promise.all(promises);
      return maxProjection(slices);
    }, MAX_PROJECTION_CACHE_SIZE);
  }

  static async Load(base_url: string): Promise<LercPixelSource> {
    if (!Lerc.isLoaded()) await Lerc.load();
    if (!base_url.endsWith("/")) base_url = base_url + "/";

    const metadata = await fetch(base_url + "metadata.json").then((r) =>
      r.json()
    );

    return new LercPixelSource(base_url, metadata);
  }

  fetchRaster(
    channel_path: string,
    z: number,
    signal?: AbortSignal
  ): Promise<PixelData> {
    return LERC_CACHE.fetch(channel_path + "z" + z + ".lerc.br", {
      signal,
    }) as any;
  }

  async getRaster({ selection, signal }: RasterSelection): Promise<PixelData> {
    let [low, high] = LercPixelSource.selectedZRange(selection as any);
    const len = high - low;

    // Don't fetch empty/disabled channels
    if (len <= 0) return LERC_CACHE.empty(this.tileSize);

    const { c, t } = selection;
    const channel_path = this.base_url + "t" + t + "/ch" + c + "/";
    if (len <= 1) return this.fetchRaster(channel_path, low, signal);

    return this.projection_cache.fetch(
      JSON.stringify([len, low, high, channel_path]),
      { signal }
    ) as any;
  }

  getTile(sel: RasterSelection): Promise<PixelData> {
    return this.getRaster(sel);
  }

  onTileError(err: Error) {
    console.error(err);
  }
}
