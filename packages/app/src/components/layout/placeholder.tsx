import * as FlexLayout from "flexlayout-react";
import { Button, Heading, Stack } from "rsuite";
import { addNewTab } from "./newDropdown";
import { Divider, Text } from "rsuite";
import { useState } from "react";
import { Progress } from "rsuite";
import { openHelpMenu } from "../../help";
import { MapManagerProps } from "../..";
import { MapManagerMap } from "@map-manager/core";

/**
 * A placeholder component that is displayed when no tabs are open
 */
export const Placeholder = ({
  node,
  plugins,
  sampleData,
}: { node: FlexLayout.TabSetNode } & MapManagerProps) => {
  const [loading, setLoading] = useState<number>(-1);
  const [progress, setProgress] = useState<number>(0);
  return (
    <div className="placeholder">
      <Heading level={3}>Welcome to Web Map Manager</Heading>
      <Text>
        Please select a tool to begin your analysis.
        <br />
      </Text>
      <Text muted>
        If you are unsure what to do, please refer to the{" "}
        <span
          className="text-[var(--rs-navs-selected)] cursor-pointer"
          onClick={openHelpMenu}
        >
          help menu
        </span>
        .
      </Text>

      <Text className="pt-4">
        Start by importing your image data in the{" "}
        <a onClick={() => addNewTab(node, 0)}>Image Viewer</a>.
      </Text>

      {sampleData && sampleData.length > 0 && (
        <>
          <Text muted className="pt-4">
            Don't have any data yet? Checkout sample data below:
          </Text>

          <div className="flex gap-2 pt-2">
            {sampleData.map(({ title, url }, idx) => (
              <Button
                key={idx}
                appearance="ghost"
                size="xs"
                disabled={loading !== -1}
                loading={loading === idx}
                className="text-[var(--rs-navs-selected)] cursor-pointer"
                onClick={() => {
                  setLoading(idx);
                  MapManagerMap.LoadUrl(url, title, setProgress).finally(() => {
                    setLoading(-1);
                    setProgress(0);
                  });
                }}
                data-intro={`Load sample data: ${title}`}
              >
                {title}
              </Button>
            ))}
          </div>
          {loading !== -1 && progress !== 100 && (
            <Progress.Line
              percent={progress}
              status="active"
              className="mt-8"
            />
          )}
        </>
      )}
      <Divider />
      <Heading level={3}>Tools</Heading>
      <Stack
        wrap
        direction="row"
        alignItems="flex-start"
        spacing={18}
        className="pt-4"
      >
        {plugins.map((plugin, idx) => {
          return (
            <Button
              className="w-38 h-28 !border !border-solid !border-[#3c3f43] !rounded-lg flex flex-col !justify-between items-start"
              appearance="subtle"
              key={idx}
              onClick={() => addNewTab(node, idx)}
            >
              <div className="font-bold w-full text-left">
                {plugin.title ?? plugin.shortTitle ?? plugin.name}
              </div>

              {plugin.description && (
                <div className="text-sm w-full text-left text-wrap italic text-gray-500">
                  {plugin.description}
                </div>
              )}
            </Button>
          );
        })}
      </Stack>
    </div>
  );
};
