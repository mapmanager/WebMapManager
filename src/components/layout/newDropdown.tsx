import { Dropdown } from "rsuite";
import * as Plugins from "../plugins";
import * as FlexLayout from "flexlayout-react";
import { Model } from ".";
import { WithAsProps } from "rsuite/esm/internals/types";

/**
 * Appends a new tab to the layout containing the node
 * @param node The node which the component will be added to
 * @param component The name of the component to add
 */
const addNew = (
  node: FlexLayout.TabSetNode | FlexLayout.BorderNode,
  component: string
) => {
  Model.doAction(
    FlexLayout.Actions.addNode(
      {
        type: "tab",
        component,
      },
      node.getId(),
      FlexLayout.DockLocation.CENTER,
      -1
    )
  );
};

interface Props {
  node: FlexLayout.TabSetNode | FlexLayout.BorderNode;
}

/**
 * Renders the add tab button
 */
const renderButton = (
  props: WithAsProps<React.ElementType<any>>,
  ref: React.Ref<any>
) => {
  return (
    <img
      {...props}
      ref={ref}
      src="/add.svg"
      alt="Add"
      key="Add button"
      style={{ width: "1.1em", height: "1.1em" }}
      className="flexlayout__tab_toolbar_button"
    />
  );
};

/**
 * Renders the add tab dropdown with all teh plugin names
 */
export const AddNew = ({ node }: Props) => {
  return (
    <Dropdown theme="dark" renderToggle={renderButton}>
      {Object.entries(Plugins).map(([pluginName, plugin]) => {
        return (
          <Dropdown.Item
            key={pluginName}
            onClick={() => addNew(node, pluginName)}
          >
            New {(plugin as any).title ?? pluginName}
          </Dropdown.Item>
        );
      })}
    </Dropdown>
  );
};
