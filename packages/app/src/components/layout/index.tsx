import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/dark.css";
import {
  createContext,
  MouseEventHandler,
  useCallback,
  useEffect,
} from "react";
import { ImageViewerRoot } from "../ImageViewer";
import { AddNew } from "./newDropdown";
import { signal } from "@preact/signals-react";
import { MainNavBar } from "../nav";
import { Placeholder } from "./placeholder";
import { MapManagerMap, MapManagerProps } from "../..";

/**
 * The context to track if the component is active
 */
export const ActivePlugin = createContext<boolean>(false);

/**
 * The initial state of the layout
 */
const InitialStateJson: FlexLayout.IJsonModel = {
  borders: [],
  global: {},
  layout: {
    type: "row",
    weight: 100,
    children: [],
  },
};

/**
 * The layout model
 */
export const Model = FlexLayout.Model.fromJson(InitialStateJson);

/**
 * Gets the active tab element
 * @returns The active tab element
 */
export const activeTabElement = () => {
  const activeTabSet = Model.getActiveTabset();
  const path = activeTabSet?.getSelectedNode()?.getPath();
  if (!path) return;
  return document.querySelector(`.flexlayout__tab[data-layout-path="${path}"]`);
};

/**
 * Checks if a point is in a node
 * @param x x coordinate
 * @param y y coordinate
 * @param node The node
 * @returns if true the point is within the node
 */
const isPointInTab = (x: number, y: number, node: FlexLayout.Node): boolean => {
  const rect = node.getRect();
  x -= rect.x;
  if (x < 0 || x > rect.width) return false;
  y -= rect.y;
  return !(y < 0 || y > rect.height);
};

// Since events are passed through to the canvas, we must manually activate
// the selected tab
const onMouseDown: MouseEventHandler<HTMLDivElement> = (event) => {
  if (event.target && (event.target as any).id === "deckgl-overlay") {
    const { offsetX: x, offsetY: y } = event.nativeEvent;

    // Opt. don't search for the tab if the point is already in the current tab.
    const selectedNode = Model.getActiveTabset()?.getSelectedNode();
    if (selectedNode && isPointInTab(x, y, selectedNode)) return;

    // Find and select the tab by evaluating the selection point against the
    // tab node's bounds.
    Model.visitNodes((node) => {
      if (!(node instanceof FlexLayout.TabNode) || !(node as any).visible) {
        return;
      }
      if (!isPointInTab(x, y, node)) return;
      Model.doAction(FlexLayout.Actions.selectTab(node.getId()));
    });
  }
};

// The signal that tracks the active tab set id
const activeTabSetId = signal(
  Model.getActiveTabset()?.getSelectedNode()?.getId(),
);

/**
 * Handles the model change event to update the active tab set id
 * @param model The model
 */
const onModelChange = (model: FlexLayout.Model) => {
  const oldActiveTabSetId = activeTabSetId.peek();
  const newActiveTabSetId = model.getActiveTabset()?.getSelectedNode()?.getId();
  if (oldActiveTabSetId === newActiveTabSetId) return;
  activeTabSetId.value = newActiveTabSetId;
};

interface LayoutProps extends MapManagerProps {
  map: MapManagerMap;
}

/**
 * The root layout component
 */
export default function Layout(props: LayoutProps) {
  const { map, plugins, sampleData } = props;
  const factory = useCallback(
    (node: FlexLayout.TabNode) => (
      <Container map={map} node={node} plugins={plugins} />
    ),
    [map, plugins],
  );

  const onRenderTab = useCallback(
    (node: FlexLayout.TabNode, renderValues: FlexLayout.ITabRenderValues) => {
      if (renderValues.content !== "[Unnamed Tab]") return;
      const component = node.getComponent() as any as number;
      const plugin = plugins[component];
      const title = plugin.shortTitle ?? plugin.title ?? component;
      renderValues.content = title;
    },
    [plugins],
  );

  const onRenderTabSet = useCallback(
    (
      node: FlexLayout.TabSetNode | FlexLayout.BorderNode,
      renderValues: FlexLayout.ITabSetRenderValues,
    ) => {
      renderValues.stickyButtons.push(
        <AddNew key="add" node={node} plugins={plugins} />,
      );
    },
    [plugins],
  );

  return (
    <div id="root-application">
      <MainNavBar map={map} />
      <div id="layout-grid-container" onMouseDown={onMouseDown}>
        <ImageViewerRoot {...(props as any)}>
          <FlexLayout.Layout
            model={Model}
            factory={factory}
            onModelChange={onModelChange}
            onRenderTabSet={onRenderTabSet}
            onRenderTab={onRenderTab}
            onTabSetPlaceHolder={(node) => (
              <Placeholder
                node={node}
                plugins={plugins}
                sampleData={sampleData}
              />
            )}
          />
        </ImageViewerRoot>
      </div>
    </div>
  );
}

/**
 * The outer container that contains the tab component.
 */
const Container = ({
  node,
  map,
  plugins,
}: {
  map: MapManagerMap;
  node: FlexLayout.TabNode;
} & MapManagerProps) => {
  const model = node.getModel();
  const key = node.getId();
  const isActive = activeTabSetId.value === key;
  const component = node.getComponent() as any as number;
  const Component = plugins[component];
  const rect = node.getRect();
  const visible = signal((node as any).visible);

  useEffect(() => {
    node.setEventListener("visibility", ({ visible: newVisible }) => {
      if (newVisible === visible.peek()) return;
      visible.value = newVisible;
    });
  }, [node, visible]);

  const maximized = model.getMaximizedTabset();
  if (maximized) {
    const maximizedNode = maximized.getSelectedNode();
    if (maximizedNode && maximizedNode.getId() !== key) {
      if (visible.peek()) visible.value = false;
    }
  }

  return (
    <ActivePlugin.Provider value={isActive}>
      <Component
        height={rect.height}
        width={rect.width}
        x={rect.x}
        y={rect.y}
        id={key}
        isActive={isActive}
        visible={visible}
        map={map}
      />
    </ActivePlugin.Provider>
  );
};
