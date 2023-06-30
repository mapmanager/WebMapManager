import { PluginProps } from ".";
import { Inspector } from "../layout";
import { Panel, PanelGroup, SelectPicker, Slider } from "rsuite";
import Plot from "react-plotly.js";
import { useEffect, useMemo, useState } from "react";
import { Data, PlotMouseEvent, ScatterData } from "plotly.js";
import { filters, selectedSpine, setFilters } from "./globals";
import { VisibilityControl } from "../Visibility";
import { extent, scaleLinear, scaleOrdinal, schemeCategory10 } from "d3";

const styles = {
  width: "100%",
  display: "block",
  paddingBottom: 10,
};

const updateSelected = (event: Readonly<PlotMouseEvent>) => {
  for (const point of event.points) {
    selectedSpine.value = point.text;
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

const extract = (stats: any, key: string) => stats.map((d: any) => d[key]);

export const ScatterPlotView = ({ loader, width, height }: PluginProps) => {
  const [xAxis, setXAxis] = useState("x");
  const [yAxis, setYAxis] = useState("y");
  const [zAxis, setZAxis] = useState(null);
  const [scaleOn, setScaleOn] = useState(null);
  const [segment, setSegment] = useState(null);
  const [colorOn, setColorOn] = useState("segmentID");

  // TODO: SIZE ON SCALER
  // TODO: COLOR ON Categorical & Numeric spectrum data.

  const [revision, setRevision] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [scale, setScale] = useState(7);
  const filter = filters.value;

  const stats = useMemo(
    () => loader.getSpineStats([xAxis, yAxis, zAxis, scaleOn]),
    [xAxis, yAxis, zAxis, scaleOn, loader]
  );

  useEffect(() => {
    // Reset when an axis changes.
    setRevision((i) => i++);
  }, [xAxis, yAxis, zAxis]);

  const names = loader.scalerDimensions.map((item, idx) => ({
    label: idx + 1 + " " + item,
    value: item,
  }));

  const colorScale = scaleOrdinal()
    .domain([...new Set(extract(stats, colorOn))] as any)
    .range(schemeCategory10);

  const size =
    scaleOn == null
      ? null
      : scaleLinear()
          .domain(extent(extract(stats, scaleOn) as any) as any)
          .range([0.5, 3]);

  const segmentsNames = [...new Set(stats.map((s) => s["segmentID"]))].map(
    (item) => ({
      label: item,
      value: item,
    })
  );

  const is3d = zAxis === null;
  const scatterPlotTemplate = {
    textposition: "bottom center",
    mode: ((showLabels ? "text+" : "") + "markers") as any,
    type: is3d ? "scatter" : "scatter3d",
  } as ScatterData;
  const globalSelection = selectedSpine.value;

  const hovertemplate = `<b>Spine Id - %{text}</b><br><b>${xAxis}</b> %{x}<br><b>${yAxis}</b> %{y}<br>${
    zAxis ? `<b>${zAxis}</b> %{z}<br>` : ""
  }<extra></extra>`;

  const ids = extract(stats, "id");
  const data: Data[] = [
    {
      ...scatterPlotTemplate,
      x: extract(stats, xAxis),
      y: extract(stats, yAxis),
      z: zAxis ? extract(stats, zAxis) : [],
      hovertemplate,
      text: ids,
      marker: {
        color: stats.map((stat) =>
          stat.id === globalSelection
            ? "rgb(254, 118, 7)"
            : (colorScale(stat[colorOn] as any) as any)
        ),
        size: stats.map((s) => {
          return (
            (s.id === globalSelection ? scale * 1.25 : scale) *
            (is3d ? 1 : 1.25) *
            (size == null ? 1 : size(s[scaleOn!] as any))
          );
        }),
      },
      selectedpoints: stats
        .map((stat: any, idx: number) => {
          // Filter out unselected segments
          if (!(segment === null || segment === stat.segmentID))
            return undefined;

          if (!filter || filter.has(stat.id)) return idx;

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
                value={xAxis}
                style={styles}
                data={names}
                onChange={setXAxis as any}
              />
              <SelectPicker
                label="y"
                cleanable={false}
                value={yAxis}
                style={styles}
                data={names}
                onChange={setYAxis as any}
              />
              <SelectPicker
                label="z"
                cleanable={true}
                value={zAxis}
                style={styles}
                data={names}
                onChange={setZAxis as any}
              />
            </Panel>
            <Panel header="Markers" defaultExpanded>
              <SelectPicker
                label="Size"
                cleanable={true}
                value={scaleOn}
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
    </>
  );
};

ScatterPlotView.title = "Scatter Plot";
