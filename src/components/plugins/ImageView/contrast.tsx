import React, { useEffect, useMemo, useRef } from "react";
import { typedExtent, useRasters } from "../../utils";
import * as d3 from "d3";
import { Color } from ".";
import { ViewSelection } from "../../../loaders/annotations";
import { Signal } from "@preact/signals-react";
import { VisibilityControl } from "../../Visibility";
import { ColorPicker } from "./colorPicker";

const HANDLE_SIZE = 6;
const TOP_PADDING = 3;
const nBin = 256;
const DISABLED_COLOR = [0, 0, 0] as Color;

interface Props {
  selections: ViewSelection[];
  loader: any;
  colors: Signal<Color[]>;
  contrastLimits: Signal<[number, number][]>;
  channelsVisible: Signal<[boolean, boolean]>;
}

export function ContrastControls({
  selections,
  loader,
  colors,
  contrastLimits,
  channelsVisible,
}: Props) {
  const { rasters, error } = useRasters(loader, selections);
  if (error) return <h1>{error.message}</h1>;
  let colors_ = colors.value;
  return (
    <div className="contrast-controls">
      {selections.map(({ visible, c: channel }) => (
        <ContrastControl
          visible={visible}
          contrastLimits={contrastLimits}
          channel={channel}
          raster={rasters ? rasters[channel] : undefined}
          color={colors_[channel]}
          key={channel}
          setColor={(color) => {
            const newColors = [...colors_]
            newColors[channel] = color;
            colors.value = newColors;
          }}
          toggleVisible={(visible) => {
            const newState = [...channelsVisible.peek()];
            newState[channel] = visible;
            channelsVisible.value = newState as any;
          }}
        />
      ))}
    </div>
  );
}

function ContrastControl({
  channel,
  raster,
  color,
  setColor,
  contrastLimits,
  visible,
  toggleVisible,
}: {
  raster?: Uint16Array;
  color: Color;
  setColor: (color: Color) => void;
  channel: number;
  visible: boolean;
  contrastLimits: Signal<[number, number][]>;
  toggleVisible: (visible: boolean) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contrastLimits_ = contrastLimits.value[channel];

  const [extent, bins] = useMemo(() => {
    if (!raster) return [undefined, undefined];
    const extent = typedExtent(raster) as any;
    return [extent, histogram(raster, extent as any)];
  }, [raster]);

  useEffect(() => {
    if (!svgRef.current || !raster) return;
    const svg = d3.select(svgRef.current);
    const rgbColor = d3.rgb(...color);

    const width = svgRef.current.clientWidth,
      height = svgRef.current.clientHeight;

    const x = d3.scaleLinear().domain(extent).range([0, width]);

    const y = d3
      .scaleSymlog()
      .range([height, TOP_PADDING])
      .domain([0, d3.max(bins!, (d) => d.count)!]);

    svg
      .select(".contrast-path")
      .datum(bins!)
      .attr("fill", rgbColor.darker(2.75).toString())
      .attr("stroke", rgbColor.toString())
      .attr(
        "d",
        d3
          .area<any>()
          .x(({ mean }) => x(mean))
          .y0(height)
          .y1(({ count }) => y(count))
      );

    const brush = d3
      .brushX()
      .handleSize(HANDLE_SIZE)
      .on("end", function ({ selection }) {
        if (selection !== null) return;
        d3.select(this).call(brush.move, x.range() as any);
      })
      .on("brush", function ({ selection }) {
        svg.select(".not-selected-w").attr("width", selection[0]);
        svg
          .select(".not-selected-e")
          .attr("x", selection[1])
          .attr("width", width - selection[1]);

        const state = contrastLimits.peek();
        const newSelection = selection.map(x.invert);
        if (
          newSelection[0] !== state[channel][0] ||
          newSelection[1] !== state[channel][1]
        ) {
          const newState = [...state];
          newState[channel] = newSelection;
          contrastLimits.value = newState;
        }
      });

    let currentSelection = x.range();
    const c = currentSelection;
    currentSelection = contrastLimits_.map(x);
    currentSelection[0] = Math.max(c[0], currentSelection[0]);
    currentSelection[1] = Math.min(c[1], currentSelection[1]);

    svg
      .select(".brush")
      .call(brush as any)
      .call(brush.move as any, currentSelection);
  }, [svgRef, raster, color, extent, bins, channel, contrastLimits_]);

  return (
    <div
      className={"contrast-control-container" + (visible ? "" : " disabled")}
    >
      <ColorPicker color={visible ? color : DISABLED_COLOR} setColor={setColor} />
      <svg className="contrast-control" ref={svgRef}>
        <filter id={`grayscale-filter-${channel}`}>
          <feColorMatrix type="saturate" values="0" />
        </filter>

        <path className="contrast-path" id={`contrast-path$-${channel}`} />
        <clipPath id={`not-selected-clip-${channel}`}>
          <rect className="not-selected not-selected-w" />
          <rect className="not-selected not-selected-e" />
        </clipPath>

        <g style={{ clipPath: `url(#not-selected-clip-${channel})` }}>
          <use
            xlinkHref={`#contrast-path$-${channel}`}
            style={{ filter: `url(#grayscale-filter-${channel})` }}
          />
        </g>

        <g className="brush" />
      </svg>

      <VisibilityControl visible={visible} onChange={toggleVisible} />
    </div>
  );
}

const histogram = (data: any, [start, end]: [number, number]) => {
  const delta = (end + 1 - start) / nBin;
  let results = [...new Array(nBin).keys()].map((bin) => ({
    count: 0,
    mean: bin * delta + delta / 2,
  }));

  for (const d of data) {
    const binIDX = Math.floor((d - start) / delta);
    results[binIDX].count++;
  }

  return results;
};
