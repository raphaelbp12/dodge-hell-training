import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ENCOUNTER_CONFIGS, type ProjectileSpec } from "../game/config/encounter";
import { palette } from "../game/config/palette";
import { ProjectileSprite } from "./ProjectileSprite";

// The sprite is decorative (aria-hidden), so these tests read its SVG directly.

const catalog: readonly ProjectileSpec[] = Object.values(ENCOUNTER_CONFIGS).flatMap((config) =>
  Object.values(config.projectiles),
);
const pixelArt = catalog.find((projectile) => projectile.appearance && projectile.appearance.nativeWidthPixels > 0 && !projectile.appearance.bomb);
const bomb = catalog.find((projectile) => projectile.appearance?.bomb);
const polygonOnly = catalog.find((projectile) => !projectile.appearance);

test("the shipped catalog covers all three drawings", () => {
  expect(pixelArt).toBeDefined();
  expect(bomb).toBeDefined();
  expect(polygonOnly).toBeDefined();
});

test("a pixel-art projectile draws one rectangle per opaque run in the native frame", () => {
  const appearance = pixelArt!.appearance!;
  const { container } = render(<ProjectileSprite projectile={pixelArt!} />);
  const svg = container.querySelector("svg")!;
  expect(svg).toHaveAttribute("viewBox", `0 0 ${appearance.nativeWidthPixels} ${appearance.nativeHeightPixels}`);
  expect(svg).toHaveAttribute("aria-hidden", "true");
  expect(svg.querySelectorAll("rect").length).toBeGreaterThan(0);
});

test("a bomb draws its body colour with the bomb keyline", () => {
  const { container } = render(<ProjectileSprite projectile={bomb!} />);
  const circle = container.querySelector("circle")!;
  expect(circle).toHaveAttribute("fill", bomb!.appearance!.bomb!.bodyColor);
  expect(circle).toHaveAttribute("stroke", palette.arena.bombKeyline);
});

test("a projectile with no art draws its polygon body in the shard colour", () => {
  const { container } = render(<ProjectileSprite projectile={polygonOnly!} />);
  const polygon = container.querySelector("polygon")!;
  expect(polygon).toHaveAttribute("fill", palette.entity.shard);
  expect(polygon.getAttribute("points")!.split(" ")).toHaveLength(polygonOnly!.verticesTiles.length);
});

test("the size defaults to 36 pixels and can be set", () => {
  const { container, rerender } = render(<ProjectileSprite projectile={polygonOnly!} />);
  expect(container.querySelector("svg")).toHaveAttribute("width", "36");
  rerender(<ProjectileSprite projectile={polygonOnly!} sizePixels={20} />);
  expect(container.querySelector("svg")).toHaveAttribute("height", "20");
});
