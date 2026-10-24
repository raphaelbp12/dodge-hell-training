import { expect, test, type Page } from "@playwright/test";
import type { SessionSnapshot, Vector2 } from "../src/game/models.ts";

type Inspection = SessionSnapshot & {
  volleysFired: number;
  paused: boolean;
  zoom: number;
  camera: Vector2;
  viewport: { width: number; height: number };
  keydownListeners: number;
};

async function inspect(page: Page): Promise<Inspection> {
  return page.evaluate(async () => {
    const modulePath = "/src/game/phaser/encounter.ts";
    const adapter = await import(/* @vite-ignore */ modulePath);
    return adapter.inspectEncounter(
      document.querySelector('[aria-label="Encounter"]'),
    );
  });
}

async function launch(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Launch encounter" }).click();
  await expect
    .poll(async () => (await inspect(page))?.elapsedSeconds ?? 0)
    .toBeGreaterThan(0);
}

test("launches one Phaser canvas and cleans it up across repeated mounts", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Crystal Worm Child", level: 1 }),
  ).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Launch encounter" }).click();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByLabel("Survival time")).not.toHaveText("0.0 s");
    expect((await inspect(page)).keydownListeners).toBe(1);
    await page.getByRole("button", { name: "Close encounter" }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  expect(pageErrors).toEqual([]);
});

test("WASD uses world speed and camera stays centered at the arena edge through zoom", async ({
  page,
}) => {
  await launch(page);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(0.5);
  const before = await inspect(page);
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(before.player.positionTiles.x + 2);
  const moved = await inspect(page);
  await page.keyboard.up("d");
  expect(
    (moved.player.positionTiles.x - before.player.positionTiles.x) /
      (moved.elapsedSeconds - before.elapsedSeconds),
  ).toBeCloseTo(7.0613333333, 6);
  expect(moved.camera.x).toBeCloseTo(moved.player.positionTiles.x, 6);
  expect(moved.camera.y).toBeCloseTo(moved.player.positionTiles.y, 6);
  expect(moved.keydownListeners).toBe(1);

  await page.keyboard.down("p");
  await expect.poll(async () => (await inspect(page)).zoom).toBe(1.125);
  await page.keyboard.down("p");
  await page.keyboard.up("p");
  expect((await inspect(page)).zoom).toBe(1.125);
  for (let press = 0; press < 5; press++) await page.keyboard.press("p");
  await expect.poll(async () => (await inspect(page)).zoom).toBe(1.5);
  for (let press = 0; press < 10; press++) await page.keyboard.press("o");
  await expect.poll(async () => (await inspect(page)).zoom).toBe(0.75);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeCloseTo(15.75, 5);
  await page.keyboard.up("d");
  const edge = await inspect(page);
  expect(edge.camera.x).toBeCloseTo(edge.player.positionTiles.x, 6);
  await page.keyboard.down("w");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.y)
    .toBeLessThan(-0.5);
  await page.keyboard.up("w");
  await page.keyboard.down("a");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeLessThan(15);
  await page.keyboard.up("a");
  await page.keyboard.down("s");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.y)
    .toBeGreaterThan(0);
  await page.keyboard.up("s");
});

test("focus loss freezes simulation until explicit resume and clears held input", async ({
  page,
}) => {
  await launch(page);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(0.5);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const paused = await inspect(page);
  await page.keyboard.up("d");
  await page.keyboard.press("p");
  await page.waitForTimeout(300);
  expect(await inspect(page)).toEqual(paused);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page)).elapsedSeconds)
    .toBeGreaterThan(paused.elapsedSeconds);
  const resumed = await inspect(page);
  expect(resumed.player.positionTiles).toEqual(paused.player.positionTiles);
  expect(resumed.zoom).toBe(paused.zoom);
  expect(resumed.elapsedSeconds - paused.elapsedSeconds).toBeLessThan(0.2);
  await page.getByRole("button", { name: "Close encounter" }).focus();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const unfocused = await inspect(page);
  await page.keyboard.press("d");
  expect((await inspect(page)).player.positionTiles).toEqual(
    unfocused.player.positionTiles,
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const hidden = await inspect(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect((await inspect(page)).elapsedSeconds).toBe(hidden.elapsedSeconds);
  expect((await inspect(page)).paused).toBe(true);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page)).elapsedSeconds)
    .toBeGreaterThan(hidden.elapsedSeconds);
});

test("real Phaser ticks pursue, fire, reverse, register hits and reduce health", async ({
  page,
}) => {
  await launch(page);
  const initial = await inspect(page);
  await expect
    .poll(async () => (await inspect(page)).volleysFired, { timeout: 6000 })
    .toBeGreaterThanOrEqual(4);
  const burst = await inspect(page);
  expect(burst.enemy.positionTiles.y).toBeGreaterThan(
    initial.enemy.positionTiles.y,
  );
  expect(burst.shards.length).toBeGreaterThanOrEqual(16);
  await expect
    .poll(
      async () =>
        (await inspect(page)).shards.some((shard) => shard.hasReversed),
      { timeout: 4000 },
    )
    .toBe(true);
  await expect
    .poll(async () => (await inspect(page)).hitsTaken, { timeout: 4000 })
    .toBeGreaterThan(0);
  const hit = await inspect(page);
  expect(hit.player.healthHp).toBeLessThan(775);
  expect(hit.shards.some((shard) => shard.hasHitPlayer)).toBe(true);
  expect(
    hit.shards.every((shard) => shard.ageSeconds < shard.lifetimeSeconds),
  ).toBe(true);
});

test("captures only unmodified gameplay keys while focused and removes capture on close", async ({
  page,
}) => {
  await launch(page);
  const dispatch = () =>
    page.evaluate(() => {
      function key(code: string, keyCode: number, ctrlKey = false) {
        const event = new KeyboardEvent("keydown", {
          code,
          keyCode,
          ctrlKey,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(event);
        window.dispatchEvent(
          new KeyboardEvent("keyup", { code, keyCode, bubbles: true }),
        );
        return event.defaultPrevented;
      }
      return {
        movement: key("KeyW", 87),
        unrelated: key("ArrowDown", 40),
        browserShortcut: key("KeyW", 87, true),
      };
    });
  expect(await dispatch()).toEqual({
    movement: true,
    unrelated: false,
    browserShortcut: false,
  });
  await page.getByRole("button", { name: "Close encounter" }).focus();
  expect((await dispatch()).movement).toBe(false);
  await page.getByRole("button", { name: "Close encounter" }).click();
  expect((await dispatch()).movement).toBe(false);
});

test("resize preserves zoom, movement speed, camera center and the simulation attack clock", async ({
  page,
}) => {
  await launch(page);
  await page.keyboard.press("p");
  await expect.poll(async () => (await inspect(page)).zoom).toBe(1.125);
  const beforeResize = await inspect(page);
  await page.setViewportSize({ width: 800, height: 650 });
  await expect.poll(async () => (await inspect(page)).viewport.width).toBe(800);
  const resized = await inspect(page);
  expect(resized.zoom).toBe(1.125);
  expect(resized.elapsedSeconds).toBeGreaterThanOrEqual(
    beforeResize.elapsedSeconds,
  );
  expect(resized.camera.x).toBeCloseTo(resized.player.positionTiles.x, 6);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(0.5);
  const moving = await inspect(page);
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(moving.player.positionTiles.x + 1);
  const after = await inspect(page);
  await page.keyboard.up("d");
  expect(
    (after.player.positionTiles.x - moving.player.positionTiles.x) /
      (after.elapsedSeconds - moving.elapsedSeconds),
  ).toBeCloseTo(7.0613333333, 6);
  await expect
    .poll(async () => (await inspect(page)).volleysFired)
    .toBeGreaterThan(0);
  const firing = await inspect(page);
  const first = firing.shards.find((shard) => shard.id === 1)!;
  expect(firing.elapsedSeconds - first.ageSeconds).toBeCloseTo(2, 10);
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`renders readable nonblank arena at ${viewport.width}px without layout overlap`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await launch(page);
    await page.keyboard.press("o");
    await page.keyboard.press("o");
    await expect
      .poll(async () => (await inspect(page)).shards.length, { timeout: 6000 })
      .toBeGreaterThan(0);
    const state = await inspect(page);
    expect(state.viewport.width).toBe(viewport.width);
    const pixels = await page.locator("canvas").evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Expected encounter canvas");
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext("2d")!;
      context.drawImage(canvas, 0, 0);
      const data = context.getImageData(0, 0, copy.width, copy.height).data;
      const counts = { player: 0, enemy: 0, shards: 0, ground: 0 };
      for (let offset = 0; offset < data.length; offset += 4) {
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        if (red > 225 && green > 235 && blue > 225) counts.player++;
        if (red > 200 && green > 70 && green < 160 && blue < 150)
          counts.enemy++;
        if (red > 230 && green > 180 && blue < 150) counts.shards++;
        if (red === 28 && green === 48 && blue === 42) counts.ground++;
      }
      return counts;
    });
    expect(pixels.player).toBeGreaterThan(10);
    expect(pixels.shards).toBeGreaterThan(5);
    expect(pixels.ground).toBeGreaterThan(1000);
    if (viewport.width > 600) expect(pixels.enemy).toBeGreaterThan(10);
    const boxes = await page.evaluate(() => {
      const header = document.querySelector("header")!.getBoundingClientRect();
      const arena = document
        .querySelector('[aria-label="Encounter"]')!
        .getBoundingClientRect();
      return {
        headerBottom: header.bottom,
        arenaTop: arena.top,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(boxes.headerBottom).toBeLessThanOrEqual(boxes.arenaTop);
    expect(boxes.overflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`encounter-${viewport.width}.png`),
      fullPage: true,
    });
    await testInfo.attach("encounter", {
      path: testInfo.outputPath(`encounter-${viewport.width}.png`),
      contentType: "image/png",
    });
  });
}
