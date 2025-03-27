import React, { JSX } from "react";
import { CustomProvider } from "rsuite";
export { ImageViewer, setImageViewPort } from "./components/ImageViewer";
export * from "@map-manager/core";
import type { MapManagerMap } from "@map-manager/core";
export * from "./components/layout";
export { InspectorNavBar, NavInspectorItem } from "./components/nav";
export { VisibilityControl } from "./components/Visibility";
export * from "./components/utils";
export * from "./globals";
import "./index.css";
import "./components/Visibility.scss";
import "rsuite/dist/rsuite.min.css";
import "./App.scss";
import { WebMapManager } from "./App";
import { Signal } from "@preact/signals-react";
export { NavBar } from "./components/nav";

/**
 * A plugin for the MapManager
 * @param props The props for the plugin
 * @returns The plugin component
 *
 * @example
 * const MyPlugin: MapManagerPlugin = (props) => {
 *  return <div>My Plugin</div>;
 * };
 * MyPlugin.title = "My Plugin";
 * MyPlugin.shortTitle = "My Plugin";
 * MyPlugin.description = "This is my plugin";
 * export default MyPlugin;
 */
export interface MapManagerPlugin {
  (props: PluginProps): JSX.Element;
  /**
   * The name of the plugin
   */
  title?: string;

  /**
   * The short title of the plugin
   */
  shortTitle?: string;

  /**
   * A description of the plugin
   */
  description?: string;
}

export interface SampleData {
  title: string;
  url: string;
}

export interface MapManagerProps {
  plugins: MapManagerPlugin[];
  sampleData?: SampleData[];
}

/**
 * The Props available to all plugins
 */
export interface PluginProps {
  /** The data source */
  map: MapManagerMap;
  /** The id of the tab */
  id: string;
  /** The width of the tab's view */
  width: number;
  /** The height of the tab's view */
  height: number;
  /** The x location of the tab's view */
  x: number;
  /** The y location of the tab's view */
  y: number;
  /** Whether the current tab is active or not */
  isActive: boolean;
  /** Whether the current tab is visible or not */
  visible: Signal<boolean>;
}

/**
 * The main MapManager component
 * @param props The props for the MapManager
 * @returns The MapManager component
 */
export const MapManager = ({ plugins, sampleData }: MapManagerProps) => {
  return (
    <div className="layout" onContextMenu={(e) => e.preventDefault()}>
      <CustomProvider theme="dark">
        <WebMapManager plugins={plugins} sampleData={sampleData} />
      </CustomProvider>
    </div>
  );
};
