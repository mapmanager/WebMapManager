import type { PixelData } from "@vivjs/types/src/index";

/**
 * Merges all slices by picking the max value
 * @param slices images
 * @returns merged images
 */
export const mergeImageSlices = (slices: PixelData[]): PixelData => {
  let len = (slices.length - 1) | 0;
  const merged = slices[len];
  const mergedData = new (merged.data as any).constructor(merged.data);
  const mergeLenBase = (mergedData.length | 0) - (1 | 0);
  let j;
  for (; len >= 0; len = (len | 0) - (1 | 0)) {
    const sliceData = slices[len].data;
    for (j = mergeLenBase; j >= 0; ) {
      // Unwind for performance
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
      if ((mergedData[j] | 0) < (sliceData[j] | 0))
        mergedData[j] = sliceData[j];
      j = (j | 0) - (1 | 0);
    }
  }

  return {
    ...merged,
    data: mergedData,
  };
};
