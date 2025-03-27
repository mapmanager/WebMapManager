import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Color, DEFAULT_CONTRAST, handleDragOver } from ".";
import { ViewState } from "@map-manager/app";
import { Signal } from "@preact/signals-react";
import { VisibilityControl } from "@map-manager/app";
import { ColorPicker } from "./colorPicker";
import { pyImageChannel } from "@map-manager/app";
import { Dropdown, Loader } from "rsuite";
import TrashIcon from "@rsuite/icons/Trash";
import FileUploadIcon from "@rsuite/icons/FileUpload";
import MoreIcon from "@rsuite/icons/More";

const HANDLE_SIZE = 6;
const TOP_PADDING = 3;
const DISABLED_COLOR = [0, 0, 0] as Color;

interface ContrastControlsProps {
  viewState: ViewState[];
  sources: (pyImageChannel | undefined)[];
  colors: Signal<Color[]>;
  contrastLimits: Signal<[number, number][]>;
  channelsVisible: Signal<boolean[]>;
}

/**
 * Contrast controls component
 */
export function ContrastControls({
  viewState,
  sources,
  colors,
  contrastLimits,
  channelsVisible,
}: ContrastControlsProps) {
  let colors_ = colors.value;
  return (
    <div className="contrast-controls">
      {viewState.map(({ visible, c: channel }) => (
        <ContrastControl
          visible={visible}
          contrastLimits={contrastLimits}
          channel={channel}
          source={sources ? sources[channel] : undefined}
          color={colors_[channel]}
          key={channel}
          setColor={(color) => {
            const newColors = [...colors_];
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
  source,
  color,
  setColor,
  contrastLimits,
  visible,
  toggleVisible,
}: {
  source?: pyImageChannel;
  color: Color;
  setColor: (color: Color) => void;
  channel: number;
  visible: boolean;
  contrastLimits: Signal<[number, number][]>;
  toggleVisible: (visible: boolean) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contrastLimits_ = contrastLimits.value[channel];
  const [loading, setLoading] = useState(false);

  const [extent, bins] = useMemo(() => {
    if (!source) return [undefined, undefined];
    return [source.extent() as any, source.bins()];
  }, [source]);

  const missing = !extent || extent[0] === extent[1];
  if (missing || !source) return;

  useEffect(() => {
    if (!svgRef.current || !extent || missing) return;
    const svg = d3.select(svgRef.current);
    const rgbColor = d3.rgb(...color);

    const width = svgRef.current.clientWidth,
      height = svgRef.current.clientHeight;

    const x = d3.scaleLinear().domain(extent).range([0, width]);

    const y = d3
      .scaleSymlog()
      .range([height, TOP_PADDING])
      .domain([0, d3.max(bins!, (d) => d[1])!]);

    svg
      .select(".contrast-path")
      .datum(bins!)
      .attr("fill", rgbColor.darker(2.75).toString())
      .attr("stroke", rgbColor.toString())
      .attr(
        "d",
        d3
          .area<any>()
          .x((point) => x(point[0]))
          .y0(height)
          .y1((point) => y(point[1])),
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
          if (newSelection[1] === 0) newSelection[1] = DEFAULT_CONTRAST[1];
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
  }, [
    svgRef,
    color,
    extent,
    bins,
    channel,
    contrastLimits_,
    missing,
    contrastLimits,
  ]);

  const disabled = !visible || missing;

  return (
    <div
      className={"contrast-control-container" +
        (disabled ? (!visible ? " disabled" : " missing") : "")}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length === 0) return;
        setLoading(true);
        source!.loadChannelDrop(e).finally(() => setLoading(false));
      }}
      onDragOver={handleDragOver}
    >
      <ColorPicker
        color={disabled ? DISABLED_COLOR : color}
        setColor={setColor}
      />
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

      <div className="flex flex-col items-center gap-2 h-[50px] justify-between">
        <VisibilityControl visible={!disabled} onChange={toggleVisible} />
        <Dropdown
          size="sm"
          placement="bottomEnd"
          noCaret
          disabled={loading}
          renderToggle={(props, ref) =>
            loading
              ? <Loader className="mr-[-3px]" />
              : <MoreIcon {...props} ref={ref} className="cursor-pointer" />}
        >
          <Dropdown.Item
            icon={<FileUploadIcon />}
            onClick={() => {
              setLoading(true);
              source!.loadChannel().finally(() => setLoading(false));
            }}
          >
            Replace
          </Dropdown.Item>
          <Dropdown.Item
            icon={<TrashIcon />}
            onClick={() => source?.deleteChannel()}
            color="red"
          >
            Delete
          </Dropdown.Item>
        </Dropdown>
      </div>
    </div>
  );
}
