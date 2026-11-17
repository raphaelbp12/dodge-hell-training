import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { HELP_CALIBRATE_SCALE } from "./helpText";
import { ScalePanel } from "./ScalePanel";

function renderPanel(props: Partial<Parameters<typeof ScalePanel>[0]> = {}) {
  const onCalibrate = vi.fn();
  const onClear = vi.fn();
  render(
    <ScalePanel
      tileWidthFraction={null}
      armed={false}
      hasVideo
      onCalibrate={onCalibrate}
      onClear={onClear}
      {...props}
    />,
  );
  return { onCalibrate, onClear };
}

test("without a scale it says so, and Clear is disabled", () => {
  renderPanel();
  expect(screen.getByRole("status")).toHaveTextContent("No scale yet.");
  expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
});

test("a measured scale is shown as a percentage of the video width", () => {
  renderPanel({ tileWidthFraction: 0.04567 });
  expect(screen.getByRole("status")).toHaveTextContent("1 tile = 4.57 % of the video width, measured.");
  expect(screen.getByRole("button", { name: "Clear" })).toBeEnabled();
});

test("Calibrate arms the drag and Clear drops the scale", async () => {
  const user = userEvent.setup();
  const { onCalibrate, onClear } = renderPanel({ tileWidthFraction: 0.05 });
  await user.click(screen.getByRole("button", { name: "Calibrate scale" }));
  expect(onCalibrate).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

test("while armed it asks for a drag and cannot be armed again", () => {
  renderPanel({ armed: true });
  expect(screen.getByRole("status")).toHaveTextContent("Drag across the monster's body on the video.");
  expect(screen.getByRole("button", { name: "Calibrate scale" })).toBeDisabled();
});

test("without a video it cannot calibrate", () => {
  renderPanel({ hasVideo: false });
  expect(screen.getByRole("button", { name: "Calibrate scale" })).toBeDisabled();
});

test("the help mark carries the calibration help text", () => {
  renderPanel();
  expect(screen.getByRole("img", { name: "Help" })).toHaveAttribute("title", HELP_CALIBRATE_SCALE);
});
