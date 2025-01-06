import React, { useEffect, useMemo } from "react";
import { ContrastControls } from "./contrast";
import "./index.scss";
import { ZScroll } from "./z";
import { PanelGroup, Panel, Nav, IconButton } from "rsuite";
import { Inspector, NavBar } from "../../layout";
import { DATA_VERSION, SELECTED_SEGMENT, SELECTED_SPINE } from "../globals";
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
import {
  isAltKeyDown,
  onEscape,
  useLinkedSignal,
  useRasterSources,
} from "../../utils";
import { VisibilityControl } from "../../Visibility";
import { SpineTable } from "./spineSegmentTable";
import { COLORS_SELECTOR_OPTIONS } from "./colorPicker";
import { color as D3Color } from "d3";
import { IoUnlinkSharp, IoLinkSharp } from "react-icons/io5";
import { TbVectorBezier2 } from "react-icons/tb";
import { MdEditRoad } from "react-icons/md";
import { MdAddRoad } from "react-icons/md";
import { RiMapPinAddFill } from "react-icons/ri";
import { RiDragMoveLine } from "react-icons/ri";
import { IoIosMove } from "react-icons/io";
import { TScroll } from "./t";

export const DEFAULT_CONTRAST: [number, number] = [0, 2 ** 11];
const DEFAULT_COLOR: Color[] = COLORS_SELECTOR_OPTIONS.map((color) => {
  const { r, g, b } = D3Color(color)?.rgb()!;
  return [r, g, b];
});

const globalColor: Signal<Color[]> = signal(DEFAULT_COLOR);

export type ZRange = [min: number, max: number];

export type Color = [number, number, number];

const globalContrastLimits = signal<[number, number][]>([
  DEFAULT_CONTRAST,
  DEFAULT_CONTRAST,
]);
const globalChannelsVisible = signal<boolean[]>([true, true]);

function computeGridDimensions(
  x: number,
  y: number,
  width: number,
  height: number,
  elements: number,
  index: number
): {
  width: number;
  height: number;
  x: number;
  y: number;
} {
  const columns = Math.ceil(Math.sqrt(elements));
  const rows = Math.ceil(elements / columns);

  const gridWidth = width / columns;
  const gridHeight = height / rows;

  const col = index % columns;
  const row = Math.floor(index / columns);

  return {
    width: gridWidth,
    height: gridHeight,
    x: x + col * gridWidth,
    y: y + row * gridHeight,
  };
}

export enum SegmentEditMode {
  MoveSpine = 0,
  Path = 1,
  AddSpine = 2,
  SetOrigin = 3,
}

export function ImageView(props: PluginProps) {
  const minimap = useSignal(false);
  const showLineSegments = useSignal(true);
  const showSpines = useSignal(true);
  const showAnchors = useSignal(true);
  const showLabels = useSignal(true);
  const showLineSegmentsRadius = useSignal(true);
  const showLineSegmentsOrigin = useSignal(true);
  const time = useSignal(0);
  const focusedIndex = useSignal(0);
  const gridCount = useSignal(1);

  const heightOffset = useComputed(() => {
    void DATA_VERSION.value;
    return props.loader.timePoints().length > 1 ? -23 : 0;
  }).value;

  const times = useComputed(() => {
    void DATA_VERSION.value;
    const timePoints = props.loader.timePoints();
    const timesArray: number[] = [];
    const t = time.value;
    const range = gridCount.value;
    for (let i = t - Math.floor(range / 2); i < t + Math.ceil(range / 2); i++) {
      if (timePoints.indexOf(i) !== -1) {
        timesArray.push(i);
      } else {
        timesArray.push(-1);
      }
    }

    if (focusedIndex.peek() >= timesArray.length) {
      focusedIndex.value = Math.max(0, timesArray.length - 1);
    }

    return timesArray;
  });

  const length = times.value.length;
  const focusedIdx = focusedIndex.value;
  return (
    <div className="relative h-full w-full overflow-hidden">
      {times.value.map((time, idx) => {
        if (time === -1) return null;
        const { width, height, x, y } = computeGridDimensions(
          props.x,
          props.y,
          props.width,
          Math.max(props.height + heightOffset, 0),
          length,
          idx
        );

        const active = props.isActive && focusedIdx === idx;
        return (
          <div
            key={idx}
            onMouseDown={() => {
              focusedIndex.value = idx;
            }}
            style={{
              position: "absolute",
              pointerEvents: active ? "none" : "auto",
              left: `${x - props.x + 0.5}px`,
              top: `${y - props.y + 0.5}px`,
              width: width - 1 + "px",
              height: height - 1 + "px",
              boxShadow: "black 0px 0px 0px 1px",
            }}
          >
            <ImageInnerView
              key={idx}
              time={time}
              minimap={minimap}
              showLineSegments={showLineSegments}
              showSpines={showSpines}
              showAnchors={showAnchors}
              showLabels={showLabels}
              showLineSegmentsRadius={showLineSegmentsRadius}
              showLineSegmentsOrigin={showLineSegmentsOrigin}
              {...props}
              isActive={active}
              id={props.id + idx}
              x={x}
              y={y}
              width={width}
              height={height}
            />
            {length > 1 && (
              <div className="time-point-label">
                t{time + 1} <span>- {props.loader.metadata(time).name}</span>
              </div>
            )}
          </div>
        );
      })}
      <TScroll
        loader={props.loader}
        time={time}
        isActive={props.isActive}
        gridCount={gridCount}
        times={times.value}
      />
    </div>
  );
}

interface ImageInnerViewProps extends PluginProps {
  minimap: Signal<boolean>;
  showLineSegments: Signal<boolean>;
  showSpines: Signal<boolean>;
  showAnchors: Signal<boolean>;
  showLabels: Signal<boolean>;
  showLineSegmentsRadius: Signal<boolean>;
  showLineSegmentsOrigin: Signal<boolean>;
  time: number;
}

function ImageInnerView({
  loader,
  width,
  height,
  x,
  y,
  id,
  isActive,
  visible: visibleSignal,
  minimap,
  showLineSegments,
  showSpines,
  showAnchors,
  showLabels,
  showLineSegmentsRadius,
  showLineSegmentsOrigin,
  time,
}: ImageInnerViewProps) {
  const annotations = useMemo(() => loader.getTimePoint(time), [time, loader]);
  const linked = useSignal(true);
  const target = useSignal<[number, number] | undefined>(undefined);
  const colors = useLinkedSignal<Color[]>(DEFAULT_COLOR, globalColor, linked);
  const activeKey = useSignal(undefined);
  const editingSegmentSignal = useSignal<number | undefined>(undefined);
  const segmentEditMode = useSignal<SegmentEditMode>(SegmentEditMode.MoveSpine);

  const version = DATA_VERSION.value;

  // Store expanded rows in the in the image view so that the state is maintained even if the inspector is not shown
  const segmentsExpandedRows = useSignal<string[]>([]);
  const contrastLimits = useLinkedSignal<[number, number][]>(
    [DEFAULT_CONTRAST, DEFAULT_CONTRAST],
    globalContrastLimits,
    linked
  );
  const channelsVisible = useLinkedSignal<boolean[]>(
    [true, true],
    globalChannelsVisible,
    linked
  );

  useEffect(
    () =>
      onEscape.addListener(() => {
        if (SELECTED_SPINE.peek() !== undefined) {
          SELECTED_SPINE.value = undefined;
          return true;
        }

        if (editingSegmentSignal.value !== undefined) {
          editingSegmentSignal.value = undefined;
          return true;
        }
      }),
    [editingSegmentSignal]
  );

  useEffect(() => {
    const maxChannels = loader.maxChannels();
    if (maxChannels === globalChannelsVisible.value.length) {
      channelsVisible.value = [...channelsVisible.value];
      return;
    }
    channelsVisible.value = Array(maxChannels).fill(true);
    contrastLimits.value = Array(maxChannels).fill(DEFAULT_CONTRAST);
    globalChannelsVisible.value = Array(maxChannels).fill(true);
    globalContrastLimits.value = Array(maxChannels).fill(DEFAULT_CONTRAST);
  }, [version]);

  const zRange = useSignal<ZRange>([35, 36]);
  const visible = visibleSignal.value;

  const selections = useMemo(() => {
    return channelsVisible.value.map((visible, c) => ({
      z: zRange.value,
      c,
      visible,
      time,
    }));
  }, [zRange.value, time]);
  const { sources, error } = useRasterSources(annotations, selections);

  // Snap on new selection if forced
  useEffect(() => {
    if (!linked.value && !isActive) return;
    return SELECTED_SPINE.subscribe((spineId) => {
      if (!isAltKeyDown || spineId === undefined) return;

      let [low, high] = zRange.peek();

      const spine = annotations?.getSpinePosition(spineId);
      if (!spine) return;

      const [x, y, newZ] = spine;
      batch(() => {
        target.value = [x, y];

        const distance = Math.floor((high - low) / 2);
        low = Math.max(0, newZ - distance);
        high = Math.min(annotations.z, newZ + distance);
        zRange.value = [low, high];
      });
    });
  }, [annotations, zRange, isActive, linked.value, target]);

  const editingSegment = editingSegmentSignal.value;

  const annotationLayers = useAnnotations(zRange, {
    id,
    loader: annotations,
    showLineSegments: showLineSegments.value,
    showAnchors: showAnchors.value,
    showLabels: showLabels.value,
    showSpines: showSpines.value,
    zRange: zRange.value,
    showLineSegmentsRadius: showLineSegmentsRadius.value,
    showLineSegmentsOrigin: showLineSegmentsOrigin.value,
    annotationSelections: {},
    visible,
    isActive,
    editingSegmentSignal,
    editMode: segmentEditMode,
  });

  useSignalEffect(() => {
    if (editingSegmentSignal.value !== undefined) {
      // restrict z when segment is being edited
      const z = zRange.value;
      if (z[0] - z[1] !== -1) {
        const mean = Math.trunc((z[0] + z[1]) / 2);
        zRange.value = [mean, mean + 1];
      }
    }
  });

  function setSegmentEditMode(mode: SegmentEditMode) {
    if (editingSegmentSignal.peek() === undefined) {
      editingSegmentSignal.value = SELECTED_SEGMENT.value;
      segmentEditMode.value = mode;
      return;
    }

    if (
      segmentEditMode.peek() === SegmentEditMode.MoveSpine &&
      mode === SegmentEditMode.MoveSpine
    ) {
      editingSegmentSignal.value = undefined;
      return;
    }

    segmentEditMode.value =
      segmentEditMode.peek() === mode ? SegmentEditMode.MoveSpine : mode;
  }

  // if (!visible) return <></>;
  if (error) return <h1>{error.message}</h1>;

  return (
    <>
      {isActive && (
        <NavBar>
          {() => (
            <>
              <Nav
                activeKey={activeKey.value}
                onSelect={(v) => (activeKey.value = v)}
                className="flex-grow"
              >
                <Nav.Item
                  eventKey="move_segment_spines"
                  disabled={SELECTED_SEGMENT.value === undefined}
                  active={
                    editingSegment !== undefined &&
                    segmentEditMode.value === SegmentEditMode.MoveSpine
                  }
                  icon={<TbVectorBezier2 />}
                  onClick={() => {
                    setSegmentEditMode(SegmentEditMode.MoveSpine);
                  }}
                >
                  Move Spines
                </Nav.Item>
                <Nav.Item
                  eventKey="add_segment_spines"
                  disabled={SELECTED_SEGMENT.value === undefined}
                  active={
                    editingSegment !== undefined &&
                    segmentEditMode.value === SegmentEditMode.AddSpine
                  }
                  icon={<RiMapPinAddFill />}
                  onClick={() => {
                    setSegmentEditMode(SegmentEditMode.AddSpine);
                  }}
                >
                  Add Spines
                </Nav.Item>
                <Nav.Item
                  eventKey="set_segment_origin"
                  disabled={SELECTED_SEGMENT.value === undefined}
                  active={
                    editingSegment !== undefined &&
                    segmentEditMode.value === SegmentEditMode.SetOrigin
                  }
                  icon={<RiDragMoveLine />}
                  onClick={() => {
                    setSegmentEditMode(SegmentEditMode.SetOrigin);
                  }}
                >
                  Set Segment Origin
                </Nav.Item>
                <Nav.Item divider />
                <Nav.Item
                  eventKey="new_segment_path"
                  icon={<MdAddRoad />}
                  disabled={annotations!.shape[0] === 0}
                  active={false}
                  onClick={() => {
                    const id = Number(annotations.newSegment());
                    editingSegmentSignal.value = id;
                    segmentEditMode.value = SegmentEditMode.Path;
                    SELECTED_SEGMENT.value = id;
                  }}
                >
                  New Segment Path
                </Nav.Item>
                <Nav.Item
                  eventKey="edit_segment_path"
                  disabled={SELECTED_SEGMENT.value === undefined}
                  active={
                    editingSegment !== undefined &&
                    segmentEditMode.value === SegmentEditMode.Path
                  }
                  icon={<MdEditRoad />}
                  onClick={() => {
                    setSegmentEditMode(SegmentEditMode.Path);
                  }}
                >
                  Edit Segment Path
                </Nav.Item>
              </Nav>
            </>
          )}
        </NavBar>
      )}
      <Inspector>
        {() => {
          if (!isActive) return <></>;
          return (
            <>
              <PanelGroup className="image-inspector-controls">
                <Panel defaultExpanded className="spine-table">
                  <SpineTable
                    expandedRows={segmentsExpandedRows}
                    loader={annotations}
                    selection={zRange.value}
                    editingSegmentSignal={editingSegmentSignal}
                    editMode={segmentEditMode}
                  />
                </Panel>
                <Panel defaultExpanded>
                  <ContrastControls
                    sources={sources!}
                    selections={selections}
                    colors={colors}
                    contrastLimits={contrastLimits}
                    channelsVisible={channelsVisible}
                  />
                </Panel>
                <Panel defaultExpanded>
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
                    visible={showLineSegmentsOrigin.value}
                    onChange={(visible) =>
                      (showLineSegmentsOrigin.value = visible)
                    }
                  >
                    Line Segments Origin
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
          );
        }}
      </Inspector>
      {annotations!.shape[0] === 0 ? (
        <div className="flex items-center justify-center h-full w-full bg-[#1a1a1a] relative overflow-hidden">
          <div>Missing Channel</div>
          <div className="linked-control">
            <IconButton
              color="orange"
              icon={linked.value ? <IoLinkSharp /> : <IoUnlinkSharp />}
              appearance="link"
              size="xs"
              circle
              onClick={() => (linked.value = !linked.value)}
            />
          </div>
        </div>
      ) : (
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
          selections={selections}
          linked={linked.value}
          target={target.value}
          loader={annotations}
          layers={annotationLayers}
        >
          <ZScroll
            length={annotations!.z}
            selection={zRange}
            linked={linked.value}
            isActive={isActive}
            height={height}
          />
          <div className="linked-control">
            <IconButton
              color="orange"
              icon={linked.value ? <IoLinkSharp /> : <IoUnlinkSharp />}
              appearance="link"
              size="xs"
              circle
              onClick={() => (linked.value = !linked.value)}
            />
          </div>
          {/* {(editingSegment || editingSegmentPath) && (
          <Notification>
            {editingSegmentPath ? "Editing Segment Path" : "Editing Spines"}
            <Button
              size="sm"
              className="float-right"
              onClick={() => {
                if (editingSegmentPath) {
                  editingSegmentPathSignal.value = undefined;
                  return;
                }

                editingSegmentSignal.value = undefined;
              }}
            >
              Done
            </Button>
          </Notification>
        )} */}
        </ImageViewer>
      )}
    </>
  );
}

ImageView.title = "Image";
