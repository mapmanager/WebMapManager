import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import { GeoJsonLayer, PolygonLayer } from "@deck.gl/layers/typed";
import { useEffect, useMemo, useState } from "react";
import { FILTERS, SELECTED_SEGMENT, SELECTED_SPINE } from "../../globals";
import { AnnotationsOptions } from "../../../../python";
import { PickingInfo } from "@deck.gl/core/typed";
import { Signal } from "@preact/signals-react";
import { AnnotatedPixelSource } from "../../../../loaders/annotations";

export interface AnnotationsProps extends AnnotationsOptions {
  id: string;
  loader: AnnotatedPixelSource;
  visible: boolean;
}

const textSizeMinPixels = 10;
const textSizeMaxPixels = 13;
const AnnotationSelections = {
  segmentID: SELECTED_SEGMENT,
  spineID: SELECTED_SPINE,
} as Record<string, Signal<string | undefined>>;

export function useAnnotations(options: AnnotationsProps): any[] {
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

  const layers = useMemo(() => {
    if (!visible) return [];
    const datasets = loader.getAnnotationsGeoJson({
      showAnchors,
      showLabels,
      showLineSegments,
      showLineSegmentsRadius,
      showSpines,
      filters,
      annotationSelections: {
        segmentID: selectedSegment,
        spineID: selectedSpine,
      },
      selection,
    });

    return [
      ...datasets.map((d, i) => {
        const data = JSON.parse(d);
        const selectOn = data.properties?.selectOn;
        const editOn = data.properties?.editOn;
        const editId = data.properties?.editId ?? "null";
        const editing = editId && data.properties?.edit;
        const translating =
          editing && editing.some((x: string) => x === "translate");
        const pickable =
          selectOn !== undefined || editOn !== undefined || translating;

        return new GeoJsonLayer({
          id: `-#${id}#-annotations-${i}`,
          data,
          pointType: "circle+text",
          lineWidthUnits: "pixels",
          lineWidthMinPixels: 1,
          lineWidthScale: translating ? 4 : 2,
          pointRadiusUnits: "pixels",
          pointRadiusMinPixels: 3,
          pointRadiusMaxPixels: 7,
          pointRadiusScale: translating ? 4 : 2,
          pickable,
          onClick: (pickingInfo: PickingInfo, event: any) => {
            const properties = pickingInfo.object?.properties;
            const key = 2 === event.tapCount ? editOn : selectOn;
            if (!key) return;
            const selection = properties[key];
            if (!selection) return;
            const selector = AnnotationSelections[key];
            if (!selector) return;
            selector.value = properties[key];
          },
          getFillColor: (x: Feature<Geometry, GeoJsonProperties>) =>
            setOpacity(x.properties?.fill, x) || [0, 0, 0, 0],
          getLineColor: (x: Feature<Geometry, GeoJsonProperties>) =>
            setOpacity(x.properties?.stroke, x) || [0, 0, 0, 0],
          getLineWidth: (x: Feature<Geometry, GeoJsonProperties>) =>
            x.properties?.strokeWidth || 1,
          lineCapRounded: true,
          getPointRadius: (x: Feature<Geometry, GeoJsonProperties>) =>
            x.properties?.radius || 1,
          lineJointRounded: true,
          textFontWeight: 700,
          getTextColor: (x: Feature<Geometry, GeoJsonProperties>) =>
            setOpacity(x.properties?.textColor, x) || [0, 0, 0, 0],
          getTextPixelOffset: (x: Feature<Geometry, GeoJsonProperties>) =>
            x.properties?.textOffset || [0, 0],
          textSizeMaxPixels,
          textSizeMinPixels,
          getTooltip: (x: Feature<Geometry, GeoJsonProperties>) =>
            x.properties?.note
              ? {
                  html: `<b>Note</b><div style="padding-top:4px;">${x.properties?.note}</div>`,
                  style: {
                    backgroundColor: "rgb(238 235 61)",
                    color: "black",
                    borderRadius: "12px",
                    padding: "8px",
                    fontSize: "0.8em",
                  },
                }
              : undefined,
        });
      }),
    ];
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
  ]);

  return layers as any;
}

function setOpacity(
  color: number[] | undefined,
  x: Feature<Geometry, GeoJsonProperties>
): [number, number, number, number] | undefined {
  if (!color) return undefined;
  const opacity = x.properties?.opacity;
  if (opacity) color[3] = opacity;
  return color as any;
}
