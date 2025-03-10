import * as FlexLayout from "flexlayout-react";
import "flexlayout-react/style/dark.css";
import * as Plugins from "../plugins";
import {
  MouseEventHandler,
  ReactElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { ImageViewerRoot } from "../plugins/ImageView/sharedViewer";
import { AddNew } from "./newDropdown";
import { signal } from "@preact/signals-react";
import { MainNavBar, NavBarElements } from "../../nav";
import { PyPixelSource } from "../../loaders/py_loader";
import { Placeholder } from "./placeholder";

// Allows the inspector to know which inspector to render.
const ActiveInspectorContext = createContext<boolean>(false);

const InitialStateJson: FlexLayout.IJsonModel = {
  borders: [],
  global: {},
  layout: {
    type: "row",
    weight: 100,
    children: [],
  },
};

export const Model = FlexLayout.Model.fromJson(InitialStateJson);
export const activeTabElement = () => {
  const activeTabSet = Model.getActiveTabset();
  const path = activeTabSet?.getSelectedNode()?.getPath();
  if (!path) return;
  return document.querySelector(`.flexlayout__tab[data-layout-path="${path}"]`);
}

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
      if (!(node instanceof FlexLayout.TabNode) || !(node as any).visible)
        return;
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

const activeTabSetId = signal(
  Model.getActiveTabset()?.getSelectedNode()?.getId()
);

const onModelChange = (model: FlexLayout.Model) => {
  const oldActiveTabSetId = activeTabSetId.peek();
  const newActiveTabSetId = model.getActiveTabset()?.getSelectedNode()?.getId();
  if (oldActiveTabSetId === newActiveTabSetId) return;
  activeTabSetId.value = newActiveTabSetId;
};

export default function Layout<Props>(props: Props) {
  const factory = useCallback(
    (node: FlexLayout.TabNode) => <Container props={props} node={node} />,
    [props]
  );

  const loader = (props as any).loader as PyPixelSource;

  return (
    <div id="root-application">
      <MainNavBar loader={loader} />
      <div id="layout-grid-container" onMouseDown={onMouseDown}>
        <ImageViewerRoot {...(props as any)}>
          <FlexLayout.Layout
            model={Model}
            factory={factory}
            onModelChange={onModelChange}
            onRenderTabSet={onRenderTabSet}
            onRenderTab={onRenderTab}
            onTabSetPlaceHolder={(node) => <Placeholder node={node}/>}
          />
        </ImageViewerRoot>
      </div>
    </div>
  );
}

function onRenderTab(
  node: FlexLayout.TabNode,
  renderValues: FlexLayout.ITabRenderValues
) {
  if (renderValues.content !== "[Unnamed Tab]") return;
  const component = node.getComponent();
  const title = (Plugins as any)[component!]["shortTitle"] ?? (Plugins as any)[component!]["title"] ?? component;
  renderValues.content = title;
}

/**
 * A container for the tab component.
 */
const Container = (props: any) => {
  const {
    node,
    props: cProps,
  }: {
    node: FlexLayout.TabNode;
    props: any;
  } = props;

  const model = node.getModel();
  const key = node.getId();
  const isActive = activeTabSetId.value === key;
  const component = node.getComponent();
  const Component = (Plugins as any)[component!];
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
    <ActiveInspectorContext.Provider value={isActive}>
      <Component
        height={rect.height}
        width={rect.width}
        x={rect.x}
        y={rect.y}
        id={key}
        isActive={isActive}
        visible={visible}
        node={node}
        {...cProps}
      />
    </ActiveInspectorContext.Provider>
  );
};

/**
 * Nev bar for components. All the children of the nave bar component are
 * attached to the global nave bar when the view is active.
 */
export const NavBar = ({
  children: Children,
}: {
  children: undefined | ReactElement<{}, any> | any;
}) => {
  const active = useContext(ActiveInspectorContext);
  useEffect(() => {
    if (!active || !Children) return;

    NavBarElements.value = Children;

    return () => {
      NavBarElements.value = undefined;
    };
  }, [active, Children]);

  return <></>;
};
