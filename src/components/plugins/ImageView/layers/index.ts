import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import { GeoJsonLayer, PolygonLayer } from "@deck.gl/layers/typed";
import { PathStyleExtension } from "@deck.gl/extensions/typed";
import {
  BinaryFeatures,
  BinaryLineFeatures,
  BinaryPointFeatures,
  BinaryPolygonFeatures,
} from "@loaders.gl/schema";
import { useEffect, useMemo, useState } from "react";
import { FILTERS, SELECTED_SEGMENT, SELECTED_SPINE } from "../../globals";
import { AnnotationsOptions } from "../../../../python";
import { PickingInfo } from "@deck.gl/core/typed";
import { Signal } from "@preact/signals-react";
import { PyPixelSource } from "../../../../loaders/py_loader";
import { PyProxy, TypedArray } from "pyodide/ffi";
import { OutlinePathExtension } from "./outlineExtension";
import { isShiftKeyDown } from "../../../utils";

export interface AnnotationsProps extends AnnotationsOptions {
  id: string;
  loader: PyPixelSource;
  visible: boolean;
}

const textSizeMinPixels = 10;
const textSizeMaxPixels = 13;
const AnnotationSelections = {
  segmentID: SELECTED_SEGMENT,
  spineID: SELECTED_SPINE,
} as Record<string, Signal<string | undefined>>;

let dragging: string | undefined = undefined;
let pendingDragStart: number[] | undefined = undefined;

const INTERACTIONS = ["select", "edit"];

export function useAnnotations(options: AnnotationsProps): any[] {
  const [pendingEditVersion, setPendingEditVersion] = useState(0);

  const {
    id,
    loader,
    showAnchors,
    showLabels,
    showLineSegments,
    showLineSegmentsRadius,
    showSpines,
    selection,
    visible,
  } = options;
  const filters = FILTERS.value;
  const selectedSegment = SELECTED_SEGMENT.value;
  const selectedSpine = SELECTED_SPINE.value;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Backspace") {
        if (!SELECTED_SEGMENT.peek()) return;
        const spine = SELECTED_SPINE.peek();
        if (!spine) return;
        loader.deleteSpine(spine);
        SELECTED_SPINE.value = undefined;
        setPendingEditVersion((x) => x + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: true });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loader]);

  const layers = useMemo(() => {
    if (!visible) return [];
    // console.time("getAnnotationsGeoJson");
    const annotationSelections = {
      segmentID: selectedSegment,
      spineID: selectedSpine,
    } as Record<string, string>;

    const datasets = loader.getAnnotations({
      showAnchors,
      showLabels,
      showLineSegments,
      showLineSegmentsRadius,
      showSpines,
      filters,
      annotationSelections,
      selection,
    });

    // console.timeEnd("getAnnotationsGeoJson");
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
          const z = (selection.z[1] + selection.z[0]) / 2;
          const newSpineId = loader.addSpine(selectedSegment, x, y, z);
          if (newSpineId) {
            setPendingEditVersion((x) => x + 1);
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
      const options = interactions.map((key) =>
        extractInteraction(annotationSelections, key)
      );
      const offset = properties.get("offset");
      const outline = properties.get("outline");
      const fixed = properties.get("fixed");
      const isLabel = properties.get("label") === true;
      const hasOffset = offset !== undefined;
      const hasOutline = outline !== undefined;
      const translateId = properties.get("translate");
      const pickable =
        interactions.some((x) => x !== undefined) || translateId !== undefined;

      const layer = new GeoJsonLayer({
        id: `-#${id}#-annotations-${layerId}`,
        data,
        pointType: isLabel ? "text" : "circle",
        lineWidthUnits: fixed || hasOffset || hasOutline ? "common" : "pixels",
        lineWidthMinPixels: hasOffset || hasOutline ? 0 : 1,
        lineWidthScale: hasOffset || hasOutline ? 1 : 2,
        pointRadiusUnits: fixed ? "common" : "pixels",
        pointRadiusMinPixels: 3,
        pointRadiusMaxPixels: 7,
        pointRadiusScale: 2,
        pickable,
        onClick: (pickingInfo: PickingInfo, event: any) => {
          const key = 2 === event.tapCount ? interactions[1] : interactions[0];
          if (!key) return;
          const selection = (pickingInfo.sourceLayer?.props.data as any)
            .properties[pickingInfo.index]?.id;
          if (!selection) return;
          const selector = AnnotationSelections[key];
          if (!selector) return;
          selector.value = selection;
        },
        onDragStart: (pickingInfo, event) => {
          if (!pickingInfo.coordinate || !translateId) return;
          dragging = translateId;
          pendingDragStart = pickingInfo.coordinate!;
          event.stopImmediatePropagation();
        },
        onDrag: (pickingInfo, event) => {
          const id = (pickingInfo.sourceLayer?.props.data as any).properties[
            pickingInfo.index
          ]?.id;
          if (
            dragging !== translateId ||
            !pickingInfo.coordinate ||
            !pendingDragStart ||
            !id
          )
            return;
          let [x, y] = pickingInfo.coordinate!;
          x -= pendingDragStart![0];
          y -= pendingDragStart![1];
          pendingDragStart = pickingInfo.coordinate!;
          if (loader.translate(translateId, id, x, y, false))
            setPendingEditVersion((x) => x + 1);

          event.stopImmediatePropagation();
        },
        onDragEnd: (pickingInfo, event) => {
          const id = (pickingInfo.sourceLayer?.props.data as any).properties[
            pickingInfo.index
          ]?.id;
          if (dragging !== translateId || !id || !pendingDragStart) return;
          let [x, y] = pickingInfo.coordinate! ?? [0, 0];
          x -= pendingDragStart![0];
          y -= pendingDragStart![1];

          if (loader.translate(translateId, id, x, y, true))
            setPendingEditVersion((x) => x + 1);
          event.stopImmediatePropagation();
          pendingDragStart = undefined;
          dragging = undefined;
        },
        getFillColor: getFeature(properties, "fill", options, true) || [
          0, 0, 0, 0,
        ],
        getLineColor: getFeature(properties, "stroke", options, true) || [
          0, 0, 0, 0,
        ],
        getLineWidth: getFeature(properties, "strokeWidth", options) || 1,
        getPointRadius: getFeature(properties, "radius", options) || 1,
        lineCapRounded: false,
        lineJointRounded: false,
        textFontWeight: 700,
        getText: isLabel
          ? (x: Feature<Geometry, GeoJsonProperties>) => x.properties?.id
          : undefined,
        getTextColor: isLabel
          ? getFeature(properties, "fill", options, true) || [0, 0, 0, 0]
          : undefined,
        textSizeMaxPixels,
        jointRounded: true,
        textSizeMinPixels,
        getOffset: offset,
        getDashArray: hasOffset ? [6, 6] : undefined,
        getOutlineWidth: outline,
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
    selection,
    showAnchors,
    showLabels,
    showLineSegments,
    showLineSegmentsRadius,
    showSpines,
    filters,
    selectedSegment,
    selectedSpine,
    visible,
    pendingEditVersion,
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

function decodeDatasetFromProxy(layerProxy: PyProxy): BinaryFeatures {
  return {
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

function decodePoints(layerProxy?: PyProxy): BinaryPointFeatures | undefined {
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
): BinaryPolygonFeatures | undefined {
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

function decodeLines(layerProxy?: PyProxy): BinaryLineFeatures | undefined {
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
  interactions: (string | undefined)[],
  hasOpacity: boolean = false
): ((x: Feature<Geometry, GeoJsonProperties>) => any) | undefined {
  let value = toJs(properties.get(key));
  if (!value) return undefined;

  const opacity = hasOpacity ? properties.get("opacity") : undefined;
  value = setOpacity(value, opacity);

  const variants = interactions.map((inter, i) =>
    inter
      ? setOpacity(toJs(properties.get(`${INTERACTIONS[i]}.${key}`)), opacity)
      : undefined
  );

  if (!variants.some((x) => x !== undefined)) return value;

  return (x: Feature<Geometry, GeoJsonProperties>) => {
    const idx = interactions.indexOf(x.properties!.id);
    return idx === -1 ? value : variants[idx];
  };
}

function toJs(any: any): any {
  if (any instanceof Object && any["toJs"]) return any.toJs();
  return any;
}

function extractInteraction(
  selections: Record<string, string>,
  id: string | undefined
): string | undefined {
  if (!id) return undefined;
  return selections[id];
}
