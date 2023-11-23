/**
 * Any named component that is exported from this directory will be added to as
 * a layout component. Components will spawn with the `PluginProps` & can
 * render a custom inspector using the `Inspector` component.
 * 
 * Plugins can optionally include a title by adding a title property to the
 * component. The provided title will be used as the default tab name.
 */

import { PixelSource } from "../../loaders/";

/**
 * The Props available to all plugins
 */
export interface PluginProps {
  // The image loader
  loader: PixelSource;
  // The id of the tab
  id: string;
  // The width of the tab's view
  width: number;
  // The height of the tab's view
  height: number;
  // The x location of the tab's view
  x: number;
  // The y location of the tab's view
  y: number;
  // Whether the current tab is active or not
  isActive: boolean;
  // Whether the current tab is visible or not
  visible: boolean;
}

// Export modules using a unique name to allow it to be added to the dashboard
export { ImageView } from "./ImageView";
export { ScatterPlotView } from "./ScatterPlotView";
export { TableView } from "./Table";
