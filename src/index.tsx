import { MapManager, MapManagerPlugin } from "@map-manager/app";
import { ImageView } from "@map-manager/image-view";
import { ScatterPlotView } from "@map-manager/scatter-plot";
import { TableView } from "@map-manager/table";
import ReactDOM from "react-dom/client";

let element = document.getElementById("main-view") as HTMLElement;
const root = ReactDOM.createRoot(element);

const plugins: MapManagerPlugin[] = [ImageView, ScatterPlotView, TableView];

if (import.meta.env.MODE === "development") {
  const { ExamplePlugin } = await import("@map-manager/example-plugin");
  plugins.push(ExamplePlugin);
}

/**
 * List of sample data URLs that can be loaded by the user to explore web map manager.
 * urls must be a zip file containing a mmap file.
 */
export const SampleDataURLs = [
  {
    title: "Single time point",
    url:
      "https://corsproxy.io/?url=https://github.com/mapmanager/MapManagerCore-Data/raw/refs/heads/main/data/web_map_manager_single_timepoint.mmap.zip",
  },
];

root.render(<MapManager plugins={plugins} sampleData={SampleDataURLs} />);
