import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/dark.css";
import * as Plugins from "../plugins";
import {
  MouseEventHandler,
  ReactElement,
  createContext,
  useCallback,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import { ImageViewerRoot } from "../plugins/ImageView/sharedViewer";
import { AddNew } from "./newDropdown";

const inspectorDiv = document.getElementById("inspector") as HTMLElement;

// Allows the inspector to know which inspector to render.
const ActiveInspectorContext = createContext<boolean>(false);

const InitialStateJson: FlexLayout.IJsonModel = {
  global: { tabEnableFloat: false },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [],
  },
};

export const Model = FlexLayout.Model.fromJson(InitialStateJson);

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

    // Find and select the tab
    Model.visitNodes((node) => {
      if (!(node instanceof FlexLayout.TabNode) || !node.isVisible()) return;
      if (!isPointInTab(x, y, node)) return;
      Model.doAction(FlexLayout.Actions.selectTab(node.getId()));
    });
  }
};

const onRenderTabSet = (
  node: FlexLayout.TabSetNode | FlexLayout.BorderNode,
  renderValues: FlexLayout.ITabSetRenderValues
) => {
  renderValues.stickyButtons.push(<AddNew key="add" node={node} />);
};

const titleFactory: FlexLayout.TitleFactory = (node) => {
  const component = node.getComponent();
  return (Plugins as any)[component!]["title"] ?? component;
};

export default function Layout<Props>(props: Props) {
  const factory = useCallback(
    (node: FlexLayout.TabNode) => {
      const model = node.getModel();
      let visible = node.isVisible();
      const key = node.getId();
      const isActive =
        model.getActiveTabset()?.getSelectedNode()?.getId() === key;
      const component = node.getComponent();
      const rect = node.getRect();

      const maximized = model.getMaximizedTabset();
      if (maximized) {
        const maximizedNode = maximized.getSelectedNode();
        if (maximizedNode && maximizedNode.getId() !== key) {
          visible = false;
        }
      }

      return (
        <Container
          key={key}
          activeKey={key}
          isActive={isActive}
          props={props}
          Component={(Plugins as any)[component!]}
          rect={rect}
          visible={visible}
          node={node}
        />
      );
    },
    [props]
  );

  return (
    <div id="layout-grid-container" onMouseDown={onMouseDown}>
      <ImageViewerRoot {...(props as any)}>
        <FlexLayout.Layout
          model={Model}
          factory={factory}
          onRenderTabSet={onRenderTabSet}
          titleFactory={titleFactory}
          onTabSetPlaceHolder={onTabSetPlaceHolder}
        />
      </ImageViewerRoot>
    </div>
  );
}

const onTabSetPlaceHolder = (node: FlexLayout.TabSetNode) => (
  <div className="placeholder" />
);

/**
 * A container for the tab component.
 */
const Container = (props: any) => {
  const {
    activeKey,
    isActive,
    Component,
    rect,
    visible,
    node,
    props: cProps,
  } = props;

  return (
    <ActiveInspectorContext.Provider value={isActive}>
      <Component
        height={rect.height}
        width={rect.width}
        x={rect.x}
        y={rect.y}
        id={activeKey}
        isActive={isActive}
        visible={visible}
        node={node}
        {...cProps}
      />
    </ActiveInspectorContext.Provider>
  );
};

/**
 * Inspector for components. All the children of the inspector component are
 * attached to the global inspector when the view is active.
 */
export const Inspector = ({
  children,
}: {
  children: () => ReactElement<{}, any>;
}) => {
  const active = useContext(ActiveInspectorContext);
  if (active) return createPortal(children(), inspectorDiv);
  return <></>;
};
