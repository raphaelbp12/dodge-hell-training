import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import {
  DEBUG_GROUPS,
  DEBUG_PARAMETERS,
  DEBUG_TOGGLES,
  DEFAULT_DEBUG_SETTINGS,
  loadSelectedDebugValues,
  updateDebugParameter,
} from "../game/config/debug";
import type { EncounterHandle } from "../game/phaser/encounter";
import { DebugPanel } from "./DebugPanel";

function renderPanel(handle: Partial<EncounterHandle> | null = null) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const encounterHandle = { current: handle as EncounterHandle | null };
  render(
    <DebugPanel
      settings={DEFAULT_DEBUG_SETTINGS}
      onChange={onChange}
      onClose={onClose}
      encounterHandle={encounterHandle}
    />,
  );
  return { onChange, onClose, encounterHandle };
}

test("is a labelled panel with a group per debug group and a slider per parameter", () => {
  renderPanel();
  expect(screen.getByRole("complementary", { name: "Enemy debug tools" })).toBeInTheDocument();
  for (const group of DEBUG_GROUPS)
    expect(screen.getByRole("group", { name: group })).toBeInTheDocument();
  for (const parameter of DEBUG_PARAMETERS)
    expect(screen.getByRole("slider", { name: parameter.label })).toHaveValue(
      String(DEFAULT_DEBUG_SETTINGS[parameter.key]),
    );
});

test("each toggle reflects its setting and reports the change", async () => {
  const user = userEvent.setup();
  const { onChange } = renderPanel();
  const toggle = DEBUG_TOGGLES[0];
  const checkbox = screen.getByRole("checkbox", { name: toggle.label });
  expect(checkbox).toHaveProperty("checked", DEFAULT_DEBUG_SETTINGS[toggle.key]);
  await user.click(checkbox);
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_DEBUG_SETTINGS,
    [toggle.key]: !DEFAULT_DEBUG_SETTINGS[toggle.key],
  });
});

test("moving a slider reports the clamped update from the model", () => {
  const { onChange } = renderPanel();
  const parameter = DEBUG_PARAMETERS[0];
  const target = (parameter.min + parameter.max) / 2;
  fireEvent.change(screen.getByRole("slider", { name: parameter.label }), {
    target: { value: String(target) },
  });
  expect(onChange).toHaveBeenCalledWith(
    updateDebugParameter(DEFAULT_DEBUG_SETTINGS, parameter.key, target),
  );
});

test("Load selected values and Reset defaults report their settings", async () => {
  const user = userEvent.setup();
  const { onChange } = renderPanel();
  await user.click(screen.getByRole("button", { name: "Load selected values" }));
  expect(onChange).toHaveBeenLastCalledWith(loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS));
  await user.click(screen.getByRole("button", { name: "Reset defaults" }));
  expect(onChange).toHaveBeenLastCalledWith(DEFAULT_DEBUG_SETTINGS);
});

test("Close debug calls onClose", async () => {
  const user = userEvent.setup();
  const { onClose } = renderPanel();
  await user.click(screen.getByRole("button", { name: "Close debug" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("Next sub-phase calls the live handle, and does nothing without one", async () => {
  const user = userEvent.setup();
  const advanceSubPhase = vi.fn();
  renderPanel({ advanceSubPhase });
  await user.click(screen.getByRole("button", { name: "Next sub-phase" }));
  expect(advanceSubPhase).toHaveBeenCalledTimes(1);
});

test("Next sub-phase is safe before an encounter exists", async () => {
  const user = userEvent.setup();
  renderPanel(null);
  await user.click(screen.getByRole("button", { name: "Next sub-phase" }));
  expect(screen.getByRole("complementary", { name: "Enemy debug tools" })).toBeInTheDocument();
});
