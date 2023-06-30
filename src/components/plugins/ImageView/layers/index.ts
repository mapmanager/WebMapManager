import {
  LineLayer,
  PolygonLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers/typed";
import { AnnotatedPixelSource } from "../../../../loaders/annotations";
import { ImageViewSelection } from "..";
import { useMemo } from "react";
import { filters, selectedSegment, selectedSpine } from "../../globals";

const LABEL_DISTANCE = 20;
export const HIGHLIGHTED_COLOR = [254, 118, 7];

export interface AnnotationsOptions {
  id: string;
  loader?: AnnotatedPixelSource;
  selection: ImageViewSelection;

  // View toggles
  showLineSegments?: boolean;
  showLabels?: boolean;
  showAnchors?: boolean;
  showSpines?: boolean;
}

const getPosition = ({ position }: any) => position;
const defaultScatterProps: any = {
  filled: true,
  radiusScale: 2,
  getPosition,
  opacity: 1,
  radiusMinPixels: 1,
  radiusMaxPixels: 4,
};

function useSegmentLayer({
  id,
  loader,
  selection,
  showLineSegments,
}: AnnotationsOptions): any {
  const selected = selectedSegment.value;
  return useMemo(() => {
    if (!loader || !showLineSegments) return undefined;
    return new ScatterplotLayer({
      ...defaultScatterProps,
      id: `line-segments-${id}`,
      pickable: true,
      data: loader.getLineSegments(selection),
      getFillColor: ({ color, id }) =>
        selected === id ? HIGHLIGHTED_COLOR : color,
      onClick: ({ object: { id } }) => (selectedSegment.value = id),
    });
  }, [loader, selection, id, selected, showLineSegments]);
}

function useSpineTrace({ id, loader, selection }: AnnotationsOptions): any {
  const selected = selectedSpine.value;
  return useMemo(() => {
    if (!loader) return [];
    const spineTraces = loader.getSpineTraces(selection, selected);
    if (!spineTraces) return undefined;

    return new PolygonLayer({
      id: `spine-traces-${id}`,
      data: spineTraces!,
      lineWidthUnits: "pixels",
      pickable: false,
      stroked: true,
      filled: false,
      lineWidthMinPixels: 1,
      getPolygon: ({ polygon }) => polygon,
      getLineColor: ({ strokeColor }) => strokeColor,
    });
  }, [loader, selection, id, selected]);
}

const setFilteredColor = (
  src: [number, number, number, number],
  filtered: boolean
): [number, number, number, number] => {
  if (filtered) {
    src = [...src];
    if (src.length < 4) src[3] = 255;
    src[3] /= 2; // half the opacity
  }
  return src;
};

function useSpines(
  spineData: any,
  { id, showSpines }: AnnotationsOptions
): any {
  const selected = selectedSpine.value;
  return useMemo(() => {
    if (!spineData || !showSpines) return undefined;
    const selectChanged = spineData.selectedSpine === selected;
    spineData.selectedSpine = selected;

    return new ScatterplotLayer({
      ...defaultScatterProps,
      id: `spines-${id}`,
      data: spineData,
      radiusMaxPixels: 7,
      radiusMinPixels: 3,
      radiusScale: 2,
      pickable: true,
      getFillColor: ({ color, id, filtered }) =>
        setFilteredColor(selected === id ? HIGHLIGHTED_COLOR : color, filtered),
      getRadius: ({ id }) => (selected === id ? 4 : 1),
      onClick: ({ object: { id } }) => {
        selectedSpine.value = id;
      },
      dataComparator: (oldData, newData) =>
        selectChanged && oldData === newData,

      // getTooltip is forwarded to any layer, allowing the layer to override it
      getTooltip: (spine: any) =>
        spine.note
          ? {
              html: `<b>Note</b><div style="padding-top:4px;">${spine.note}</div>`,
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
  }, [id, spineData, selected, showSpines]);
}

function useSpineUtils({
  loader,
  id,
  selection,
  showLabels,
  showAnchors,
}: AnnotationsOptions): any {
  const filter = filters.value;
  return useMemo(() => {
    if (!loader) return [];
    const spineData = loader.getSpines(selection, filter);
    if (!spineData) return [];

    const sizeMinPixels = 10;
    const sizeMaxPixels = 13;

    return [
      spineData,
      showAnchors &&
        new LineLayer({
          id: `anchors-${id}`,
          data: spineData,
          widthMinPixels: 0.5,
          widthMaxPixels: 2,
          getWidth: 50,
          getSourcePosition: ({ position }) => position,
          getTargetPosition: ({ anchor }) => anchor,
          getColor: ({ anchorColor, filtered }) =>
            setFilteredColor(anchorColor, filtered),
        }),
      showAnchors &&
        new ScatterplotLayer({
          id: `anchors-point-${id}`,
          data: spineData,
          opacity: 1,
          radiusMinPixels: 4,
          radiusMaxPixels: 4,
          radiusUnits: "pixels",
          filled: false,
          stroked: true,
          getPosition: ({ anchor }) => anchor,
          getLineWidth: 1.5,
          lineWidthScale: 1,
          lineWidthUnits: "pixels",
          getLineColor: ({ anchorColor, filtered }) =>
            setFilteredColor(anchorColor, filtered),
          radiusScale: 1,
        }),
      showLabels &&
        new TextLayer({
          id: `spines-labels-${id}`,
          data: spineData,
          fontWeight: 700,
          getText: ({ id }) => id,
          getPosition,
          getPixelOffset: ({ position, anchor }: any) => [
            0,
            Math.sign(position[1] - anchor[1]) * LABEL_DISTANCE,
          ],
          getColor: ({ textColor, filtered }) =>
            setFilteredColor(textColor, filtered),
          sizeMaxPixels,
          sizeMinPixels,
        }),
    ];
  }, [loader, selection, id, showLabels, showAnchors, filter]);
}

export function useAnnotations(options: AnnotationsOptions): any[] {
  const segmentLayer = useSegmentLayer(options);
  const [spineData, anchorLayer, anchorLayerDock, labelLayer] =
    useSpineUtils(options);

  return [
    anchorLayer,
    segmentLayer,
    anchorLayerDock,
    useSpineTrace(options),
    useSpines(spineData, options),
    labelLayer,
  ];
}
