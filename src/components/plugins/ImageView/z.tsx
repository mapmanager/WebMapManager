import * as d3 from "d3";
import React, { useCallback, useEffect, useRef } from "react";
import { ImageViewSelection } from ".";
import { Signal } from "@preact/signals-react";

const HANDLE_SIZE = 4;
const SCROLL_SPEED = 0.15;
const SHIFT_SKIP = 3;

interface Props {
  selection: Signal<ImageViewSelection>;
  linked: boolean;
  isActive: boolean;
  length: number;
  height: number;
}

interface SharedEvent {
  deltaMin: number;
  deltaMax: number;
}

export function ZScroll({
  selection,
  height,
  length,
  linked,
  isActive,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const roundSelection = useCallback(
    (selection: any) => {
      if (selection[1] < selection[0]) {
        let temp = selection[0];
        selection[0] = selection[1];
        selection[1] = temp;
      }

      const distance = Math.max(Math.round(selection[1] - selection[0]), 1);
      let start = Math.max(Math.round(selection[0]), 0);
      let end = start + distance;
      if (end > length) {
        end = length;
        start = end - distance;
      }

      return [start, end] as any;
    },
    [length]
  );

  useEffect(() => {
    if (!isActive) {
      if (!linked) return;
      const linkedHandler = ({
        detail: { deltaMin, deltaMax },
      }: CustomEvent<SharedEvent>) => {
        const state = selection.peek();
        const [min, max] = state.z;

        selection.value = {
          ...state,
          z: roundSelection([min + deltaMin, max + deltaMax]),
        };
      };

      window.addEventListener("z-scale", linkedHandler as any);
      return () => {
        window.removeEventListener("z-scale", linkedHandler as any);
      };
    }
    if (!svgRef.current) return;

    const setSelection = (z: [number, number]) => {
      const state = selection.peek();
      const deltaMin = z[0] - state.z[0];
      const deltaMax = z[1] - state.z[1];
      if (deltaMin !== 0 || deltaMax !== 0) {
        if (linked) {
          window.dispatchEvent(
            new CustomEvent("z-scale", {
              detail: {
                deltaMin,
                deltaMax,
              },
            })
          );
        }

        selection.value = {
          ...state,
          z,
        };
      }
    };

    const svg = d3.select(svgRef.current);
    const height = svgRef.current.clientHeight;

    const yBand = d3
      .scaleBand()
      .range([0, height])
      .paddingInner(0.3)
      .paddingOuter(0.15)
      // Add one since the the range does not include the end
      .domain([...Array(length).keys()] as any);
    const maxRange = yBand.range()[1];
    const y: any = (d: number) => yBand(d as any) ?? maxRange;
    y.invert = (d: number) => d / yBand.step();

    const slidePadding = (yBand.step() - yBand.bandwidth()) / 2;
    const toSlide = ([start, end]: [number, number]): [number, number] => [
      y(start) - slidePadding,
      y(end) - (end === length ? 0 : slidePadding),
    ];

    const slides = svg
      .select(".slides")
      .selectAll(".slide")
      .data(yBand.domain());

    slides
      .enter()
      .append("rect")
      .attr("class", "slide")
      .attr("width", "70%")
      .attr("height", yBand.bandwidth())
      .attr("y", yBand as any);

    slides.attr("height", yBand.bandwidth()).attr("y", yBand as any);

    const brushEl = svg.select(".brush");
    const brush = d3
      .brushY()
      .handleSize(HANDLE_SIZE)
      .on("brush", function ({ sourceEvent, mode, selection }) {
        if (!sourceEvent) return;
        const isDrag = mode === "drag";
        const newSelectionY = selection.map(y.invert);
        const newSelection = roundSelection(newSelectionY);

        if (!isDrag) {
          d3.select(this).call(brush.move, toSlide(newSelection));
        }
        setSelection(newSelection);
      })
      .on("end", function ({ sourceEvent, selection }) {
        if (!sourceEvent) return;
        const newSelection = roundSelection(selection.map(y.invert));
        d3.select(this).transition().call(brush.move, toSlide(newSelection));
        setSelection(newSelection);
      });

    const scroll = (dy: number) => {
      const selection = d3.brushSelection(brushEl.node() as any)! as any;
      const distance = selection[1] - selection[0];

      selection[0] = Math.max(selection[0] + dy, 0);
      selection[1] = selection[0] + distance;

      // Lock to base
      if (selection[1] > height) {
        selection[1] = height;
        selection[0] = selection[1] - distance;
      }

      brushEl.call(brush.move as any, selection);
      setSelection(roundSelection(selection.map(y.invert)));
    };

    const snap = () => {
      const selection = d3.brushSelection(brushEl.node() as any)! as any;
      const newSelection = roundSelection(selection.map(y.invert));
      brushEl.transition().call(brush.move as any, toSlide(newSelection));
      setSelection(newSelection);
    };

    const drag = d3
      .drag()
      .on("start", ({ y: offsetY }) => {
        const selection = d3.brushSelection(brushEl.node() as any)! as any;
        const average = selection[0] + (selection[1] - selection[0]) / 2;
        const delta = offsetY - average;

        selection[0] += delta;
        selection[1] += delta;

        const newSelection = roundSelection(selection.map(y.invert));
        brushEl.call(brush.move as any, toSlide(newSelection));
        setSelection(newSelection);
      })
      .on("drag", ({ dy }) => scroll(dy))
      .on("end", snap);

    brushEl
      .call(brush as any)
      .call(
        brush.move as any,
        toSlide(roundSelection(selection.peek().z as any))
      )
      .select(".overlay")
      .call(drag as any);

    brushEl.on(
      "wheel",
      (event) => {
        scroll(event.deltaY * SCROLL_SPEED);
        clearTimeout((brushEl as any).timeout);
        (brushEl as any).timeout = setTimeout(snap, 200);
        event.preventDefault();
      },
      { passive: false }
    );

    const handler = (event: KeyboardEvent) => {
      const { key, shiftKey } = event;

      const scale = yBand.step() * (shiftKey ? SHIFT_SKIP : 1);
      if (key === "ArrowDown") {
        scroll(scale);
      } else if (key === "ArrowUp") {
        scroll(-scale);
      } else {
        return;
      }
      event.preventDefault();
      snap();
    };

    window.addEventListener("keydown", handler, { passive: false });
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [svgRef, height, length, selection, selection.value.z, linked, roundSelection, isActive]);

  if (!isActive) return <></>;
  
  return (
    <svg ref={svgRef} className="z-control">
      <g className="slides" />
      <g className="brush" />
    </svg>
  );
}
