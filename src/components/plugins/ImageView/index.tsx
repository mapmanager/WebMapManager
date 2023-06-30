import React, { useEffect } from "react";
import { ContrastControls } from "./contrast";
import "./index.scss";
import { ZScroll } from "./z";
import { PanelGroup, Panel, Checkbox } from "rsuite";
import { Inspector } from "../../layout";
import { selectedSpine } from "../globals";
import { ImageViewer } from "./sharedViewer";
import { PluginProps } from "..";
import {
  signal,
  Signal,
  useComputed,
  useSignal,
  batch,
} from "@preact/signals-react";
import { useAnnotations } from "./layers";
import { isAltKeyDown, useLinkedSignal } from "../../utils";
import { VisibilityControl } from "../../Visibility";
import { SpineTable } from "./table";
import { COLORS_SELECTOR_OPTIONS } from "./colorPicker";
import { color as D3Color } from "d3";

const DEFAULT_CONTRAST: [number, number] = [0, 2 ** 11];
const DEFAULT_COLOR: Color[] = COLORS_SELECTOR_OPTIONS.map((color) => {
  const { r, g, b } = D3Color(color)?.rgb()!;
  return [r, g, b];
});

const globalColor: Signal<Color[]> = signal(DEFAULT_COLOR);

export interface ImageViewSelection {
  t: number;
  z: [number, number];
}

export type Color = [number, number, number];

const globalContrastLimits = signal([DEFAULT_CONTRAST, DEFAULT_CONTRAST]);
const globalChannelsVisible = signal<[boolean, boolean]>([true, true]);

export function ImageView({
  loader,
  width,
  height,
  x,
  y,
  id,
  isActive,
  visible,
}: PluginProps) {
  const minimap = useSignal(false);
  const linked = useSignal(true);
  const showLineSegments = useSignal(true);
  const showSpines = useSignal(true);
  const showAnchors = useSignal(true);
  const showLabels = useSignal(true);
  const target = useSignal<[number, number] | undefined>(undefined);
  const colors = useLinkedSignal<Color[]>(DEFAULT_COLOR, globalColor, linked);
  // Store expanded rows in the in the image view so that the state is maintained even if the inspector is not shown
  const segmentsExpandedRows = useSignal<string[]>([]);
  const contrastLimits = useLinkedSignal<[number, number][]>(
    [DEFAULT_CONTRAST, DEFAULT_CONTRAST],
    globalContrastLimits,
    linked
  );

  const channelsVisible = useLinkedSignal<[boolean, boolean]>(
    [true, true],
    globalChannelsVisible,
    linked
  );

  const selection = useSignal<ImageViewSelection>({
    t: 0,
    z: [35, 36],
  });

  const selections = useComputed(() =>
    channelsVisible.value.map((visible, c) => ({
      ...selection.value,
      c,
      visible,
    }))
  );

  // Snap on new selection if forced
  useEffect(() => {
    if (!linked.value && !isActive) return;
    return selectedSpine.subscribe((spineId) => {
      if (!isAltKeyDown || !spineId) return;

      let {
        t,
        z: [low, high],
      } = selection.peek();

      const spine = loader.getSpine({ t }, spineId);
      if (!spine) return;

      const [x, y, newZ] = spine.position;
      batch(() => {
        target.value = [x, y];

        // Snap to the new z;
        let zTargetDelta = 0;
        if (low > newZ) {
          zTargetDelta = newZ - low;
        } else if (high < newZ) {
          zTargetDelta = newZ - high;
        } else {
          return;
        }

        low = Math.max(0, low + zTargetDelta);
        high = Math.min(loader.z, high + zTargetDelta);
        selection.value = { t, z: [low, high] };
      });
    });
  }, [loader, selection, isActive, linked.value, target]);

  const annotationLayers = useAnnotations({
    id: `-#${id}#-annotations`,
    loader: visible ? loader : undefined,
    selection: selection.value,
    showLineSegments: showLineSegments.value,
    showAnchors: showAnchors.value,
    showLabels: showLabels.value,
    showSpines: showSpines.value,
  });

  if (!visible) return <></>;

  return (
    <>
      <Inspector>
        {() => (
          <>
            <PanelGroup className="image-inspector-controls">
              <Panel defaultExpanded className="spine-table">
                <SpineTable
                  expandedRows={segmentsExpandedRows}
                  loader={loader}
                  selection={selection.value}
                />
              </Panel>
              <Panel header="Controls" defaultExpanded>
                <Checkbox
                  checked={linked.value}
                  onChange={(_e, checked) => {
                    batch(() => {
                      linked.value = checked;
                      // Snap the global store
                      globalContrastLimits.value = contrastLimits.peek();
                      globalChannelsVisible.value = channelsVisible.peek();
                    });
                  }}
                >
                  Linked View
                </Checkbox>

                <div className="sub-title">Contrast</div>
                <ContrastControls
                  loader={loader}
                  selections={selections.value}
                  colors={colors}
                  contrastLimits={contrastLimits}
                  channelsVisible={channelsVisible}
                />
                <div className="sub-title">Layers</div>
                <VisibilityControl
                  visible={showLineSegments.value}
                  onChange={(visible) => (showLineSegments.value = visible)}
                >
                  Line Segments
                </VisibilityControl>
                <VisibilityControl
                  visible={showSpines.value}
                  onChange={(visible) => (showSpines.value = visible)}
                >
                  Spines
                </VisibilityControl>
                <VisibilityControl
                  visible={showAnchors.value}
                  onChange={(visible) => (showAnchors.value = visible)}
                >
                  Anchors
                </VisibilityControl>
                <VisibilityControl
                  visible={showLabels.value}
                  onChange={(visible) => (showLabels.value = visible)}
                >
                  Labels
                </VisibilityControl>
                <VisibilityControl
                  visible={minimap.value}
                  onChange={(visible) => (minimap.value = visible)}
                >
                  Mini Map
                </VisibilityControl>
              </Panel>
            </PanelGroup>
          </>
        )}
      </Inspector>
      <ImageViewer
        id={id}
        x={visible ? x : -width}
        y={y}
        width={width}
        height={height}
        channelsVisible={channelsVisible.value}
        minimap={minimap.value}
        colors={colors.value}
        contrastLimits={contrastLimits.value}
        selections={selections.value}
        linked={linked.value}
        target={target.value}
        layers={annotationLayers}
      >
        <ZScroll
          length={loader!.z}
          height={height}
          selection={selection}
          linked={linked.value}
          isActive={isActive}
        />
      </ImageViewer>
    </>
  );
}

ImageView.title = "Image";
