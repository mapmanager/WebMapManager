import * as d3 from "d3";
import { useCallback, useEffect, useRef, useState } from "react";
import { ZRange } from ".";
import { Signal } from "@preact/signals-react";

/** The size of the control handle */
const HANDLE_SIZE = 4;
/** The speed of the scroll wheel */
const SCROLL_SPEED = 0.15;
/** The number of slices to skip when the shift key is held down */
const SHIFT_SKIP = 3;

interface ZScrollProps {
  selection: Signal<ZRange>;
  linked: boolean;
  isActive: boolean;
  length: number;
  height: number;
}

interface SharedEvent {
  deltaMin: number;
  deltaMax: number;
}

/**
 * The z control component.
 * Allows the user to select a range of z values & scroll through the z axis.
 * @param selection - The signal that holds the current z range.
 * @param linked - Whether the z control is linked to another z control.
 * @param isActive - Whether the z control is active.
 * @param length - The length of the z axis.
 * @param height - The height of the z control.
 * @returns The z control component.
 */
export function ZScroll({
  selection,
  length,
  linked,
  isActive,
  height,
}: ZScrollProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hover = useRef(false);
  const [minRange, setMinRange] = useState<string | undefined>(undefined);
  const [maxRange, setMaxRange] = useState<string | undefined>(undefined);
  const isHovering = hover.current;
  const range = selection.value;
  const roundSelection = useCallback(
    (selection: any, invert = true) => {
      if (selection[1] < selection[0] && invert) {
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
      start = Math.max(start, 0);

      return [start, end] as any;
    },
    [length],
  );

  useEffect(() => {
    if (!isActive) {
      if (!linked) return;
      const linkedHandler = ({
        detail: { deltaMin, deltaMax },
      }: CustomEvent<SharedEvent>) => {
        const state = selection.peek();
        const [min, max] = state;

        selection.value = roundSelection([min + deltaMin, max + deltaMax]);
      };

      window.addEventListener("z-scale", linkedHandler as any);
      return () => {
        window.removeEventListener("z-scale", linkedHandler as any);
      };
    }
    if (!svgRef.current) return;

    const setSelection = (z: [number, number]) => {
      const state = selection.peek();
      const deltaMin = z[0] - state[0];
      const deltaMax = z[1] - state[1];
      if (deltaMin !== 0 || deltaMax !== 0) {
        if (linked) {
          window.dispatchEvent(
            new CustomEvent("z-scale", {
              detail: {
                deltaMin,
                deltaMax,
              },
            }),
          );
        }

        selection.value = z;
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

    slides
      .attr("width", "70%")
      .attr("height", yBand.bandwidth())
      .attr("y", yBand as any);

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
      .call(brush.move as any, toSlide(roundSelection(selection.peek() as any)))
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
      { passive: false },
    );

    const handler = (event: KeyboardEvent) => {
      const { key, shiftKey } = event;

      // Check if the user is editing a text field
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as any).isContentEditable)
      ) {
        return;
      }

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
  }, [
    svgRef,
    length,
    selection,
    selection.value,
    linked,
    roundSelection,
    isActive,
    isHovering,
    height,
  ]);

  if (!isActive) return <></>;

  return (
    <div className="z-control flex flex-col gap-1 pt-1 pb-1 pointer-events-auto">
      <div className="text-center opacity-55">z</div>
      <input
        className="text-center text-xxs pointer-events-auto outline-none bg-transparent"
        onChange={(e) => {
          const value = parseInt(e.target.value) - 1;
          if (isNaN(value)) {
            setMinRange("");
            return;
          }
          setMinRange(undefined);
          const state = selection.peek();
          selection.value = roundSelection([value, state[1]], false);
        }}
        onKeyDown={(e) => {
          const scale = 1 * (e.shiftKey ? SHIFT_SKIP : 1);
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          else if (e.key === "ArrowDown") {
            const state = selection.peek();
            selection.value = roundSelection(
              [state[0] - scale, state[1]],
              false,
            );
          } else if (e.key === "ArrowUp") {
            const state = selection.peek();
            selection.value = roundSelection(
              [state[0] + scale, state[1]],
              false,
            );
          }
        }}
        value={minRange ?? range[0] + 1}
      />
      <svg ref={svgRef} className="z-slides">
        <g className="slides" />
        <g
          className="brush"
          onMouseOver={() => {
            hover.current = true;
          }}
          onMouseOut={() => {
            hover.current = false;
          }}
        />
      </svg>
      <input
        className="text-center text-xxs pointer-events-auto outline-none bg-transparent"
        onChange={(e) => {
          const value = parseInt(e.target.value);
          if (isNaN(value)) {
            if (e.target.value === "") setMaxRange("");
            return;
          }

          setMaxRange(undefined);
          const state = selection.peek();
          selection.value = roundSelection([state[0], value], false);
        }}
        onKeyDown={(e) => {
          const scale = 1 * (e.shiftKey ? SHIFT_SKIP : 1);
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          else if (e.key === "ArrowDown") {
            const state = selection.peek();
            selection.value = roundSelection(
              [state[0], state[1] - scale],
              false,
            );
          } else if (e.key === "ArrowUp") {
            const state = selection.peek();
            selection.value = roundSelection(
              [state[0], state[1] + scale],
              false,
            );
          }
        }}
        value={maxRange ?? range[1]}
      />
    </div>
  );
}
