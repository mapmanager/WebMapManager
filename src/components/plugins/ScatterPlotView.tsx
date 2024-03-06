import { PluginProps } from ".";
import { Inspector } from "../layout";
import { Loader, Panel, PanelGroup, SelectPicker, Slider } from "rsuite";
import Plot from "react-plotly.js";
import { useEffect, useMemo, useState } from "react";
import { Data, PlotMouseEvent, ScatterData } from "plotly.js";
import { FILTERS, SELECTED_SPINE, setFilters } from "./globals";
import { VisibilityControl } from "../Visibility";
import { extent, scaleLinear, scaleOrdinal, schemeCategory10 } from "d3";
import { pyQuery } from "../../python";
import { useAsync } from "react-use";

const styles = {
  width: "100%",
  display: "block",
  paddingBottom: 10,
};

const updateSelected = (event: Readonly<PlotMouseEvent>) => {
  for (const point of event.points) {
    SELECTED_SPINE.value = point.text;
    return;
  }
};

const addPointsToFilter = (event: Readonly<Plotly.PlotSelectionEvent>) => {
  if (!event || (!event.range && !event.lassoPoints)) return;
  setFilters(event.points.map(({ text }) => text));
};

const clearFilter = () => {
  setFilters(undefined);
};

function useQueryState(
  queries: Record<string, pyQuery>,
  key: string
): [pyQuery, (key: string) => void];
function useQueryState(
  queries: Record<string, pyQuery>,
  key: string | null
): [pyQuery | null, (key: string) => void];
function useQueryState(
  queries: Record<string, pyQuery>,
  key: string | null
): [pyQuery | null, (key: string) => void] {
  const [keyState, setkeyState] = useState(key);
  return [keyState ? queries[keyState] : null, setkeyState];
}

export const ScatterPlotView = ({ loader, width, height }: PluginProps) => {
  const [queries, names] = useMemo(() => {
    const obj = Object.create(null);
    const names = [] as { label: string; value: string }[];
    loader.queries().forEach((query, index) => {
      const title = query.getTitle();
      obj[title] = query;
      names.push({ label: `${index + 1}. ${title}`, value: title });
    });

    return [obj, names];
  }, [loader]);

  const [xAxis, setXAxis] = useQueryState(queries, "x");
  const [yAxis, setYAxis] = useQueryState(queries, "y");
  const [zAxis, setZAxis] = useQueryState(queries, null);
  const [scaleOn, setScaleOn] = useQueryState(queries, null);
  const [segment, setSegment] = useState(null);
  const [colorOn, setColorOn] = useQueryState(queries, "Segment ID");

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
    loader: PluginProps["loader"],
    query: pyQuery | null
  ): number[] | string[] | null => {
    const value = useAsync(async () => {
      if (!query) return null;
      return (await loader.runQuery(query)).tolist().toJs();
    }, [loader, query]);

    loading ||= value.loading;
    return value.value;
  };

  const colorsValues = (useQuery(loader, colorOn) as string[]) ?? [];
  const colorScale = scaleOrdinal()
    .domain([...new Set(colorsValues)] as any)
    .range(schemeCategory10);

  const ids = useQuery(loader, queries["Spine ID"]) ?? [];
  const segmentIds = useQuery(loader, queries["Segment ID"]) ?? [];
  const scaleOnValues = useQuery(loader, scaleOn);
  const size =
    scaleOnValues == null
      ? null
      : scaleLinear()
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

  const hovertemplate = `<b>Spine Id - %{text}</b><br><b>${xAxis.getTitle()}</b> %{x}<br><b>${yAxis.getTitle()}</b> %{y}<br>${
    zAxis ? `<b>${zAxis!.getTitle()}</b> %{z}<br>` : ""
  }<extra></extra>`;

  const data: Data[] = [
    {
      ...scatterPlotTemplate,
      x: useQuery(loader, xAxis) ?? [],
      y: useQuery(loader, yAxis) ?? [],
      z: useQuery(loader, zAxis) ?? [],
      hovertemplate,
      text: ids! as string[],
      marker: {
        color: ids.map((id, idx) =>
          id === globalSelection
            ? "rgb(254, 118, 7)"
            : (colorScale(colorsValues[idx] as any) as any)
        ),
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
          if (!(segment === null || segment === segmentIds[idx]))
            return undefined;

          if (!filter || filter.has(id)) return idx;

          return undefined;
        })
        .filter((i: any) => i !== undefined) as any,
    },
  ];

  const layout: any = {
    autosize: false,
    uirevision: "true",
    width,
    height,
  };

  // Add titles to the axis
  if (!zAxis) {
    layout["xaxis"] = {
      title: {
        text: xAxis,
      },
    };
    layout["yaxis"] = {
      title: {
        text: yAxis,
      },
    };
  } else {
    layout["scene"] = {
      xaxis: { title: xAxis },
      yaxis: { title: yAxis },
      zaxis: { title: zAxis ?? "" },
    };
    layout["margin"] = {
      l: 0,
      r: 0,
      b: 0,
      t: 0,
    };
  }

  return (
    <>
      <Inspector>
        {() => (
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
                cleanable={false}
                value={xAxis.getTitle()}
                style={styles}
                data={names}
                onChange={setXAxis as any}
              />
              <SelectPicker
                label="y"
                cleanable={false}
                value={yAxis.getTitle()}
                style={styles}
                data={names}
                onChange={setYAxis as any}
              />
              <SelectPicker
                label="z"
                cleanable={true}
                value={zAxis?.getTitle()}
                style={styles}
                data={names}
                onChange={setZAxis as any}
              />
            </Panel>
            <Panel header="Markers" defaultExpanded>
              <SelectPicker
                label="Size"
                cleanable={true}
                value={scaleOn?.getTitle()}
                style={styles}
                data={names}
                onChange={setScaleOn as any}
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
              <VisibilityControl visible={showLabels} onChange={setShowLabels}>
                Show Annotation Labels
              </VisibilityControl>
            </Panel>
          </PanelGroup>
        )}
      </Inspector>

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
