import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { encounterConfigOf } from "../game/config/encounter";
import { phaseDossier } from "../game/config/phaseDossier";
import { CONDITION_LABELS } from "../game/simulation/conditions";
import { PhaseDossier } from "./PhaseDossier";
import { subPhaseWords } from "./phaseLadderModel";

const queen = encounterConfigOf("killer-bee-queen");

/** Every top-level phase of the Queen, so each dossier branch is met by real data. */
const phaseCount = queen.archetypes[queen.primaryArchetypeId].phases.length;

test("titles the section with the phase label", () => {
  render(<PhaseDossier config={queen} phaseIndex={0} label="Phase 1 - Honey Pond" />);
  const section = screen.getByRole("region", { name: "Phase details" });
  expect(within(section).getByRole("heading", { name: "Phase 1 - Honey Pond" })).toBeInTheDocument();
});

test.each(Array.from({ length: phaseCount }, (_, index) => index))(
  "phase %i states what the config says it throws",
  (phaseIndex) => {
    const dossier = phaseDossier(queen, phaseIndex);
    render(<PhaseDossier config={queen} phaseIndex={phaseIndex} label={`Phase ${phaseIndex + 1}`} />);
    const section = screen.getByRole("region", { name: "Phase details" });
    if (dossier.damageRange) {
      const { min, max } = dossier.damageRange;
      expect(section).toHaveTextContent(max === min ? `Damage ${min} HP` : `Damage ${min} to ${max} HP`);
    } else {
      expect(section).not.toHaveTextContent("Damage");
    }
    expect(Boolean(within(section).queryByText("Armor piercing"))).toBe(dossier.armorPiercing);
    for (const condition of dossier.conditions)
      expect(section).toHaveTextContent(`${CONDITION_LABELS[condition.key]} for ${condition.seconds} s`);
    for (const id of dossier.subPhaseIds)
      expect(section).toHaveTextContent(subPhaseWords(id));
    for (const minion of dossier.minions)
      expect(section).toHaveTextContent(`${minion.count} x ${subPhaseWords(minion.archetypeId)}`);
    expect(section.querySelectorAll("svg")).toHaveLength(dossier.projectiles.length);
  },
);
