import React from "react";
import { useSignal } from "@preact/signals-react";
import InfoOutlineIcon from "@rsuite/icons/InfoOutline";
import CreativeIcon from "@rsuite/icons/Creative";
import { Button, Nav, Panel, PanelGroup } from "rsuite";

import {
  InspectorNavBar,
  MapManagerPlugin,
  NavBar,
  NavInspectorItem,
} from "@map-manager/app";

// Global state can be imported from the core globals
import {
  DATA_VERSION,
  dataChanged,
  SELECTED_SEGMENT,
  SELECTED_SPINE,
} from "@map-manager/app/globals";

export const ExamplePlugin: MapManagerPlugin = ({
  isActive,
  height,
  id,
  map,
  visible,
  width,
  x,
  y,
}) => {
  const activeKeyInspector = useSignal();

  // Log the map to the console. Allowing the developer to see the map object.
  console.trace("map", map);

  return (
    <div className="px-4 py-8">
      {/* Define the left navigation bar for the plugin. */}
      {isActive && (
        <>
          <NavBar>
            {/* Create control nav bar segment */}
            <Nav className="flex-grow">
              <Nav.Item
                eventKey="click-me"
                icon={<CreativeIcon />}
                onClick={() => {
                  alert("Control clicked!");
                }}
              >
                Control
              </Nav.Item>
            </Nav>
            {/* Inspector nave items segment */}
            <InspectorNavBar activeKey={activeKeyInspector}>
              {/* The NavInspectorItem component is used to create a button in the inspector navigation bar. */}
              <NavInspectorItem
                eventKey={"inspector"}
                icon={<InfoOutlineIcon />}
                Inspector={() => (
                  <PanelGroup>
                    <Panel header="Inspector" defaultExpanded>
                      <p>
                        The content of the inspector panel which is show when
                        the accompanied `NavInspectorItem` is clicked. data
                        version: {DATA_VERSION.value}
                      </p>
                    </Panel>
                  </PanelGroup>
                )}
              >
                Inspector Button
              </NavInspectorItem>
            </InspectorNavBar>
          </NavBar>
        </>
      )}

      {/* The plugin's content */}
      <h1>Example Plugin</h1>
      <p>This is an example plugin.</p>
      <p>
        <strong>Plugin Parameters:</strong>
        <pre>
          {JSON.stringify(
            {
              id,
              x,
              y,
              height,
              width,
              isActive,
              visible,
              map: "MapManagerMap",
            },
            null,
            "\t"
          )}
        </pre>
      </p>
      <br />
      <p>
        <strong>Global state:</strong>
        <p>The global state is used to store state shared between plugins.</p>
        <pre>
          {JSON.stringify(
            {
              selectedSegment: SELECTED_SEGMENT.value ?? "null",
              selectedSpine: SELECTED_SPINE.value ?? "null",
              dataVersion: DATA_VERSION.value,
            },
            null,
            "\t"
          )}
        </pre>
      </p>
      <br />
      <p>
        <strong>Trigger data change:</strong>
        <p>
          Clicking the button below will trigger a data change and request the
          entire map to redraw.
          {
            /*
            In the future, a subscription extension to lazy pandas can limit the scope of the redraw.
            For now this works, and most views are smart enough to only redraw the necessary parts (the parts that changed).
           */
          }
        </p>
      </p>
      <Button
        onClick={() => {
          dataChanged();
        }}
      >
        Trigger data change / redraw
      </Button>
    </div>
  );
};

ExamplePlugin.title = "Example Plugin";
ExamplePlugin.shortTitle = "Example";
ExamplePlugin.description = "An example plugin";
