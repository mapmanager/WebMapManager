import { Dropdown } from "rsuite";
import * as FlexLayout from "flexlayout-react";
import { Model } from ".";
import { WithAsProps } from "rsuite/esm/internals/types";
import AddIcon from "./add.svg";
import { MapManagerProps } from "../..";

/**
 * Appends a new tab to the layout containing the node
 * @param node The node which the component will be added to
 * @param component The name of the component to add
 */
export const addNewTab = (
  node: FlexLayout.TabSetNode | FlexLayout.BorderNode,
  component: number,
) => {
  Model.doAction(
    FlexLayout.Actions.addNode(
      {
        type: "tab",
        component,
      },
      node.getId(),
      FlexLayout.DockLocation.CENTER,
      -1,
    ),
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
  ref: React.Ref<any>,
) => {
  return (
    <img
      {...props}
      ref={ref}
      src={AddIcon}
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
export const AddNew = ({ node, plugins }: Props & MapManagerProps) => {
  return (
    <Dropdown theme="dark" renderToggle={renderButton}>
      {plugins.map((plugin, idx) => {
        return (
          <Dropdown.Item key={idx} onClick={() => addNewTab(node, idx)}>
            {plugin.title ?? plugin.shortTitle ?? plugin.name}
          </Dropdown.Item>
        );
      })}
    </Dropdown>
  );
};
