import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import { GeoJsonLayer, PolygonLayer } from "@deck.gl/layers/typed";
import { PathStyleExtension } from "@deck.gl/extensions/typed";
import {
  BinaryFeatureCollection,
  BinaryLineFeature,
  BinaryPointFeature,
  BinaryPolygonFeature,
} from "@loaders.gl/schema";
import { useEffect, useMemo } from "react";
import {
  DATA_VERSION,
  FILTERS,
  EDITING_SEGMENT,
  SELECTED_SPINE,
  SELECTED_SEGMENT,
  dataChanged,
  EDITING_SEGMENT_PATH,
} from "../../globals";
import { AnnotationsOptions } from "../../../../python";
import { PickingInfo } from "@deck.gl/core/typed";
import { Signal } from "@preact/signals-react";
import { PyPixelSourceTimePoint } from "../../../../loaders/py_loader";
import { PyProxy, TypedArray } from "pyodide/ffi";
import { OutlinePathExtension } from "./outlineExtension";
import { isShiftKeyDown } from "../../../utils";
import { ZRange } from "..";

export interface AnnotationsProps extends AnnotationsOptions {
  id: string;
  loader: PyPixelSourceTimePoint;
  visible: boolean;
}

const textSizeMinPixels = 10;
const textSizeMaxPixels = 13;
const AnnotationSelections = {
  segmentID: SELECTED_SEGMENT,
  segmentIDEditing: EDITING_SEGMENT,
  segmentIDEditingPath: EDITING_SEGMENT_PATH,
  spineID: SELECTED_SPINE,
} as Record<string, Signal<number | undefined>>;

enum State {
  start = 0,
  dragging = 1,
  end = 2,
}

let dragging: string | undefined = undefined;
let state: State = State.start;

const INTERACTIONS = ["select", "edit"];
let destroyOnDrop: (() => void) | undefined = undefined;
let callOnZChange: ((z: number) => void) | undefined = undefined;
const watchForZChanges = (
  selectionSignal: Signal<ZRange>,
  updateTranslation: (z: number) => void
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

export function useAnnotations(
  selectionSignal: Signal<ZRange>,
  options: AnnotationsProps
): any[] {
  const pendingEditVersion = DATA_VERSION.value;

  const {
    id,
    loader,
    showAnchors,
    showLabels,
    showLineSegments,
    showLineSegmentsRadius,
    showSpines,
    zRange,
    visible,
  } = options;
  const filters = FILTERS.value;
  const selectedSegment = SELECTED_SEGMENT.value;
  const editingSegment = EDITING_SEGMENT.value;
  const editingSegmentPath = EDITING_SEGMENT_PATH.value;
  const selectedSpine = SELECTED_SPINE.value;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Backspace") {
        if (loader.onDelete()) return dataChanged();
        if (!EDITING_SEGMENT.peek()) return;
        const spine = SELECTED_SPINE.peek();
        if (!spine) return;
        loader.deleteSpine(spine);
        SELECTED_SPINE.value = undefined;
        dataChanged(); // TODO: Localize update
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: true });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loader]);

  const layers = useMemo(() => {
    if (!visible) return [];
    // console.time("getAnnotations_js");
    const annotationSelections = {
      segmentID: selectedSegment,
      segmentIDEditing: editingSegment,
      segmentIDEditingPath: editingSegmentPath,
      spineID: selectedSpine,
    } as Record<string, number | undefined>;

    const datasets = loader.getAnnotations({
      showAnchors,
      showLabels,
      showLineSegments,
      showLineSegmentsRadius,
      showSpines,
      filters,
      annotationSelections,
      zRange,
    });

    // console.timeEnd("getAnnotations_js");
    const layers = [];
    layers.push(
      new PolygonLayer({
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
        getPolygon: (x) => x,
        onClick: (pickingInfo: PickingInfo) => {
          if (!selectedSegment || !isShiftKeyDown) return;
          const [x, y] = pickingInfo.coordinate!;
          const z = (zRange[1] + zRange[0]) / 2;
          const newSpineId = loader.addSpine(selectedSegment, x, y, z);
          if (newSpineId) {
            dataChanged();
            SELECTED_SPINE.value = newSpineId;
          }
        },
        getFillColor: [0, 0, 0, 0],
      })
    );

    for (let i = 0; i < datasets.length; i++) {
      const layerProxy = datasets[i];
      const properties = layerProxy.get("properties");
      if (!properties) continue;
      const layerId = properties.get("id");
      // console.time("parseAnnotation");
      const data = decodeDatasetFromProxy(layerProxy);
      // console.timeEnd("parseAnnotation");
      const interactions = INTERACTIONS.map((key) => properties.get(key));
      const offset = properties.get("offset");
      const outline = properties.get("outline");
      const fixed = properties.get("fixed");
      const isLabel = properties.get("label") === true;
      const hasOffset = offset !== undefined;
      const hasOutline = outline !== undefined;
      const translate = properties.get("drag");
      const hover = properties.get("hover");
      const onHoverOut = properties.get("hoverOut");
      const click = properties.get("click");
      const pickable =
        interactions.some((x) => x !== undefined) ||
        translate !== undefined ||
        click !== undefined ||
        hover !== undefined ||
        onHoverOut !== undefined;

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
            if (click(id, x, y, z)) dataChanged();
            return;
          }

          const key = 2 === event.tapCount ? interactions[1] : interactions[0];
          if (!key) return;
          const selection = (pickingInfo.sourceLayer?.props.data as any)
            .properties[pickingInfo.index]?.id;
          if (!selection) return;
          const selector = AnnotationSelections[key];
          if (!selector) return;
          selector.value = Number(selection);
        },
        onHover: hover
          ? (pickingInfo: PickingInfo) => {
              if (!pickingInfo.picked) {
                if (onHoverOut && onHoverOut()) dataChanged();
                return;
              }
              const id = (pickingInfo.sourceLayer?.props.data as any)
                .properties[pickingInfo.index]?.id;
              let [x, y] = pickingInfo.coordinate!;
              const z = Math.trunc((zRange[1] + zRange[0]) / 2);
              if (hover(id, x, y, z)) dataChanged();
            }
          : undefined,
        onDragStart: translate
          ? (pickingInfo, event) => {
              if (!pickingInfo.coordinate) return;
              destroyOnDrop?.();
              dragging = layerId;
              event.stopImmediatePropagation();
              state = State.start;
            }
          : undefined,
        onDrag: translate
          ? (pickingInfo, event) => {
              const id = (pickingInfo.sourceLayer?.props.data as any)
                .properties[pickingInfo.index]?.id;
              if (dragging !== layerId || !pickingInfo.coordinate || !id)
                return;
              let [x, y] = pickingInfo.coordinate!;
              const z = Math.trunc((zRange[1] + zRange[0]) / 2);
              watchForZChanges(selectionSignal, (z) =>
                translate(id, x, y, z, state)
              );
              if (translate(id, x, y, z, state)) dataChanged();

              state = State.dragging;
              event.stopImmediatePropagation();
            }
          : undefined,
        onDragEnd: translate
          ? (pickingInfo, event) => {
              const id = (pickingInfo.sourceLayer?.props.data as any)
                .properties[pickingInfo.index]?.id;
              if (dragging !== layerId || !id) return;
              let [x, y] = pickingInfo.coordinate! ?? [0, 0];
              const z = Math.trunc((zRange[1] + zRange[0]) / 2);
              state = State.end;
              if (translate(id, x, y, z, state)) dataChanged();
              event.stopImmediatePropagation();
              dragging = undefined;
              destroyOnDrop?.();
            }
          : undefined,
        getFillColor: getFeature(properties, "fill", true) || [0, 0, 0, 0],
        getLineColor: getFeature(properties, "stroke", true) || [0, 0, 0, 0],
        getLineWidth: getFeature(properties, "strokeWidth") || 1,
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
        getOffset:
          offset instanceof py.ffi.PyCallable
            ? (x: Feature<Geometry, GeoJsonProperties>) =>
                offset(x.properties?.id)
            : offset,
        // getDashArray: hasOffset ? [6, 6] : undefined,
        getOutlineWidth:
          outline instanceof py.ffi.PyCallable
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

    return layers;
  }, [
    id,
    loader,
    zRange,
    showAnchors,
    showLabels,
    showLineSegments,
    showLineSegmentsRadius,
    showSpines,
    filters,
    selectedSegment,
    editingSegment,
    selectedSpine,
    visible,
    pendingEditVersion,
    editingSegmentPath,
  ]);

  return layers as any;
}

function setOpacity(
  color: number[] | undefined,
  opacity: number | undefined
): [number, number, number, number] | undefined {
  if (!color) return undefined;
  if (opacity) color[3] = opacity;
  return color as any;
}

function decodeDatasetFromProxy(layerProxy: PyProxy): BinaryFeatureCollection {
  return {
    shape: "binary-feature-collection",
    points: decodePoints(layerProxy.get("points")),
    polygons: decodePolygons(layerProxy.get("polygons")),
    lines: decodeLines(layerProxy.get("lines")),
  };
}

const defaultEntry = {
  globalFeatureIds: { value: new Uint16Array(), size: 1 },
  positions: {
    value: new Float32Array(),
    size: 2,
  },
} as any;

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

function decodePolygons(
  layerProxy?: PyProxy
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

const defaultLines = {
  ...defaultEntry,
  pathIndices: {
    value: new Uint8Array(),
    size: 2,
  },
};

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

const decodeIds = (layerProxy: PyProxy) => {
  const idsProxy = layerProxy.get("ids");
  const ids = new Array(idsProxy.length);
  for (let i = 0; i < ids.length; i++) ids[i] = { id: idsProxy.get(i) };
  return ids;
};

function decodeFeatureIds(layerProxy: PyProxy) {
  return {
    value: layerProxy.get("featureIds").toJs() as TypedArray,
    size: 1,
  };
}

function decodePosition(layerProxy: PyProxy) {
  return {
    value: layerProxy.get("positions").toJs() as TypedArray,
    size: 2,
  };
}

function getFeature(
  properties: Map<string, any>,
  key: string,
  hasOpacity: boolean = false
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

function toJs(any: any): any {
  if (any instanceof Object && any["toJs"]) return any.toJs();
  return any;
}
