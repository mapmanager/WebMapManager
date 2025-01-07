import React, { useEffect, useMemo, useState } from "react";
import { Signal } from "@preact/signals-react";
import { PyPixelSource } from "../../../loaders/py_loader";
import { DATA_VERSION } from "../globals";
import ArrowLeftLineIcon from "@rsuite/icons/ArrowLeftLine";
import ArrowRightLineIcon from "@rsuite/icons/ArrowRightLine";
import ArrowUpLine from "@rsuite/icons/ArrowUpLine";
import ArrowDownLine from "@rsuite/icons/ArrowDownLine";
import { Popover, Whisper } from "rsuite";
import GridIcon from "@rsuite/icons/Grid";

const SHIFT_SKIP = 3;

interface Props {
  time: Signal<number>;
  loader: PyPixelSource;
  isActive: boolean;
  gridCount: Signal<number>;
  times: number[];
}

export function TScroll({
  time: timeSignal,
  loader,
  isActive,
  gridCount,
  times,
}: Props) {
  const [range, setRange] = useState<string | undefined>(undefined);
  const time = timeSignal.value;
  const version = DATA_VERSION.value;
  const [timePoints, offsetTime] = useMemo(() => {
    void version;
    const timePoints = loader.timePoints().map((t) => ({
      time: t,
      name: loader.metadata(t).name,
    }));
    if (
      timePoints.length !== 0 &&
      timePoints.findIndex((t) => t.time === time) === -1
    ) {
      timeSignal.value = timePoints[0].time;
    }

    const offsetTime = (offset: number) => {
      const index = timePoints.findIndex((t) => t.time === time);
      if (index === -1) {
        if (timePoints.length === 0) return;
        timeSignal.value = timePoints[0].time;
        return;
      }

      const newIndex = Math.max(
        0,
        Math.min(timePoints.length - 1, index + offset)
      );

      timeSignal.value = timePoints[newIndex].time;
    };

    return [timePoints, offsetTime];
  }, [loader, version, time, timeSignal]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
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

      const { key, shiftKey } = event;
      const offset = shiftKey ? SHIFT_SKIP : 1;

      if (key === "ArrowRight") {
        offsetTime(offset);
      } else if (key === "ArrowLeft") {
        offsetTime(-offset);
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", handler, { passive: false });
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [offsetTime, isActive]);

  if (!isActive || timePoints.length <= 1) return <></>;

  const maxTime = timePoints.length;

  return (
    <div className="t-control">
      <div className="text-center opacity-55 text-sm pl-2 pr-2" title="Time Points">t</div>
      <ArrowLeftLineIcon
        className="cursor-pointer flex-shrink-0"
        onClick={() => offsetTime(-1)}
      />
      <div className="slides">
        {timePoints.map((t) => (
          <Whisper
            key={t.time}
            placement="autoVertical"
            trigger="hover"
            speaker={
              <Popover title={t.name}>
                <p>Time point: {t.time + 1}</p>
              </Popover>
            }
            enterable
            delayClose={0}
            delay={0}
            delayOpen={0}
          >
            <div
              className={
                "slide" +
                (t.time === time
                  ? " selected"
                  : " cursor-pointer" +
                    (-1 === times.indexOf(t.time) ? "" : " in-range"))
              }
              onClick={() => {
                timeSignal.value = t.time;
              }}
              key={t.time}
              title={t.name}
            >
              {t.time === time ? t.name : ""}
            </div>
          </Whisper>
        ))}
      </div>
      <ArrowRightLineIcon
        className="cursor-pointer flex-shrink-0"
        onClick={() => offsetTime(1)}
      />
      <div className="flex-shrink-0 bg-[rgba(255,255,255,0.1)] ml-[6px] p-1 pl-3 flex">
        <GridIcon color="white" className="" width={12} />
        <input
          className="text-center text-xxs pointer-events-auto outline-none bg-transparent w-[44px]"
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (isNaN(value)) {
              if (e.target.value === "") setRange("");
              return;
            }

            setRange(undefined);
            gridCount.value = Math.min(maxTime, Math.max(1, value));
          }}
          onKeyDown={(e) => {
            const scale = 1 * (e.shiftKey ? SHIFT_SKIP : 1);
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            else if (e.key === "ArrowDown") {
              gridCount.value = Math.max(1, gridCount.peek() - scale);
            } else if (e.key === "ArrowUp") {
              gridCount.value = Math.min(gridCount.peek() + scale, maxTime);
            } else {
              return;
            }
            setRange(undefined);
            e.preventDefault();
          }}
          value={range ?? gridCount.value}
        />
        <ArrowDownLine
          className="cursor-pointer flex-shrink-0"
          color={gridCount.peek() === 1 ? " gray" : undefined}
          onClick={() => {
            gridCount.value = Math.max(gridCount.peek() - 1, 1);
            setRange(undefined);
          }}
        />
        <ArrowUpLine
          className="cursor-pointer flex-shrink-0"
          color={gridCount.peek() === maxTime ? " gray" : undefined}
          onClick={() => {
            gridCount.value = Math.min(gridCount.peek() + 1, maxTime);
            setRange(undefined);
          }}
        />
      </div>
    </div>
  );
}
