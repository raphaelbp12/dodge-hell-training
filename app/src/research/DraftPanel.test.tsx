import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { archetypeOf, encounterConfigOf } from "../game/config/encounter";
import { DraftPanel } from "./DraftPanel";
import { blocksOfMonster, loadMonsterDraft } from "./monsterDraft";
import { phaseOptions } from "./taggingOptions";

const queen = encounterConfigOf("killer-bee-queen");
const id = "killer-bee-queen";
const raw = AUTHORED_MONSTER_FILES[id] as { phases: { id: string; subPhases?: unknown[] | null }[] };
const phases = phaseOptions(queen, id);

function mount(phaseIndex: number, onPhaseChange = vi.fn()) {
  const draft = loadMonsterDraft(raw, null, raw.phases[phaseIndex].id).draft;
  render(
    <DraftPanel
      archetypeId={id}
      config={queen}
      draft={draft}
      blocks={blocksOfMonster(archetypeOf(queen, id))}
      hasVideo
      phases={phases}
      phaseIndex={phaseIndex}
      onPhaseChange={onPhaseChange}
      onStartsHere={() => undefined}
      onChange={() => undefined}
    />,
  );
  return { draft, onPhaseChange };
}

test("only the selected phase's blocks and attack lists are shown (J01)", () => {
  mount(2);
  const shown = raw.phases[2].id;
  expect(screen.getByRole("heading", { name: shown })).toBeInTheDocument();
  for (const phase of raw.phases.filter((entry) => entry.id !== shown))
    expect(screen.queryByRole("heading", { name: phase.id })).toBeNull();
});

test("the draft panel's Phase select reports a change", async () => {
  const { onPhaseChange } = mount(2);
  await userEvent.selectOptions(screen.getByLabelText("Phase of the monster draft"), "3");
  expect(onPhaseChange).toHaveBeenCalledWith(3);
});

test("every draft-panel control has a help mark (J11)", async () => {
  mount(2);
  const panel = screen.getByRole("region", { name: /Monster draft/ });
  const marks = within(panel).getAllByRole("img", { name: "Help" });
  const titled = (text: RegExp) => marks.some((mark) => text.test(mark.getAttribute("title") ?? ""));
  expect(titled(/entered, before its telegraph|before its telegraph/)).toBe(true);
  await userEvent.click(within(panel).getAllByRole("button", { pressed: false })[0]);
  const editor = within(panel).getByRole("group", { name: /Editing/ });
  const controls = within(editor).getAllByRole("spinbutton").length
    + within(editor).getAllByRole("combobox").length + within(editor).getAllByRole("checkbox").length;
  expect(within(editor).getAllByRole("img", { name: "Help" }).length).toBeGreaterThanOrEqual(controls);
  for (const label of ["Load from game", "Copy file"])
    expect(within(panel).getByRole("button", { name: label })).toBeInTheDocument();
});
