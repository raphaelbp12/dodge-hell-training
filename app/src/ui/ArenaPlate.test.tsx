import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ENCOUNTER_CONFIGS } from "../game/config/encounter";
import { palette } from "../game/config/palette";
import { ArenaPlate } from "./ArenaPlate";

// The plate is decorative (aria-hidden), so these tests read its SVG directly.

const arenas = Object.values(ENCOUNTER_CONFIGS).map((config) => config.arena);
const circular = arenas.find((arena) => arena.shape.kind === "circle");
const octagonal = arenas.find((arena) => arena.shape.kind === "octagon" && arena.hazards.length > 0);

test("a circular arena is drawn as a circle with the ground colour", () => {
  const { container } = render(<ArenaPlate arena={circular!} />);
  const floor = container.querySelector("g > circle")!;
  expect(floor).toHaveAttribute("fill", palette.arena.ground);
  expect(floor).toHaveAttribute("stroke", palette.arena.boundary);
  expect(container.querySelector("path")).toBeNull();
});

test("an octagonal arena is drawn as a path", () => {
  const { container } = render(<ArenaPlate arena={octagonal!} />);
  expect(container.querySelector("path")).toHaveAttribute("fill", palette.arena.ground);
});

test("honey hazards are drawn over the floor in the honey colours", () => {
  const { container } = render(<ArenaPlate arena={octagonal!} />);
  expect(container.querySelector("polygon")).toHaveAttribute("fill", palette.arena.honey);
  expect(container.querySelectorAll(`circle[stroke="${palette.arena.honeyRim}"]`).length).toBeGreaterThan(0);
});

test("an arena without hazards draws no honey", () => {
  const { container } = render(<ArenaPlate arena={circular!} />);
  expect(container.querySelector("polygon")).toBeNull();
});

test("the view box is centred on the arena and hidden from assistive technology", () => {
  const { container } = render(<ArenaPlate arena={circular!} />);
  const svg = container.querySelector("svg")!;
  expect(svg).toHaveAttribute("aria-hidden", "true");
  const [x, y, width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number);
  expect(x).toBeCloseTo(-(width / 2));
  expect(y).toBeCloseTo(-(height / 2));
});
