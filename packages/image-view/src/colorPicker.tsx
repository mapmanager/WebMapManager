import { useSignal } from "@preact/signals-react";
import React, { useCallback } from "react";
import { ColorResult, GithubPicker } from "react-color";
import { Color } from ".";

export const COLORS_SELECTOR_OPTIONS = [
  "#ff00ff",
  "#00ffff",
  "#ffff00",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
];

/**
 * Color picker component
 */
export const ColorPicker = ({
  color: [r, g, b],
  setColor,
}: {
  color: Color;
  setColor: (color: Color) => void;
}) => {
  const active = useSignal(false);
  const open = useCallback(() => {
    active.value = true;
  }, [active]);
  const close = useCallback(() => {
    active.value = false;
  }, [active]);

  const onColorChange = useCallback(
    ({ rgb: { r, g, b } }: ColorResult) => {
      setColor([r, g, b]);
      close();
    },
    [close, setColor],
  );
  return (
    <div className="color-picker-container">
      <div
        className="color-picker"
        style={{ backgroundColor: `rgb(${r},${g},${b})` }}
        onClick={open}
      />
      {active.value
        ? (
          <div className="color-picker-popover">
            <div className="color-picker-cover" onClick={close} />
            <GithubPicker
              color={{ r, g, b }}
              colors={COLORS_SELECTOR_OPTIONS}
              triangle="hide"
              onChange={onColorChange}
            />
          </div>
        )
        : null}
    </div>
  );
};
