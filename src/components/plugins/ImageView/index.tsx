import React, { useEffect, useMemo } from "react";
import { ContrastControls } from "./contrast";
import "./index.scss";
import { ZScroll } from "./z";
import { PanelGroup, Panel, Checkbox } from "rsuite";
import { Inspector } from "../../layout";
import { EDITING_SEGMENT, SELECTED_SPINE } from "../globals";
import { ImageViewer } from "./sharedViewer";
import { PluginProps } from "..";
import {
  signal,
  Signal,
  useComputed,
  useSignal,
  batch,
  useSignalEffect,
} from "@preact/signals-react";
import { useAnnotations } from "./layers";
import { isAltKeyDown, useLinkedSignal, useRasterSources } from "../../utils";
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

export type ZRange = [min: number, max: number];

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
  const showLineSegmentsRadius = useSignal(true);
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

  const time = useSignal<number>(0);
  const annotations = useMemo(() => {
    return loader.getTimePoint(time.value);
  }, [time.value, loader]);
  const zRange = useSignal<ZRange>([35, 36]);

  const selections = useComputed(() =>
    channelsVisible.value.map((visible, c) => ({
      z: zRange.value,
      c,
      visible,
    }))
  );
  const { sources, error } = useRasterSources(annotations, selections.value);

  // Snap on new selection if forced
  useEffect(() => {
    if (!linked.value && !isActive) return;
    return SELECTED_SPINE.subscribe((spineId) => {
      if (!isAltKeyDown || !spineId) return;

      let [low, high] = zRange.peek();

      const spine = annotations.getSpinePosition(spineId);
      if (!spine) return;

      const [x, y, newZ] = spine;
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
        high = Math.min(annotations.z, high + zTargetDelta);
        zRange.value = [low, high];
      });
    });
  }, [annotations, zRange, isActive, linked.value, target]);

  const annotationLayers = useAnnotations(zRange, {
    id,
    loader: annotations,
    showLineSegments: showLineSegments.value,
    showAnchors: showAnchors.value,
    showLabels: showLabels.value,
    showSpines: showSpines.value,
    zRange: zRange.value,
    showLineSegmentsRadius: showLineSegmentsRadius.value,
    annotationSelections: {},
    visible,
  });

  useSignalEffect(() => {
    if (EDITING_SEGMENT.value) {
      // restrict z when segment is being edited
      const z = zRange.value;
      if (z[0] - z[1] !== -1) {
        const mean = Math.trunc((z[0] + z[1]) / 2);
        zRange.value = [mean, mean + 1];
      }
    }
  });

  if (!visible) return <></>;
  if (error) return <h1>{error.message}</h1>;

  return (
    <>
      <Inspector>
        {() => (
          <>
            <PanelGroup className="image-inspector-controls">
              <Panel defaultExpanded className="spine-table">
                <SpineTable
                  expandedRows={segmentsExpandedRows}
                  loader={annotations}
                  selection={zRange.value}
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
                  sources={sources!}
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
                  visible={showLineSegmentsRadius.value}
                  onChange={(visible) =>
                    (showLineSegmentsRadius.value = visible)
                  }
                >
                  Line Segments Bounds
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
        loader={annotations}
        layers={annotationLayers}
      >
        <ZScroll
          length={annotations!.z}
          height={height}
          selection={zRange}
          linked={linked.value}
          isActive={isActive}
        />
      </ImageViewer>
    </>
  );
}

ImageView.title = "Image";
