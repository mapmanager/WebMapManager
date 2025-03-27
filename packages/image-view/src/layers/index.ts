import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { GeoJsonLayer, PolygonLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import {
  BinaryFeatureCollection,
  BinaryLineFeature,
  BinaryPointFeature,
  BinaryPolygonFeature,
} from "@loaders.gl/schema";
import { useEffect, useMemo } from "react";
import {
  DATA_VERSION,
  dataChanged,
  FILTERS,
  SELECTED_SEGMENT,
  SELECTED_SPINE,
} from "@map-manager/app";
import { AnnotationsOptions } from "@map-manager/app";
import { PickingInfo } from "@deck.gl/core";
import { Signal } from "@preact/signals-react";
import { MapManagerTimePointMap } from "@map-manager/app";
import { PyProxy, TypedArray } from "pyodide/ffi";
import { OutlinePathExtension } from "./outlineExtension";
import { isShiftKeyDown } from "@map-manager/app";
import { SegmentEditMode, ZRange } from "..";

export interface AnnotationsProps extends AnnotationsOptions {
  /** The view id */
  id: string;
  /** The map manager map */
  map: MapManagerTimePointMap;
  /** Whether the view is visible */
  visible: boolean;
  /** Whether the view is active */
  isActive: boolean;
  /** The active editing segment */
  editingSegmentSignal: Signal<number | undefined>;
  /** The active editing mode */
  editMode: Signal<SegmentEditMode>;
}

const textSizeMinPixels = 10;
const textSizeMaxPixels = 13;

/** The state of the dragging */
enum State {
  start = 0,
  dragging = 1,
  end = 2,
}

/** The id of the element being dragged */
let dragging: string | undefined = undefined;
/** The current state of the dragging */
let state: State = State.start;

/** The interactions, single click => "select" and double click => "edit" */
const INTERACTIONS = ["select", "edit"];

let destroyOnDrop: (() => void) | undefined = undefined;
let callOnZChange: ((z: number) => void) | undefined = undefined;

/**
 * Watches for changes in the z range
 * @param selectionSignal the selection signal
 * @param updateTranslation the update translation function
 * @returns the destroy function
 */
const watchForZChanges = (
  selectionSignal: Signal<ZRange>,
  updateTranslation: (z: number) => void,
) => {
  callOnZChange = updateTranslation;
  if (destroyOnDrop) return;
  const destroySub = selectionSignal.subscribe((z) => {
    if (callOnZChange) callOnZChange(z[0]);
  });

  destroyOnDrop = () => {
    destroySub();
    destroyOnDrop = undefined;
  };
};

/**
 * Hook to get the annotations from the python map manager map
 * @param selectionSignal the selection signal
 * @param options the annotations options
 * @returns the annotations
 */
export function useAnnotations(
  selectionSignal: Signal<ZRange>,
  options: AnnotationsProps,
): any[] {
  const pendingEditVersion = DATA_VERSION.value;

  const {
    id,
    map,
    showAnchors,
    showLabels,
    showLineSegments,
    showLineSegmentsRadius,
    showLineSegmentsOrigin,
    showSpines,
    zRange,
    visible,
    isActive,
    editingSegmentSignal,
    editMode: editModeSignal,
  } = options;
  const filters = FILTERS.value;
  const selectedSegment = SELECTED_SEGMENT.value;
  const editingSegment = editingSegmentSignal.value;
  const selectedSpine = SELECTED_SPINE.value;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isActive) return;

      if (event.key === "Backspace") {
        if (map?.onDelete()) return dataChanged();
        if (editingSegmentSignal.peek() === undefined) return;
        const spine = SELECTED_SPINE.peek();
        if (spine === undefined) return;
        map.deleteSpine(spine);
        SELECTED_SPINE.value = undefined;
        dataChanged(); // TODO: Localize update
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: true });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [map, isActive, editingSegmentSignal]);

  const editMode = editModeSignal.value;
  const layers = useMemo(() => {
    if (!visible) return [];
    const AnnotationSelections = {
      segmentID: SELECTED_SEGMENT,
      segmentIDEditing: editingSegmentSignal,
      spineID: SELECTED_SPINE,
    } as Record<string, Signal<number | undefined>>;

    // console.time("getAnnotations_js");
    const annotationSelections = {
      segmentID: selectedSegment,
      segmentIDEditing: editingSegment,
      spineID: selectedSpine,
      editMode: editingSegment === undefined ? undefined : editMode,
    } as Record<string, number | undefined>;

    const datasets = map.getAnnotations({
      showAnchors,
      showLabels,
      showLineSegments,
      showLineSegmentsRadius,
      showLineSegmentsOrigin: showLineSegmentsOrigin ||
        editMode === SegmentEditMode.SetOrigin,
      showSpines,
      filters,
      annotationSelections,
      zRange,
    });

    // console.timeEnd("getAnnotations_js");
    const layers = [];

    for (let i = 0; i < datasets.length; i++) {
      const layerProxy = datasets[i];
      const properties = layerProxy.get("properties");
      if (!properties) continue;
      const layerId = properties.get("id");
      // console.time("parseAnnotation");
      const data = decodeDatasetFromProxy(layerProxy);
      // console.timeEnd("parseAnnotation");
      const interactions = INTERACTIONS.map((key) => properties.get(key));
      const offset = getFeature(properties, "offset");
      const outline = properties.get("outline");
      const fixed = properties.get("fixed");
      const isLabel = properties.get("label") === true;
      const hasOffset = offset !== undefined;
      const hasOutline = outline !== undefined;
      const translate = properties.get("drag");
      const hover = properties.get("hover");
      const onHoverOut = properties.get("hoverOut");
      const click = properties.get("click");
      const pickable = interactions.some((x) => x !== undefined) ||
        translate !== undefined ||
        click !== undefined ||
        hover !== undefined ||
        onHoverOut !== undefined;

      const getStrokeWidth = getFeature(properties, "strokeWidth");
      const layer = new GeoJsonLayer({
        id: `-#${id}#-annotations-${layerId}`,
        data,
        pointType: isLabel ? "text" : "circle",
        lineWidthUnits: fixed || hasOffset || hasOutline ? "common" : "pixels",
        lineWidthMinPixels: hasOffset || hasOutline ? 0 : fixed ? 0 : 1,
        lineWidthScale: hasOffset || hasOutline ? 1 : fixed ? 1 : 2,
        pointRadiusUnits: fixed ? "common" : "pixels",
        pointRadiusMinPixels: 3,
        pointRadiusMaxPixels: fixed ? 2 : 7,
        pointRadiusScale: 2,
        pickable,
        onClick: (pickingInfo: PickingInfo, event: any) => {
          if (event.rightButton) {
            return;
          }
          if (click) {
            const id = (pickingInfo.sourceLayer?.props.data as any).properties[
              pickingInfo.index
            ]?.id;
            let [x, y] = pickingInfo.coordinate!;
            const z = Math.trunc((zRange[1] + zRange[0]) / 2);
            dataChanged(click(id, x, y, z));
            return;
          }

          const editing = 2 === event.tapCount;
          const key = editing ? interactions[1] : interactions[0];
          if (key === undefined || key === null) return;
          const selection = (pickingInfo.sourceLayer?.props.data as any)
            .properties[pickingInfo.index]?.id;
          if (!selection) return;
          if (editing) {
            editModeSignal.value = key;
            editingSegmentSignal.value = Number(selection);
            return;
          }

          const selector = AnnotationSelections[key];
          if (!selector) return;
          selector.value = Number(selection);
          if (key === "segmentIDEditing") {
            editModeSignal.value = SegmentEditMode.MoveSpine;
          }
        },
        onHover: hover
          ? (pickingInfo: PickingInfo) => {
            if (!pickingInfo.picked) {
              dataChanged(onHoverOut && onHoverOut());
              return;
            }
            const id = (pickingInfo.sourceLayer?.props.data as any)
              .properties[pickingInfo.index]?.id;
            let [x, y] = pickingInfo.coordinate!;
            const z = Math.trunc((zRange[1] + zRange[0]) / 2);
            dataChanged(hover(id, x, y, z));
          }
          : undefined,
        onDragStart: translate
          // eslint-disable-next-line no-loop-func
          ? (pickingInfo: any, event: any) => {
            if (!pickingInfo.coordinate) return;
            destroyOnDrop?.();
            dragging = layerId;
            event.stopImmediatePropagation();
            state = State.start;
          }
          : undefined,
        onDrag: translate
          // eslint-disable-next-line no-loop-func
          ? (pickingInfo: any, event: any) => {
            const id = (pickingInfo.sourceLayer?.props.data as any)
              .properties[pickingInfo.index]?.id;
            if (dragging !== layerId || !pickingInfo.coordinate || !id) {
              return;
            }
            let [x, y] = pickingInfo.coordinate!;
            const z = Math.trunc((zRange[1] + zRange[0]) / 2);
            watchForZChanges(
              selectionSignal,
              (z) => translate(id, x, y, z, state),
            );
            dataChanged(translate(id, x, y, z, state));

            state = State.dragging;
            event.stopImmediatePropagation();
          }
          : undefined,
        onDragEnd: translate
          // eslint-disable-next-line no-loop-func
          ? (pickingInfo: any, event: any) => {
            const id = (pickingInfo.sourceLayer?.props.data as any)
              .properties[pickingInfo.index]?.id;
            if (dragging !== layerId || !id) return;
            let [x, y] = pickingInfo.coordinate! ?? [0, 0];
            const z = Math.trunc((zRange[1] + zRange[0]) / 2);
            state = State.end;
            dataChanged(translate(id, x, y, z, state));
            event.stopImmediatePropagation();
            dragging = undefined;
            destroyOnDrop?.();
          }
          : undefined,
        getFillColor: getFeature(properties, "fill", true) || [0, 0, 0, 0],
        getLineColor: getFeature(properties, "stroke", true) || [0, 0, 0, 0],
        getLineWidth: getStrokeWidth || 1,
        getPointRadius: getFeature(properties, "radius") || 1,
        lineCapRounded: false,
        lineJointRounded: false,
        textFontWeight: 700,
        getText: isLabel
          ? (x: Feature<Geometry, GeoJsonProperties>) =>
            String(x.properties?.id)
          : undefined,
        getTextColor: isLabel
          ? getFeature(properties, "fill", true) || [0, 0, 0, 0]
          : undefined,
        textSizeMaxPixels,
        jointRounded: true,
        textSizeMinPixels,
        getOffset: offset
          ? (x: Feature<Geometry, GeoJsonProperties>) =>
            (typeof offset == "function" ? offset(x) : offset) /
            (getStrokeWidth
              ? typeof getStrokeWidth == "function"
                ? getStrokeWidth(x)
                : getStrokeWidth
              : 1)
          : undefined,
        // getDashArray: hasOffset ? [6, 6] : undefined,
        getOutlineWidth: outline instanceof py.ffi.PyCallable
          ? (x: Feature<Geometry, GeoJsonProperties>) =>
            outline(x.properties?.id)
          : outline,
        extensions: hasOffset
          ? [
            new PathStyleExtension({
              offset: true,
              dash: true,
            }),
          ]
          : hasOutline
          ? [new OutlinePathExtension()]
          : [],
        //       getTooltip: (x: Feature<Geometry, GeoJsonProperties>) =>
        //         x.properties?.note
        //           ? {
        //               html: `<b>Note</b><div style="padding-top:4px;">${x.properties?.note}</div>`,
        //               style: {
        //                 backgroundColor: "rgb(238 235 61)",
        //                 color: "black",
        //                 borderRadius: "12px",
        //                 padding: "8px",
        //                 fontSize: "0.8em",
        //               },
        //             }
        //           : undefined,
        //     });
        //   }),
      });

      layers.push(layer);
    }

    const eventLayer = new PolygonLayer({
      id: `-#${id}#-annotations-bg-selection`,
      data: [
        [
          [-2000, -2000],
          [-2000, 2000],
          [2000, 2000],
          [2000, -2000],
          [-2000, -2000],
        ],
      ],
      pickable: true,
      filled: true,
      getPolygon: (x: any) => x,
      onClick: (pickingInfo: PickingInfo) => {
        if (editingSegment === undefined || !isActive) return;

        const [x, y] = pickingInfo.coordinate!;
        const z = Math.trunc((zRange[1] + zRange[0]) / 2);

        const mode = editModeSignal.peek();
        if (isShiftKeyDown || mode === SegmentEditMode.AddSpine) {
          const newSpineId = map.addSpine(editingSegment, x, y, z);
          if (newSpineId !== undefined) {
            dataChanged();
            SELECTED_SPINE.value = newSpineId;
          }
        }
      },
      getFillColor: [0, 0, 0, 0],
    });

    layers.unshift(eventLayer);

    return layers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    map,
    zRange,
    showAnchors,
    showLabels,
    showLineSegments,
    showLineSegmentsRadius,
    showLineSegmentsOrigin,
    showSpines,
    filters,
    selectedSegment,
    editingSegment,
    selectedSpine,
    visible,
    pendingEditVersion,
    editingSegmentSignal,
    isActive,
    editMode,
    selectionSignal,
    editModeSignal,
  ]);

  return layers as any;
}

/**
 * Sets the opacity of a color
 * @param color the color
 * @param opacity the opacity
 * @returns the color with the opacity
 */
function setOpacity(
  color: number[] | undefined,
  opacity: number | undefined,
): [number, number, number, number] | undefined {
  if (!color) return undefined;
  if (opacity) color[3] = opacity;
  return color as any;
}

/**
 * Decodes the dataset from the python layer proxy
 * @param layerProxy the python layer proxy
 * @returns the decoded dataset
 */
function decodeDatasetFromProxy(layerProxy: PyProxy): BinaryFeatureCollection {
  return {
    shape: "binary-feature-collection",
    points: decodePoints(layerProxy.get("points")),
    polygons: decodePolygons(layerProxy.get("polygons")),
    lines: decodeLines(layerProxy.get("lines")),
  };
}

// Default empty entry used as a fallback when no points are defined on the
// layer
const defaultEntry = {
  globalFeatureIds: { value: new Uint16Array(), size: 1 },
  positions: {
    value: new Float32Array(),
    size: 2,
  },
} as any;

/**
 * Decodes the points from the layer proxy
 * @param layerProxy the python layer proxy
 * @returns the decoded points
 */
function decodePoints(layerProxy?: PyProxy): BinaryPointFeature | undefined {
  if (!layerProxy) return defaultEntry;
  const featureIds = decodeFeatureIds(layerProxy);

  return {
    type: "Point",
    positions: decodePosition(layerProxy),
    properties: decodeIds(layerProxy),
    globalFeatureIds: featureIds,
    featureIds,
  } as any;
}

// Default empty polygons used as a fallback when no polygons are defined
// on the layer
const defaultPoly = {
  ...defaultEntry,
  polygonIndices: {
    value: new Uint8Array(),
    size: 2,
  },
  primitivePolygonIndices: {
    value: new Uint8Array(),
    size: 2,
  },
};

/**
 * Decodes the polygons from the layer proxy
 * @param layerProxy the python layer proxy
 * @returns the decoded polygons
 */
function decodePolygons(
  layerProxy?: PyProxy,
): BinaryPolygonFeature | undefined {
  if (!layerProxy) return defaultPoly;
  const featureIds = decodeFeatureIds(layerProxy);
  const polygonIndices = {
    value: layerProxy.get("polygonIndices").toJs() as TypedArray,
    size: 1,
  };
  return {
    type: "Polygon",
    positions: decodePosition(layerProxy),
    properties: decodeIds(layerProxy),
    globalFeatureIds: featureIds,
    polygonIndices,
    primitivePolygonIndices: polygonIndices,
    featureIds,
  } as any;
}

// Default empty lines used as a fallback when no lines are defined on the layer
const defaultLines = {
  ...defaultEntry,
  pathIndices: {
    value: new Uint8Array(),
    size: 2,
  },
};

/**
 * Decodes the lines from the layer proxy
 * @param layerProxy the python layer proxy
 * @returns the decoded lines
 */
function decodeLines(layerProxy?: PyProxy): BinaryLineFeature | undefined {
  if (!layerProxy) return defaultLines;
  const featureIds = decodeFeatureIds(layerProxy);

  return {
    type: "LineString",
    globalFeatureIds: featureIds,
    featureIds,
    positions: decodePosition(layerProxy),
    pathIndices: {
      value: layerProxy.get("pathIndices").toJs() as TypedArray,
      size: 1,
    },
    properties: decodeIds(layerProxy),
  } as any;
}

/**
 * Decodes the encoded ids from python
 * @param layerProxy python layer proxy
 * @returns the ids
 */
const decodeIds = (layerProxy: PyProxy) => {
  const idsProxy = layerProxy.get("ids");
  const ids = new Array(idsProxy.length);
  for (let i = 0; i < ids.length; i++) ids[i] = { id: idsProxy.get(i) };
  return ids;
};

/**
 * Decodes the feature ids from the layer proxy
 * @param layerProxy the python layer proxy
 * @returns the feature ids
 */
function decodeFeatureIds(layerProxy: PyProxy) {
  return {
    value: layerProxy.get("featureIds").toJs() as TypedArray,
    size: 1,
  };
}

/**
 * Decodes the positions from the layer proxy
 * @param layerProxy the python layer proxy
 * @returns the positions
 */
function decodePosition(layerProxy: PyProxy) {
  return {
    value: layerProxy.get("positions").toJs() as TypedArray,
    size: 2,
  };
}

/**
 * extracts a feature from the properties
 * @param properties the properties
 * @param key the key to extract from the properties
 * @param hasOpacity  whether the feature has an opacity
 * @returns the feature or a function that returns the feature or undefined
 */
function getFeature(
  properties: Map<string, any>,
  key: string,
  hasOpacity: boolean = false,
): ((x: Feature<Geometry, GeoJsonProperties>) => any) | undefined {
  let value = properties.get(key);

  if (value instanceof py.ffi.PyCallable) {
    const opacity = hasOpacity ? properties.get("opacity") : undefined;
    return (x: Feature<Geometry, GeoJsonProperties>) =>
      setOpacity(toJs(value(x.properties?.id)), opacity);
  }

  value = toJs(value);
  if (!value) return undefined;

  const opacity = hasOpacity ? properties.get("opacity") : undefined;
  value = setOpacity(value, opacity);
  return value;
}

/**
 * Convert a Python object to a JavaScript object
 */
function toJs(any: any): any {
  if (any instanceof Object && any["toJs"]) return any.toJs();
  return any;
}
