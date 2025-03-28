import { PluginProps } from "@map-manager/app";
import { Loader, Panel, PanelGroup, SelectPicker, Slider } from "rsuite";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js";
import { useEffect, useMemo, useState } from "react";
import { Data, PlotMouseEvent, ScatterData } from "plotly.js";
import {
  DATA_VERSION,
  FILTERS,
  SELECTED_SPINE,
  setFilters,
} from "@map-manager/app";
import { VisibilityControl } from "@map-manager/app";
import { extent, scaleLinear } from "d3";
import { ColumnAttributes } from "@map-manager/app";
import { NavBar } from "@map-manager/app";
import { InspectorNavBar, NavInspectorItem } from "@map-manager/app";
import { useSignal } from "@preact/signals-react";
import InfoOutlineIcon from "@rsuite/icons/InfoOutline";

const Plot = createPlotlyComponent(Plotly);

const styles = {
  width: "100%",
  display: "block",
  paddingBottom: 10,
};

const updateSelected = (event: Readonly<PlotMouseEvent>) => {
  for (const point of event.points) {
    SELECTED_SPINE.value = parseInt(point.text);
    return;
  }
};

const addPointsToFilter = (event: Readonly<Plotly.PlotSelectionEvent>) => {
  if (!event || (!event.range && !event.lassoPoints)) return;
  setFilters(event.points.map(({ text }) => parseInt(text)));
};

const clearFilter = () => {
  setFilters(undefined);
};

function useQueryState(
  attributes: Record<string, ColumnAttributes>,
  key: string,
): [ColumnAttributes, (key: string) => void];
function useQueryState(
  attributes: Record<string, ColumnAttributes>,
  key: string | null,
): [ColumnAttributes | null, (key: string) => void];
function useQueryState(
  attributes: Record<string, ColumnAttributes>,
  key: string | null,
): [ColumnAttributes | null, (key: string) => void] {
  const [keyState, setKeyState] = useState(key);
  return [keyState ? attributes[keyState] : null, setKeyState];
}

/**
 * The scatter plot viewer.
 * Powered by Plotly.
 */
export const ScatterPlotView = ({
  map,
  width,
  height,
  isActive,
}: PluginProps) => {
  const dataVersion = DATA_VERSION.value;
  const [attributes, names, categorical] = useMemo(() => {
    const attributes = map.columnsAttributes();
    const names = Object.entries(attributes)
      .filter(([_, attribute]) => attribute.title && attribute.plot)
      .map(([key, attribute]) => ({
        label: attribute.title,
        value: key,
        group: attribute.group,
      }));

    const categorical = Object.entries(attributes)
      .filter(([_, attribute]) => attribute.title && attribute.categorical)
      .map(([key, attribute]) => ({
        label: attribute.title,
        value: key,
        group: attribute.group,
      }));

    names.sort(
      (a, b) =>
        a.group.localeCompare(b.group) || a.label.localeCompare(b.label),
    );
    categorical.sort(
      (a, b) =>
        a.group.localeCompare(b.group) || a.label.localeCompare(b.label),
    );
    return [attributes, names, categorical];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dataVersion]);

  const [xAxis, setXAxis] = useQueryState(attributes, "x");
  const [yAxis, setYAxis] = useQueryState(attributes, "y");
  const [zAxis, setZAxis] = useQueryState(attributes, null);
  const [scaleOn, setScaleOn] = useQueryState(attributes, null);
  const [segment, setSegment] = useState(null);
  const [colorOn, setColorOn] = useQueryState(attributes, "segmentID");
  const [symbolOn, setSymbolOn] = useQueryState(attributes, null);

  // // TODO: SIZE ON SCALER
  // // TODO: COLOR ON Categorical & Numeric spectrum data.

  const [revision, setRevision] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [scale, setScale] = useState(7);
  const filter = FILTERS.value;

  useEffect(() => {
    // Reset when an axis changes.
    setRevision((i) => i++);
  }, [xAxis, yAxis, zAxis]);

  let loading = false;

  const useQuery = (
    map: PluginProps["map"],
    attributes: ColumnAttributes | null,
  ): number[] | string[] | null => {
    const value = useMemo(() => {
      if (!attributes) return null;
      return map.getColumn(attributes.key);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, dataVersion, attributes]);

    return value;
  };

  const colorsValues = useMemo(
    () =>
      map
        .getColors(colorOn?.key)
        .map((color: any) =>
          color.length === 4
            ? `rgba(${color.join(",")})`
            : `rgb(${color.join(",")})`
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, dataVersion, colorOn],
  );

  const symbols = useMemo(
    () => map.getSymbols(symbolOn?.key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, dataVersion, symbolOn],
  );

  const ids = useQuery(map, attributes["spineID"]) ?? [];
  const segmentIds = useQuery(map, attributes["segmentID"]) ?? [];
  const scaleOnValues = useQuery(map, scaleOn);
  const size = scaleOnValues == null ? null : scaleLinear()
    .domain(extent(scaleOnValues as any) as any)
    .range([0.5, 3]);

  const segmentsNames = [...new Set(segmentIds as string[])].map((item) => ({
    label: item,
    value: item,
  }));

  const is3d = zAxis === null;
  const scatterPlotTemplate = {
    textposition: "bottom center",
    mode: ((showLabels ? "text+" : "") + "markers") as any,
    type: is3d ? "scatter" : "scatter3d",
  } as ScatterData;
  const globalSelection = SELECTED_SPINE.value;

  const hovertemplate =
    `<b>Spine Id - %{text}</b><br><b>${xAxis.title}</b> %{x}<br><b>${yAxis.title}</b> %{y}<br>${
      zAxis ? `<b>${zAxis!.title}</b> %{z}<br>` : ""
    }<extra></extra>`;

  const data: Data[] = [
    {
      ...scatterPlotTemplate,
      x: useQuery(map, xAxis) ?? [],
      y: useQuery(map, yAxis) ?? [],
      z: useQuery(map, zAxis) ?? [],
      hovertemplate,
      text: ids! as string[],
      marker: {
        color: ids.map((id, idx) =>
          id === globalSelection
            ? "rgb(254, 118, 7)"
            : (colorsValues[idx] as any)
        ),
        symbol: symbols,
        size: ids.map((id, idx) => {
          return (
            (id === globalSelection ? scale * 1.25 : scale) *
            (is3d ? 1 : 1.25) *
            (size == null ? 1 : size(scaleOnValues![idx] as any))
          );
        }),
      },
      selectedpoints: ids
        .map((id: any, idx: number) => {
          // Filter out unselected segments
          if (!(segment === null || segment === segmentIds[idx])) {
            return undefined;
          }

          if (!filter || filter.has(id)) return idx;

          return undefined;
        })
        .filter((i: any) => i !== undefined) as any,
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    autosize: false,
    uirevision: "true",
    width,
    height,
  };

  // Add titles to the axis
  if (!zAxis) {
    layout["xaxis"] = {
      title: {
        text: xAxis.title,
      },
    };
    layout["yaxis"] = {
      title: {
        text: yAxis.title,
      },
    };
  } else {
    layout["scene"] = {
      xaxis: { title: xAxis.title },
      yaxis: { title: yAxis.title },
      zaxis: { title: zAxis.title },
    };
    layout["margin"] = {
      l: 0,
      r: 0,
      b: 0,
      t: 0,
    };
  }

  const activeKey = useSignal<undefined | string>(undefined);

  return (
    <>
      {isActive && (
        <>
          <NavBar>
            <div className="flex-grow" />
            <InspectorNavBar activeKey={activeKey}>
              <NavInspectorItem
                eventKey={"inspector"}
                icon={<InfoOutlineIcon />}
                Inspector={() => (
                  <PanelGroup>
                    <Panel header="Filters" defaultExpanded>
                      <SelectPicker
                        label="Segments"
                        cleanable={true}
                        value={segment}
                        style={styles}
                        data={segmentsNames}
                        onChange={setSegment as any}
                      />
                    </Panel>
                    <Panel header="Axis" defaultExpanded>
                      <SelectPicker
                        label="x"
                        groupBy="group"
                        cleanable={false}
                        value={xAxis.key}
                        style={styles}
                        data={names}
                        onChange={setXAxis as any}
                      />
                      <SelectPicker
                        label="y"
                        groupBy="group"
                        cleanable={false}
                        value={yAxis.key}
                        style={styles}
                        data={names}
                        onChange={setYAxis as any}
                      />
                      <SelectPicker
                        label="z"
                        groupBy="group"
                        cleanable={true}
                        value={zAxis?.key}
                        style={styles}
                        data={names}
                        onChange={setZAxis as any}
                      />
                    </Panel>
                    <Panel header="Markers" defaultExpanded>
                      <SelectPicker
                        label="Size"
                        groupBy="group"
                        cleanable={true}
                        value={scaleOn?.key}
                        style={styles}
                        data={names}
                        onChange={setScaleOn as any}
                      />
                      <SelectPicker
                        label="Color"
                        groupBy="group"
                        cleanable={true}
                        value={colorOn?.key}
                        style={styles}
                        data={categorical}
                        onChange={setColorOn as any}
                      />
                      <SelectPicker
                        label="Symbol"
                        groupBy="group"
                        cleanable={true}
                        value={symbolOn?.key}
                        style={styles}
                        data={categorical}
                        onChange={setSymbolOn as any}
                      />
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <label>Scale</label>
                        <div style={{ paddingLeft: 15, flexGrow: 1 }}>
                          <Slider
                            defaultValue={7}
                            min={6}
                            step={1}
                            max={20}
                            value={scale}
                            onChange={setScale}
                          />
                        </div>
                      </div>
                      <br />
                      <VisibilityControl
                        visible={showLabels}
                        onChange={setShowLabels}
                      >
                        Show Annotation Labels
                      </VisibilityControl>
                    </Panel>
                  </PanelGroup>
                )}
              >
                Inspector
              </NavInspectorItem>
            </InspectorNavBar>
          </NavBar>
        </>
      )}

      <Plot
        onSelected={addPointsToFilter}
        onDeselect={clearFilter}
        revision={revision}
        style={{ display: "block", overflow: "hidden" }}
        data={data}
        onClick={updateSelected}
        layout={layout}
      />

      {loading && <Loader backdrop center content="Analyzing" />}
    </>
  );
};

ScatterPlotView.title = "Scatter Plot";
ScatterPlotView.description = "A scatter plot viewer for analysis data.";
