const isDev = import.meta.env.MODE === "development";

export const multiTimePointEnabled =
  import.meta.env.MULTI_TIME_POINT === "true";

/**
 * List of sample data URLs that can be loaded by the user to explore web map manager.
 * urls must be a zip file containing a mmap file.
 */
export const SampleDataURLs = isDev
  ? [
      {
        title: "Single time point - Local",
        url: "/WebMapManager/single_timepoint.mmap.zip",
      },
    ]
  : [
      {
        "title": "Single time point",
        "url": "https://corsproxy.io/?url=https://github.com/mapmanager/MapManagerCore-Data/raw/refs/heads/main/data/web_map_manager_single_timepoint.mmap.zip"
      },
    ];
