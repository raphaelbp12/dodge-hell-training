import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { encounterView } from "../test/encounter-view";
import { PhaseLadder, type LadderPhase } from "./PhaseLadder";

const phases: readonly LadderPhase[] = [
  { index: 0, id: "phase-1-honey-pond", label: "Phase 1 - Honey Pond", telegraphColor: "amber" },
  { index: 1, id: "phase-2-color-chase", label: "Phase 2 - Color Chase", telegraphColor: "red" },
  { index: 2, id: "phase-3-pond-barrage", label: "Phase 3 - Pond Barrage", telegraphColor: "cyan" },
];

function rows() {
  return within(screen.getByRole("list", { name: "Fight progress" })).getAllByRole("listitem");
}

test("lists every phase with its number and name and marks the current one", () => {
  render(<PhaseLadder phases={phases} view={encounterView({ phaseIndex: 1, phaseCount: 3, phaseLabel: phases[1].label })} />);
  expect(rows()).toHaveLength(3);
  expect(rows()[0]).toHaveTextContent("1 Honey Pond");
  expect(rows()[1]).toHaveAttribute("aria-current", "step");
  expect(rows()[0]).not.toHaveAttribute("aria-current");
  expect(rows().map((row) => row.getAttribute("data-state"))).toEqual(["done", "current", "upcoming"]);
});

test("shows where the current phase ends and its timed length", () => {
  render(
    <PhaseLadder
      phases={phases}
      view={encounterView({ phaseIndex: 0, phaseCount: 3, phaseEndsAtFraction: 0.45, phaseTimedSeconds: 29 })}
    />,
  );
  expect(screen.getByText("Ends at 45%")).toBeInTheDocument();
  expect(screen.getByText("Timed, 29 s")).toBeInTheDocument();
});

test("omits end and timed details a phase does not have", () => {
  render(<PhaseLadder phases={phases} view={encounterView({ phaseIndex: 0, phaseCount: 3 })} />);
  expect(screen.queryByText(/Ends at/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Timed,/)).not.toBeInTheDocument();
});

test("names the current sub-phase", () => {
  render(
    <PhaseLadder phases={phases} view={encounterView({ phaseIndex: 1, phaseCount: 3, subPhaseId: "yellow" })} />,
  );
  expect(screen.getByText("Yellow")).toBeInTheDocument();
});

test("a looping drill marks excluded phases and says Looping", () => {
  render(
    <PhaseLadder
      phases={phases}
      view={encounterView({ phaseIndex: 1, phaseCount: 3, drill: { phaseIndices: [1], loop: true } })}
    />,
  );
  expect(rows().map((row) => row.getAttribute("data-state"))).toEqual(["excluded", "current", "excluded"]);
  expect(screen.getByText("Looping")).toBeInTheDocument();
});

test("a drill that does not loop shows no Looping note", () => {
  render(
    <PhaseLadder
      phases={phases}
      view={encounterView({ phaseIndex: 1, phaseCount: 3, drill: { phaseIndices: [1, 2], loop: false } })}
    />,
  );
  expect(screen.queryByText("Looping")).not.toBeInTheDocument();
});
