import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type {
  EnemyState,
  PlayerState,
  SessionPhase,
  ShardState,
  Vector2,
} from "../src/game/models.ts";

const controlledFrameMilliseconds = 250;

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  const throttle = process.env.PLAYWRIGHT_CPU_THROTTLE_RATE;
  if (!throttle) return;
  const rate = Number(throttle);
  if (!Number.isFinite(rate) || rate < 1)
    throw new Error("PLAYWRIGHT_CPU_THROTTLE_RATE must be a number >= 1");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
});

// Shape of the diagnostic payload returned by inspectEncounter. Described from
// model primitives rather than importing SimulationState, because this spec is
// type-checked under tsconfig.node.json's nodenext resolution.
type Inspection = {
  rulesVersion: string;
  phase: "playing" | "ended";
  elapsedSeconds: number;
  hitsTaken: number;
  player: PlayerState;
  enemy: EnemyState;
  shards: ShardState[];
  volleysFired: number;
  ticksElapsed: number;
  accumulatorSeconds: number;
  debugSettings: Record<string, number | boolean>;
  sessionPhase: SessionPhase;
  countdownRemainingSeconds: number;
  attemptId: number;
  result: {
    attemptId: number;
    elapsedSeconds: number;
    hitsTaken: number;
  } | null;
  paused: boolean;
  zoom: number;
  camera: Vector2;
  viewport: { width: number; height: number };
  keydownListeners: number;
  hitNumbers: {
    shardId: number;
    damageHp: number;
    ageSeconds: number;
    text: string;
    widthCssPixels: number;
    heightCssPixels: number;
  }[];
  audio: {
    muted: boolean;
    requests: number;
    played: number;
    activeVoices: number;
  };
};

async function inspect(page: Page): Promise<Inspection> {
  return page.evaluate(async () => {
    const modulePath = new URL("src/game/phaser/encounter.ts", document.baseURI)
      .href;
    const adapter = await import(/* @vite-ignore */ modulePath);
    return adapter.inspectEncounter(
      document.querySelector('[aria-label="Encounter"]'),
    );
  });
}

async function finishCountdown(page: Page, resumeClock = true) {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const status = page.getByLabel("Session status");
  for (
    let step = 0;
    step < 40 &&
    (await page.getByLabel("Survival time").textContent()) === "0.0 s";
    step++
  )
    await page.clock.runFor(100);
  await page.clock.runFor(100);
  await expect(status).toHaveText("Active");
  await expect(page.getByLabel("Survival time")).not.toHaveText("0.0 s");
  if (resumeClock) await page.clock.resume();
}

async function launch(page: Page, resumeClock = true) {
  await page.goto("./");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await finishCountdown(page, resumeClock);
  await expect
    .poll(async () => (await inspect(page))?.elapsedSeconds ?? 0)
    .toBeGreaterThan(0);
}

async function savedAttempts(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("dodge-hell-training.attempts") ?? "null"),
  );
}

async function renderedPixels(page: Page) {
  return page.locator("canvas").evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error("Expected encounter canvas");
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d")!;
    context.drawImage(canvas, 0, 0);
    const data = context.getImageData(0, 0, copy.width, copy.height).data;
    const counts = {
      player: 0,
      enemy: 0,
      shards: 0,
      ground: 0,
      healthBar: 0,
      missingHealth: 0,
      hitText: 0,
    };
    let enemyX = 0;
    let enemyY = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      const red = data[offset]!;
      const green = data[offset + 1]!;
      const blue = data[offset + 2]!;
      if (red > 225 && green > 235 && blue > 225) counts.player++;
      if (red > 200 && green > 70 && green < 160 && blue < 150) {
        counts.enemy++;
        enemyX += (offset / 4) % copy.width;
        enemyY += Math.floor(offset / 4 / copy.width);
      }
      if (red > 230 && green > 180 && blue < 150) counts.shards++;
      if (red === 28 && green === 48 && blue === 42) counts.ground++;
      if (red === 85 && green === 214 && blue === 160) counts.healthBar++;
      if (red === 89 && green === 46 && blue === 57) counts.missingHealth++;
      if (red > 130 && green > 50 && green < 160 && blue > green && blue < red)
        counts.hitText++;
    }
    return {
      ...counts,
      survivalSeconds: Number.parseFloat(
        document.querySelector('[aria-label="Survival time"]')?.textContent ??
          "NaN",
      ),
      enemyX: counts.enemy ? enemyX / counts.enemy : null,
      enemyY: counts.enemy ? enemyY / counts.enemy : null,
    };
  });
}

async function retrySnapshot(
  page: Page,
  source: "key" | "button" = "key",
): Promise<Inspection> {
  return page.evaluate(async (source) => {
    const modulePath = new URL("src/game/phaser/encounter.ts", document.baseURI)
      .href;
    const adapter = await import(/* @vite-ignore */ modulePath);
    if (source === "button") {
      const retry = document.querySelector(
        '[aria-labelledby="result-title"] button',
      );
      if (!(retry instanceof HTMLButtonElement))
        throw new Error("Missing result Retry button");
      retry.click();
    } else
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "KeyR",
          keyCode: 82,
          bubbles: true,
          cancelable: true,
        }),
      );
    const snapshot = adapter.inspectEncounter(
      document.querySelector('[aria-label="Encounter"]'),
    );
    window.dispatchEvent(
      new KeyboardEvent("keyup", { code: "KeyR", keyCode: 82, bubbles: true }),
    );
    return snapshot;
  }, source);
}

test("selected values are the scored defaults without opening Debug", async ({
  page,
}) => {
  await launch(page);
  const state = await inspect(page);
  expect(state.rulesVersion).toBe("crystal-worm-child-head-paladin-v3");
  expect(state.debugSettings).toMatchObject({
    headWidth: 1.25,
    headHeight: 1.25,
    emitterCount: 6,
    emitterRadiusTiles: 0.35,
    initialPhaseDegrees: 0,
    rotationDegreesPerSecond: 45,
    shotsPerEmitter: 11,
    shotIntervalSeconds: 0.19,
    cooldownSeconds: 3,
    initialCooldownSeconds: 2,
    projectileDamageHp: 160,
    projectileSpeedTilesPerSecond: 8,
    reversalSeconds: 1.5,
    lifetimeSeconds: 3,
    projectileWidth: 1.45,
    projectileHeight: 0.65,
    godMode: false,
    chaseArenaCenter: false,
    matchPlayerToHead: true,
  });
  await page.getByRole("button", { name: "Debug", exact: true }).click();
  await page.getByRole("button", { name: "Load selected values" }).click();
  expect((await inspect(page)).rulesVersion).toBe(
    "crystal-worm-child-head-paladin-v3",
  );
  await expect(page.getByText("Debug attempt / not saved")).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`live enemy debug sliders, god mode and safe Retry work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("./");
    await page.getByRole("button", { name: "Debug", exact: true }).click();
    await page.getByRole("checkbox", { name: "God mode", exact: true }).check();
    await page.getByRole("checkbox", { name: "Chase arena center" }).check();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await finishCountdown(page);
    await expect
      .poll(async () => (await inspect(page))?.elapsedSeconds ?? 0)
      .toBeGreaterThan(0);
    const setRange = async (label: string, value: number) => {
      await page
        .getByRole("slider", { name: label, exact: true })
        .evaluate((element, value) => {
          const input = element as HTMLInputElement;
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!.call(input, String(value));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }, value);
    };
    const sliders = page.getByRole("slider");
    // Tracks DEBUG_PARAMETERS: 19 tuning sliders plus the two player-size
    // sliders added when the player body became independently authored (G08).
    await expect(sliders).toHaveCount(21);
    await page.getByRole("button", { name: "Load selected values" }).click();
    await expect
      .poll(async () => (await inspect(page)).debugSettings)
      .toMatchObject({
        headWidth: 1.25,
        headHeight: 1.25,
        emitterCount: 6,
        emitterRadiusTiles: 0.35,
        initialPhaseDegrees: 0,
        rotationDegreesPerSecond: 45,
        shotsPerEmitter: 11,
        shotIntervalSeconds: 0.19,
        cooldownSeconds: 3,
        initialCooldownSeconds: 2,
        projectileDamageHp: 160,
        projectileSpeedTilesPerSecond: 8,
        reversalSeconds: 1.5,
        lifetimeSeconds: 3,
        projectileWidth: 1.45,
        projectileHeight: 0.65,
        godMode: true,
        chaseArenaCenter: true,
        matchPlayerToHead: true,
      });
    await expect(
      page.getByRole("checkbox", { name: "Match player to head" }),
    ).toBeChecked();
    await setRange("Chase speed", 0);
    await setRange("Spawn X", 4);
    await setRange("Spawn Y", 0);
    await expect
      .poll(async () => (await inspect(page)).enemy.positionTiles)
      .toEqual({ x: 4, y: 0 });
    const matchingBodies = await page.locator("canvas").evaluate((canvas) => {
      const image = document.createElement("canvas");
      image.width = (canvas as HTMLCanvasElement).width;
      image.height = (canvas as HTMLCanvasElement).height;
      const context = image.getContext("2d")!;
      context.drawImage(canvas as HTMLCanvasElement, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const bounds = {
        player: { left: image.width, right: -1, top: image.height, bottom: -1 },
        enemy: { left: image.width, right: -1, top: image.height, bottom: -1 },
      };
      let barTop = image.height;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const red = pixels[offset]!,
          green = pixels[offset + 1]!,
          blue = pixels[offset + 2]!;
        const x = (offset / 4) % image.width,
          y = Math.floor(offset / 4 / image.width);
        const body =
          red > 225 && green > 235 && blue > 225
            ? bounds.player
            : red > 200 && green > 70 && green < 160 && blue < 150
              ? bounds.enemy
              : null;
        if (body) {
          body.left = Math.min(body.left, x);
          body.right = Math.max(body.right, x);
          body.top = Math.min(body.top, y);
          body.bottom = Math.max(body.bottom, y);
        }
        if (red === 85 && green === 214 && blue === 160)
          barTop = Math.min(barTop, y);
      }
      return {
        sizes: Object.values(bounds).map((body) => ({
          width: body.right - body.left + 1,
          height: body.bottom - body.top + 1,
        })),
        barGap: barTop - bounds.player.bottom - 1,
      };
    });
    for (const body of matchingBodies.sizes) {
      expect(body.width).toBeGreaterThanOrEqual(39);
      expect(body.width).toBeLessThanOrEqual(41);
      expect(body.height).toBeGreaterThanOrEqual(39);
      expect(body.height).toBeLessThanOrEqual(41);
    }
    expect(matchingBodies.barGap).toBeGreaterThanOrEqual(5);
    expect(matchingBodies.barGap).toBeLessThanOrEqual(7);
    await page.screenshot({
      path: testInfo.outputPath(`selected-values-${width}.png`),
      fullPage: true,
    });
    const before = await inspect(page);
    for (const slider of await sliders.all()) {
      await slider.focus();
      await slider.press("Home");
      const key = await slider.getAttribute("data-debug-parameter");
      expect((await inspect(page)).debugSettings[key!]).toBe(
        Number(await slider.inputValue()),
      );
    }
    await setRange("Spawn X", 0);
    await setRange("Spawn Y", 0);
    await setRange("Projectile damage", 1000);
    await expect
      .poll(async () => (await inspect(page)).elapsedSeconds)
      .toBeGreaterThan(before.elapsedSeconds + 1);
    const protectedState = await inspect(page);
    expect(protectedState.hitsTaken).toBe(0);
    expect(protectedState.player.healthHp).toBe(775);
    expect(protectedState.audio.requests).toBe(0);
    expect(protectedState.shards.length).toBeGreaterThan(0);
    expect(protectedState.enemy.positionTiles).toEqual({ x: 0, y: 0 });
    const debugPixels = await renderedPixels(page);
    expect(debugPixels.player).toBeGreaterThan(0);
    expect(debugPixels.shards).toBeGreaterThan(0);
    expect(debugPixels.ground).toBeGreaterThan(1000);
    await page.keyboard.press("r");
    expect((await inspect(page)).attemptId).toBe(before.attemptId);
    await page.screenshot({
      path: testInfo.outputPath(`debug-live-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("checkbox", { name: "God mode", exact: true })
      .uncheck();
    await expect(
      page.getByRole("heading", { name: "Attempt complete" }),
    ).toBeVisible();
    expect(await savedAttempts(page)).toBeNull();
    await expect(
      page.getByText("Debug attempt / not saved").last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset defaults" }).click();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    expect((await inspect(page)).rulesVersion).toBe(
      "crystal-worm-child-head-paladin-v3",
    );
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page
      .getByRole("button", { name: "Close debug", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Debug", exact: true }),
    ).toBeFocused();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.getByRole("button", { name: "Resume", exact: true }),
    ).toBeEnabled();
    await page.keyboard.down("w");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.getByRole("region", { name: "Encounter", exact: true }).click();
    const refocused = await inspect(page);
    await page.clock.runFor(300);
    expect((await inspect(page)).elapsedSeconds).toBeGreaterThan(
      refocused.elapsedSeconds + 0.25,
    );
    expect((await inspect(page)).player.positionTiles).toEqual(
      refocused.player.positionTiles,
    );
    await page.keyboard.up("w");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`debug-closed-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Home", exact: true }).click();
    expect(await savedAttempts(page)).toBeNull();
  });
}

for (const width of [1440, 390]) {
  test(`production assets and repeated practice work at ${width}px under the Pages project path`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(160_000);
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const errors: string[] = [];
    const requests: { url: string; method: string; type: string }[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) =>
      requests.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
      }),
    );
    const response = await page.goto("./");
    expect(response?.ok()).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/dodge-hell-training/");
    await expect(
      page.getByRole("heading", { name: "Changelog" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      await page
        .locator("h1, h2, button, a")
        .evaluateAll((elements) =>
          elements.some((element) => element.scrollWidth > element.clientWidth),
        ),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`release-home-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("checkbox", { name: "Mute hit audio" }).check();
    await expect(
      page.getByRole("checkbox", { name: "Mute hit audio" }),
    ).toBeChecked();
    await page.getByRole("checkbox", { name: "Mute hit audio" }).uncheck();
    for (const closeBy of ["Escape", "button"] as const) {
      const opener = page.getByRole("button", {
        name: "Controls",
        exact: true,
      });
      await opener.click();
      const dialog = page.getByRole("dialog", {
        name: "Controls",
        exact: true,
      });
      await expect(dialog).toBeVisible();
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await expect(close).toBeFocused();
      for (const key of ["Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        await expect(close).toBeFocused();
      }
      expect(
        await dialog.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.left >= 0 &&
            box.right <= innerWidth &&
            box.top >= 0 &&
            box.bottom <= innerHeight &&
            ![...element.querySelectorAll("h2, dt, dd, button")].some(
              (child) => child.scrollWidth > child.clientWidth,
            )
          );
        }),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`release-controls-${width}.png`),
        fullPage: true,
      });
      if (closeBy === "Escape") await page.keyboard.press("Escape");
      else await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await expect(page.locator("canvas")).toHaveCount(0);
    }
    const assets = await page
      .locator('script[src], link[rel="stylesheet"]')
      .evaluateAll((elements) =>
        elements.map((element) =>
          element instanceof HTMLScriptElement
            ? element.src
            : (element as HTMLLinkElement).href,
        ),
      );
    expect(assets.length).toBeGreaterThanOrEqual(2);
    for (const asset of assets) {
      expect(new URL(asset).pathname).toMatch(
        /^\/dodge-hell-training\/assets\//,
      );
      const resource = await page.request.get(asset);
      expect(resource.ok()).toBe(true);
      expect(resource.headers()["content-type"]).toMatch(/javascript|css/);
    }
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByLabel("Session status")).toHaveText("Starting");
    await expect(page.getByLabel("Survival time")).toHaveText("0.0 s");
    await finishCountdown(page, false);
    const beforeControls = await renderedPixels(page);
    await page.getByRole("button", { name: "Controls", exact: true }).click();
    await expect(page.getByLabel("Session status")).toHaveText("Paused");
    const frozenTime = await page.getByLabel("Survival time").textContent();
    for (const key of ["w", "r", "o", "p"]) await page.keyboard.press(key);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Paused overlay")).toBeVisible();
    await expect(page.getByLabel("Survival time")).toHaveText(frozenTime!);
    expect((await renderedPixels(page)).player).toBe(beforeControls.player);
    await page.screenshot({
      path: testInfo.outputPath(`release-paused-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByLabel("Session status")).toHaveText("Active");
    if (width === 1440) {
      await page.keyboard.press("o");
      await page.keyboard.press("o");
      await expect
        .poll(
          async () => {
            await page.clock.runFor(controlledFrameMilliseconds);
            return (await renderedPixels(page)).enemy;
          },
          { intervals: [0] },
        )
        .toBeGreaterThan(10);
      for (const [key, axis, direction] of [
        ["w", "enemyY", 1],
        ["d", "enemyX", -1],
        ["a", "enemyX", 1],
        ["s", "enemyY", -1],
      ] as const) {
        const before = await renderedPixels(page);
        expect(before.enemy).toBeGreaterThan(10);
        await page.keyboard.down(key);
        try {
          await expect
            .poll(
              async () => {
                await page.clock.runFor(controlledFrameMilliseconds);
                const position = (await renderedPixels(page))[axis];
                return position === null
                  ? 0
                  : (position - before[axis]!) * direction;
              },
              { intervals: [0] },
            )
            .toBeGreaterThan(8);
        } finally {
          await page.keyboard.up(key);
        }
      }
      const beforeZoom = await renderedPixels(page);
      await page.keyboard.press("p");
      await expect
        .poll(
          async () => {
            await page.clock.runFor(controlledFrameMilliseconds);
            return (await renderedPixels(page)).player;
          },
          { intervals: [0] },
        )
        .toBeGreaterThan(beforeZoom.player);
      const zoomed = await renderedPixels(page);
      await page.keyboard.press("o");
      await expect
        .poll(
          async () => {
            await page.clock.runFor(controlledFrameMilliseconds);
            return (await renderedPixels(page)).player;
          },
          { intervals: [0] },
        )
        .toBeLessThan(zoomed.player);
    } else {
      await page.keyboard.press("o");
      await page.keyboard.press("o");
    }
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Session status")).toHaveText("Paused");
    const pausedTime = await page.getByLabel("Survival time").textContent();
    await page.clock.runFor(200);
    await expect(page.getByLabel("Survival time")).toHaveText(pausedTime!);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByLabel("Session status")).toHaveText("Active");
    await page.keyboard.press("r");
    await expect(page.getByLabel("Survival time")).toHaveText("0.0 s");
    await expect(page.getByRole("meter", { name: "Health" })).toHaveAttribute(
      "value",
      "775",
    );
    await expect
      .poll(
        async () => {
          await page.clock.runFor(controlledFrameMilliseconds);
          const snapshot = await renderedPixels(page);
          return (
            snapshot.survivalSeconds >= 1 &&
            snapshot.survivalSeconds < 2 &&
            snapshot.shards === 0
          );
        },
        { intervals: [0] },
      )
      .toBe(true);
    await expect
      .poll(
        async () => {
          await page.clock.runFor(controlledFrameMilliseconds);
          return (await renderedPixels(page)).shards;
        },
        { timeout: 6000, intervals: [0] },
      )
      .toBeGreaterThan(5);
    const pixels = await renderedPixels(page);
    expect(pixels.player).toBeGreaterThan(10);
    expect(pixels.healthBar).toBeGreaterThan(150);
    expect(pixels.ground).toBeGreaterThan(1000);
    const layout = await page.evaluate(() => ({
      headerBottom: document.querySelector("header")!.getBoundingClientRect()
        .bottom,
      arenaTop: document
        .querySelector('[aria-label="Encounter"]')!
        .getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(layout.headerBottom).toBeLessThanOrEqual(layout.arenaTop);
    expect(layout.overflow).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`release-encounter-${width}.png`),
      fullPage: true,
    });
    await expect
      .poll(
        async () => {
          await page.clock.runFor(controlledFrameMilliseconds);
          return Number(
            await page
              .getByRole("meter", { name: "Health" })
              .getAttribute("value"),
          );
        },
        { timeout: 15000, intervals: [0] },
      )
      .toBeLessThan(775);
    await expect
      .poll(async () => (await renderedPixels(page)).missingHealth)
      .toBeGreaterThan(5);
    await expect
      .poll(async () => (await renderedPixels(page)).hitText, {
        intervals: [50],
      })
      .toBeGreaterThan(5);
    await page.screenshot({
      path: testInfo.outputPath(`release-feedback-${width}.png`),
      fullPage: true,
    });
    const results = page.getByRole("region", { name: "Attempt complete" });
    const completed = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      await expect
        .poll(
          async () => {
            await page.clock.runFor(controlledFrameMilliseconds);
            return results.isVisible();
          },
          { timeout: 70000, intervals: [0] },
        )
        .toBe(true);
      await expect(
        results.getByRole("group", { name: "Final hit amounts" }),
      ).toContainText("-128");
      await expect(page.getByRole("meter", { name: "Health" })).toHaveAttribute(
        "value",
        "0",
      );
      expect((await renderedPixels(page)).healthBar).toBe(0);
      expect((await renderedPixels(page)).missingHealth).toBeGreaterThan(150);
      const saved = await savedAttempts(page);
      expect(saved.schemaVersion).toBe(1);
      expect(saved.records).toHaveLength(attempt);
      expect(
        new Set(saved.records.map((record: { id: string }) => record.id)).size,
      ).toBe(attempt);
      const record = saved.records[0];
      expect(record).toEqual({
        id: expect.any(String),
        rulesVersion: "crystal-worm-child-head-paladin-v3",
        outcome: "death",
        elapsedSeconds: expect.any(Number),
        hitsTaken: expect.any(Number),
      });
      expect(record.elapsedSeconds).toBeGreaterThan(0);
      expect(record.hitsTaken).toBeGreaterThan(0);
      await expect(results.locator("dd").nth(0)).toHaveText(
        `${record.elapsedSeconds.toFixed(2)} s`,
      );
      await expect(results.locator("dd").nth(1)).toHaveText(
        String(record.hitsTaken),
      );
      expect(
        await results.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.left >= 0 &&
            box.right <= innerWidth &&
            box.top >= 0 &&
            box.bottom <= innerHeight &&
            ![element, ...element.querySelectorAll("h2, dd, button")].some(
              (child) => child.scrollWidth > child.clientWidth,
            )
          );
        }),
      ).toBe(true);
      completed.push(record);
      if (attempt === 1) {
        await page.screenshot({
          path: testInfo.outputPath(`release-results-${width}.png`),
          fullPage: true,
        });
        await results
          .getByRole("button", { name: "Retry", exact: true })
          .click();
        await expect(results).toHaveCount(0);
        await expect(page.getByLabel("Survival time")).toHaveText("0.0 s");
        for (let retry = 0; retry < 5; retry++) {
          await page.keyboard.press("r");
          await expect(page.getByLabel("Survival time")).toHaveText("0.0 s");
          await expect(
            page.getByRole("meter", { name: "Health" }),
          ).toHaveAttribute("value", "775");
          await expect(page.locator("canvas")).toHaveCount(1);
        }
        expect(await savedAttempts(page)).toEqual(saved);
      }
    }
    const saved = await savedAttempts(page);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.reload();
    expect(await savedAttempts(page)).toEqual(saved);
    await expect(
      page.getByRole("checkbox", { name: "Mute hit audio" }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("listitem", { name: /completed attempt/i }),
    ).toHaveCount(2);
    await expect(page.getByLabel("Retained personal best")).toHaveText(
      `${Math.max(...completed.map((record) => record.elapsedSeconds)).toFixed(2)} s`,
    );
    await page.screenshot({
      path: testInfo.outputPath(`release-history-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByLabel("Session status")).toHaveText("Starting");
    await finishCountdown(page, false);
    const restoredPixels = await renderedPixels(page);
    expect(Math.abs(restoredPixels.player - pixels.player)).toBeLessThan(
      pixels.player * 0.1 + 4,
    );
    await page.getByRole("button", { name: "Home", exact: true }).click();
    expect(await savedAttempts(page)).toEqual(saved);
    expect(
      requests.every(
        (request) =>
          request.method === "GET" &&
          !["fetch", "xhr", "websocket"].includes(request.type) &&
          new URL(request.url).origin === new URL(page.url()).origin &&
          new URL(request.url).pathname.startsWith("/dodge-hell-training/"),
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await writeFile(
      testInfo.outputPath(`release-verification-${width}.json`),
      JSON.stringify(
        {
          url: page.url(),
          browser: testInfo.project.name,
          width,
          completed,
          pixels,
          requests,
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
  });
}

test("Start countdown freezes world, focus pause preserves it, and R skips countdown", async ({
  page,
}) => {
  await page.goto("./");
  await page.keyboard.press("r");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page))?.sessionPhase)
    .toBe("countdown");
  await page.keyboard.down("d");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const paused = await inspect(page);
  await page.waitForTimeout(200);
  expect(await inspect(page)).toEqual(paused);
  expect(paused.elapsedSeconds).toBe(0);
  expect(paused.volleysFired).toBe(0);
  expect(paused.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(paused.enemy.positionTiles).toEqual({ x: 0, y: -16.2 });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page)).sessionPhase)
    .toBe("countdown");
  const reset = await retrySnapshot(page);
  expect(reset.sessionPhase).toBe("playing");
  expect(reset.countdownRemainingSeconds).toBe(0);
  expect(reset.elapsedSeconds).toBe(0);
  expect(reset.attemptId).toBe(2);
  await expect
    .poll(async () => (await inspect(page)).elapsedSeconds)
    .toBeGreaterThan(0);
  expect((await inspect(page)).player.positionTiles).toEqual({ x: 0, y: 0 });
  await page.keyboard.up("d");
});

test("held R restarts once, burst retry fully resets, and Escape resumes without stale input", async ({
  page,
}) => {
  await launch(page);
  const canvas = await page.locator("canvas").elementHandle();
  await page.keyboard.press("p");
  await expect
    .poll(async () => (await inspect(page)).volleysFired)
    .toBeGreaterThan(0);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(0);
  const reset = await retrySnapshot(page);
  expect(reset.player).toEqual({
    positionTiles: { x: 0, y: 0 },
    healthHp: 775,
    combatRemainingSeconds: 0,
  });
  expect(reset.enemy).toEqual({
    positionTiles: { x: 0, y: -16.2 },
    emitterPhaseRadians: 0,
  });
  expect(reset.shards).toEqual([]);
  expect(reset.volleysFired).toBe(0);
  expect(reset.ticksElapsed).toBe(0);
  expect(reset.accumulatorSeconds).toBe(0);
  expect(reset.hitsTaken).toBe(0);
  expect(reset.result).toBeNull();
  expect(reset.zoom).toBe(1.125);
  await page.waitForTimeout(150);
  expect((await inspect(page)).player.positionTiles).toEqual({ x: 0, y: 0 });
  await page.keyboard.up("d");
  await page.keyboard.down("r");
  await expect.poll(async () => (await inspect(page)).attemptId).toBe(3);
  await page.keyboard.down("r");
  await page.keyboard.down("r");
  expect((await inspect(page)).attemptId).toBe(3);
  await page.keyboard.up("r");
  for (let attempt = 4; attempt <= 6; attempt++) {
    await page.keyboard.press("r");
    await expect
      .poll(async () => (await inspect(page)).attemptId)
      .toBe(attempt);
    expect((await inspect(page)).keydownListeners).toBe(1);
    expect(
      await canvas!.evaluate(
        (element) => element === document.querySelector("canvas"),
      ),
    ).toBe(true);
  }
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await inspect(page)).sessionPhase)
    .toBe("paused");
  const paused = await inspect(page);
  await page.waitForTimeout(200);
  expect(await inspect(page)).toEqual(paused);
  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await inspect(page)).elapsedSeconds)
    .toBeGreaterThan(paused.elapsedSeconds);
  expect((await inspect(page)).player.positionTiles).toEqual(
    paused.player.positionTiles,
  );
  await page.keyboard.up("d");
  await page.keyboard.press("Escape");
  const fromPause = await retrySnapshot(page);
  expect(fromPause.sessionPhase).toBe("playing");
  expect(fromPause.elapsedSeconds).toBe(0);
  expect(fromPause.attemptId).toBe(7);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.keyboard.press("r");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page))?.sessionPhase)
    .toBe("countdown");
  expect((await inspect(page)).zoom).toBe(1.125);
  expect((await inspect(page)).result).toBeNull();
});

test("queued control events cannot replay a retry or pause within the same frame", async ({
  page,
}) => {
  await launch(page);
  const snapshot = await page.evaluate(async () => {
    const modulePath = new URL("src/game/phaser/encounter.ts", document.baseURI)
      .href;
    const adapter = await import(/* @vite-ignore */ modulePath);
    for (const [code, keyCode] of [
      ["KeyR", 82],
      ["Escape", 27],
    ] as const) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          code,
          keyCode,
          bubbles: true,
          cancelable: true,
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keyup", { code, keyCode, bubbles: true }),
      );
    }
    return adapter.inspectEncounter(
      document.querySelector('[aria-label="Encounter"]'),
    );
  });
  expect(snapshot.attemptId).toBe(2);
  expect(snapshot.sessionPhase).toBe("paused");
});

for (const width of [1440, 390]) {
  test(`death results, keyboard/button Retry and Home work at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await launch(page);
    await page.keyboard.press("p");
    const canvas = await page.locator("canvas").elementHandle();
    const originalBox = await page
      .getByRole("region", { name: "Encounter", exact: true })
      .boundingBox();
    await expect(
      page.getByRole("button", { name: "Resume", exact: true }),
    ).toBeDisabled();
    await expect
      .poll(async () => (await inspect(page)).sessionPhase, { timeout: 70_000 })
      .toBe("ended");
    const ended = await inspect(page);
    const saved = await savedAttempts(page);
    expect(saved.schemaVersion).toBe(1);
    expect(saved.records).toHaveLength(1);
    expect(saved.records[0]).toEqual({
      id: expect.any(String),
      rulesVersion: ended.rulesVersion,
      outcome: "death",
      elapsedSeconds: ended.elapsedSeconds,
      hitsTaken: ended.hitsTaken,
    });
    const results = page.getByRole("region", { name: "Attempt complete" });
    await expect(results).toBeVisible();
    await expect(results.getByLabel("Retained personal best")).toHaveText(
      `${ended.elapsedSeconds.toFixed(2)} s`,
    );
    await expect(
      results.getByRole("listitem", { name: /completed attempt/i }),
    ).toHaveCount(1);
    await expect(results.getByRole("heading")).toBeFocused();
    await expect(results).toContainText(`${ended.elapsedSeconds.toFixed(2)} s`);
    await expect(results.locator("dd").nth(1)).toHaveText(
      String(ended.hitsTaken),
    );
    expect(
      await page
        .getByRole("region", { name: "Encounter", exact: true })
        .boundingBox(),
    ).toEqual(originalBox);
    await expect(page.getByLabel("Survival time")).toHaveAttribute(
      "aria-live",
      "off",
    );
    await expect(page.getByRole("meter", { name: "Health" })).toHaveAttribute(
      "value",
      "0",
    );
    await expect(
      results.getByRole("button", { name: "Retry", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Tab");
    await expect(
      results.getByRole("button", { name: "Retry", exact: true }),
    ).toBeFocused();
    const resultLayout = await results.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        withinViewport:
          box.left >= 0 &&
          box.right <= innerWidth &&
          box.top >= 0 &&
          box.bottom <= innerHeight,
        overflow: element.scrollWidth > element.clientWidth,
        clippedText: [...element.querySelectorAll("h2, dd, button")].some(
          (child) => child.scrollWidth > child.clientWidth,
        ),
      };
    });
    expect(resultLayout).toEqual({
      withinViewport: true,
      overflow: false,
      clippedText: false,
    });
    await page.screenshot({
      path: testInfo.outputPath(`results-${width}.png`),
      fullPage: true,
    });
    expect(ended.result).toEqual({
      attemptId: ended.attemptId,
      rulesVersion: ended.rulesVersion,
      outcome: "death",
      elapsedSeconds: ended.elapsedSeconds,
      hitsTaken: ended.hitsTaken,
    });
    await page.waitForTimeout(200);
    expect(await inspect(page)).toEqual(ended);
    const reset = await retrySnapshot(page, width === 1440 ? "button" : "key");
    expect(reset.attemptId).toBe(ended.attemptId + 1);
    expect(reset.sessionPhase).toBe("playing");
    expect(reset.result).toBeNull();
    expect(reset.player.healthHp).toBe(775);
    expect(reset.elapsedSeconds).toBe(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect
      .poll(async () => (await inspect(page)).attemptId)
      .toBe(reset.attemptId + 1);
    expect((await inspect(page)).sessionPhase).toBe("playing");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect((await inspect(page)).keydownListeners).toBe(1);
    expect(
      await canvas!.evaluate(
        (element) => element === document.querySelector("canvas"),
      ),
    ).toBe(true);
    await expect(results).toHaveCount(0);
    expect(await savedAttempts(page)).toEqual(saved);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.reload();
    expect(await savedAttempts(page)).toEqual(saved);
    await expect(page.getByLabel("Retained personal best")).toHaveText(
      `${ended.elapsedSeconds.toFixed(2)} s`,
    );
    await expect(
      page.getByRole("listitem", { name: /completed attempt/i }),
    ).toHaveCount(1);
    await page.screenshot({
      path: testInfo.outputPath(`history-${width}.png`),
      fullPage: true,
    });
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await inspect(page))?.sessionPhase)
      .toBe("countdown");
  });
}

test("loaded history compares only compatible retained records", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const storagePath = new URL("src/storage/attempts.ts", document.baseURI)
      .href;
    const configPath = new URL("src/game/config/encounter.ts", document.baseURI)
      .href;
    const { HISTORY_STORAGE_KEY, HISTORY_SCHEMA_VERSION } = await import(
      /* @vite-ignore */ storagePath
    );
    const { RULES_VERSION } = await import(/* @vite-ignore */ configPath);
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: HISTORY_SCHEMA_VERSION,
        records: [
          {
            id: "other",
            rulesVersion: "crystal-worm-child-head-paladin-v1",
            outcome: "death",
            elapsedSeconds: 999,
            hitsTaken: 1,
          },
          {
            id: "current",
            rulesVersion: RULES_VERSION,
            outcome: "death",
            elapsedSeconds: 20,
            hitsTaken: 7,
          },
        ],
      }),
    );
  });
  await page.reload();
  await expect(page.getByLabel("Retained personal best")).toHaveText("20.00 s");
  await expect(page.getByText("Other rules", { exact: true })).toBeVisible();
  await expect(page.getByText("999.00 s", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect
    .poll(async () => (await inspect(page))?.sessionPhase)
    .toBe("countdown");
  await retrySnapshot(page);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  expect((await savedAttempts(page)).records).toHaveLength(2);
  expect((await savedAttempts(page)).records[0]).toEqual({
    id: "other",
    rulesVersion: "crystal-worm-child-head-paladin-v1",
    outcome: "death",
    elapsedSeconds: 999,
    hitsTaken: 1,
  });
});

for (const failure of ["corrupt", "blocked", "quota"] as const) {
  test(`${failure} storage still allows death, Retry, and Home`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((failure) => {
      if (failure === "corrupt")
        localStorage.setItem("dodge-hell-training.attempts", "{");
      if (failure === "blocked")
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new Error("SecurityError");
          },
        });
      if (failure === "quota")
        Storage.prototype.setItem = () => {
          throw new Error("QuotaExceededError");
        };
    }, failure);
    await launch(page);
    await expect
      .poll(async () => (await inspect(page)).sessionPhase, { timeout: 70_000 })
      .toBe("ended");
    await expect(
      page.getByText(/Results are kept for this visit only/),
    ).toBeVisible();
    const results = page.getByRole("region", { name: "Attempt complete" });
    await page.screenshot({
      path: testInfo.outputPath(`storage-${failure}.png`),
      fullPage: true,
    });
    await results.getByRole("button", { name: "Retry", exact: true }).click();
    await expect
      .poll(async () => (await inspect(page)).sessionPhase)
      .toBe("playing");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("listitem", { name: /completed attempt/i }),
    ).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("sustained play for 60 seconds and 25 retries retain bounded runtime resources", async ({
  page,
}, testInfo) => {
  const browserSeconds = 60;
  const retryCount = 25;
  const millisecondsPerSecond = 1000;
  const movementSegmentSeconds = 4;
  const sampleMilliseconds = 250;
  test.setTimeout((browserSeconds + 30) * millisecondsPerSecond);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await launch(page);
  const canvas = await page.locator("canvas").elementHandle();
  const animationFrames = page.evaluate(
    (durationMilliseconds) =>
      new Promise<{
        frameCount: number;
        medianGapMilliseconds: number;
        p95GapMilliseconds: number;
        maximumGapMilliseconds: number;
      }>((resolve) => {
        const started = performance.now();
        let previous = started;
        const gaps: number[] = [];
        function measure(now: number) {
          gaps.push(now - previous);
          previous = now;
          if (now - started < durationMilliseconds)
            requestAnimationFrame(measure);
          else {
            gaps.sort((first, second) => first - second);
            resolve({
              frameCount: gaps.length,
              medianGapMilliseconds: gaps[Math.floor(gaps.length / 2)]!,
              p95GapMilliseconds: gaps[Math.floor(gaps.length * 0.95)]!,
              maximumGapMilliseconds: gaps[gaps.length - 1]!,
            });
          }
        }
        requestAnimationFrame(measure);
      }),
    browserSeconds * millisecondsPerSecond,
  );
  const route = ["d", "s", "a", "w"];
  const started = Date.now();
  let heldKey = "";
  let previous = await inspect(page);
  let simulatedSeconds = 0;
  let peakShards = 0;
  let peakHitNumbers = 0;
  let peakAudioVoices = 0;
  let deaths = 0;
  let progressSamples = 0;
  let lastProgress = Date.now();
  while (Date.now() - started < browserSeconds * millisecondsPerSecond) {
    let state = await inspect(page);
    peakShards = Math.max(peakShards, state.shards.length);
    peakHitNumbers = Math.max(peakHitNumbers, state.hitNumbers.length);
    peakAudioVoices = Math.max(peakAudioVoices, state.audio.activeVoices);
    expect(state.hitNumbers.length).toBeLessThanOrEqual(16);
    expect(state.audio.activeVoices).toBeLessThanOrEqual(4);
    expect(state.audio.requests).toBe(state.hitsTaken);
    expect(state.shards.length).toBeLessThanOrEqual(
      6 * 11 * Math.ceil(3 / 4.9),
    );
    expect(
      state.shards.every((shard) => shard.ageSeconds < shard.lifetimeSeconds),
    ).toBe(true);
    expect(state.keydownListeners).toBe(1);
    await expect(page.locator("canvas")).toHaveCount(1);
    if (
      state.attemptId === previous.attemptId &&
      state.ticksElapsed > previous.ticksElapsed
    ) {
      simulatedSeconds += state.elapsedSeconds - previous.elapsedSeconds;
      progressSamples++;
      lastProgress = Date.now();
    }
    expect(Date.now() - lastProgress).toBeLessThan(2 * millisecondsPerSecond);
    if (state.sessionPhase === "ended") {
      deaths++;
      if (heldKey) await page.keyboard.up(heldKey);
      heldKey = "";
      state = await retrySnapshot(page);
      lastProgress = Date.now();
    }
    const nextKey =
      route[
        Math.floor(
          (Date.now() - started) /
            (movementSegmentSeconds * millisecondsPerSecond),
        ) % route.length
      ]!;
    if (heldKey !== nextKey) {
      if (heldKey) await page.keyboard.up(heldKey);
      heldKey = nextKey;
      await page.keyboard.down(heldKey);
    }
    previous = state;
    await page.waitForTimeout(sampleMilliseconds);
  }
  if (heldKey) await page.keyboard.up(heldKey);
  const frames = await animationFrames;
  expect(frames.frameCount).toBeGreaterThan(0);
  expect(progressSamples).toBeGreaterThan(0);
  const beforeRetries = await inspect(page);
  for (let index = 0; index < retryCount; index++) {
    const reset = await retrySnapshot(page);
    expect(reset.attemptId).toBe(beforeRetries.attemptId + index + 1);
    expect(reset.sessionPhase).toBe("playing");
    expect(reset.elapsedSeconds).toBe(0);
    expect(reset.hitsTaken).toBe(0);
    expect(reset.volleysFired).toBe(0);
    expect(reset.shards).toEqual([]);
    expect(reset.player.healthHp).toBe(775);
    expect(reset.keydownListeners).toBe(1);
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(
      await canvas!.evaluate(
        (element) => element === document.querySelector("canvas"),
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  const metricsPath = testInfo.outputPath("sustained-validation.json");
  await writeFile(
    metricsPath,
    JSON.stringify(
      {
        browserSeconds,
        simulatedSeconds,
        deaths,
        peakShards,
        peakHitNumbers,
        peakAudioVoices,
        progressSamples,
        retryCount,
        ...frames,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("sustained-validation", {
    path: metricsPath,
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath("after-25-retries.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("launches one Phaser canvas and cleans it up across repeated mounts", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Crystal Worm Child", level: 1 }),
  ).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.getByLabel("Survival time")).not.toHaveText("0.0 s");
    expect((await inspect(page)).keydownListeners).toBe(1);
    await page.getByRole("button", { name: "Home", exact: true }).click();
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
  for (let press = 0; press < 24; press++) await page.keyboard.press("p");
  await expect.poll(async () => (await inspect(page)).zoom).toBe(3);
  for (let press = 0; press < 32; press++) await page.keyboard.press("o");
  await expect.poll(async () => (await inspect(page)).zoom).toBe(0.25);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await inspect(page)).player.positionTiles.x)
    .toBeCloseTo(Math.sqrt(19.2 ** 2 - 0.375 ** 2) - 0.625, 5);
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
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const paused = await inspect(page);
  await page.keyboard.up("d");
  await page.keyboard.press("p");
  await page.clock.runFor(300);
  expect(await inspect(page)).toEqual(paused);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.runFor(100);
  const resumed = await inspect(page);
  expect(resumed.elapsedSeconds).toBeGreaterThan(paused.elapsedSeconds);
  expect(resumed.player.positionTiles).toEqual(paused.player.positionTiles);
  expect(resumed.zoom).toBe(paused.zoom);
  expect(resumed.elapsedSeconds - paused.elapsedSeconds).toBeLessThan(0.2);
  await page.getByRole("button", { name: "Home", exact: true }).focus();
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
  await page.clock.runFor(300);
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
  await page.clock.runFor(100);
  expect((await inspect(page)).elapsedSeconds).toBeGreaterThan(
    hidden.elapsedSeconds,
  );
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
    .poll(async () => (await inspect(page)).hitNumbers.length, {
      timeout: 4000,
      intervals: [50],
    })
    .toBeGreaterThan(0);
  const hit = await inspect(page);
  expect(hit.hitsTaken).toBeGreaterThan(0);
  expect(hit.audio.requests).toBe(hit.hitsTaken);
  expect(hit.audio.played).toBeGreaterThan(0);
  expect(hit.player.healthHp).toBeLessThan(775);
  expect(hit.hitNumbers.length).toBeGreaterThan(0);
  expect(
    hit.hitNumbers.every(
      (number) => number.damageHp === 128 && number.text === "-128",
    ),
  ).toBe(true);
  expect(hit.shards.some((shard) => shard.hasHitPlayer)).toBe(true);
  expect(
    hit.shards.every((shard) => shard.ageSeconds < shard.lifetimeSeconds),
  ).toBe(true);
  await page.keyboard.press("Escape");
  const frozen = (await inspect(page)).hitNumbers;
  await page.waitForTimeout(250);
  expect((await inspect(page)).hitNumbers).toEqual(frozen);
  expect((await retrySnapshot(page)).hitNumbers).toEqual([]);
});

for (const mode of ["muted", "unavailable"] as const) {
  test(`${mode} audio never blocks hits, results or retry`, async ({
    page,
  }) => {
    if (mode === "unavailable")
      await page.addInitScript(() => {
        Object.defineProperty(window, "AudioContext", { value: undefined });
        Object.defineProperty(window, "webkitAudioContext", {
          value: undefined,
        });
      });
    await launch(page);
    if (mode === "muted") {
      await page.getByRole("checkbox", { name: "Mute hit audio" }).check();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
    }
    await expect
      .poll(async () => (await inspect(page)).hitNumbers.length, {
        timeout: 10000,
        intervals: [50],
      })
      .toBeGreaterThan(0);
    const silent = await inspect(page);
    expect(silent.audio.requests).toBe(silent.hitsTaken);
    expect(silent.audio.played).toBe(0);
    if (mode === "muted") {
      await page.getByRole("checkbox", { name: "Mute hit audio" }).uncheck();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expect
        .poll(async () => (await inspect(page)).audio.played, {
          timeout: 10000,
        })
        .toBeGreaterThan(0);
    }
    await expect(
      page.getByRole("region", { name: "Attempt complete" }),
    ).toBeVisible({ timeout: 15000 });
    const ended = await inspect(page);
    expect(ended.audio.requests).toBe(ended.hitsTaken);
    expect(ended.audio.activeVoices).toBeLessThanOrEqual(4);
    const reset = await retrySnapshot(page);
    expect(reset.audio).toMatchObject({
      requests: 0,
      played: 0,
      activeVoices: 0,
    });
    expect(reset.hitNumbers).toEqual([]);
  });
}

for (const phase of ["countdown", "playing", "paused"] as const) {
  test(`Controls isolates ${phase} and requires explicit Resume without catch-up`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect
      .poll(async () => (await inspect(page))?.sessionPhase)
      .toBe("countdown");
    if (phase !== "countdown")
      await expect
        .poll(async () => (await inspect(page)).sessionPhase)
        .toBe("playing");
    if (phase === "paused") await page.keyboard.press("Escape");
    const canvas = await page.locator("canvas").elementHandle();
    await page.keyboard.down("w");
    const opener = page.getByRole("button", { name: "Controls", exact: true });
    await opener.click();
    await expect(page.getByRole("dialog", { name: "Controls" })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const frozen = await inspect(page);
    for (const key of ["a", "s", "d", "r", "o", "p"])
      await page.keyboard.press(key);
    await page.clock.runFor(250);
    const unchanged = (state: Inspection) => ({
      player: state.player,
      enemy: state.enemy,
      shards: state.shards,
      ticks: state.ticksElapsed,
      zoom: state.zoom,
      attemptId: state.attemptId,
      countdown: state.countdownRemainingSeconds,
    });
    expect(unchanged(await inspect(page))).toEqual(unchanged(frozen));
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page.getByLabel("Paused overlay")).toBeVisible();
    await page.clock.runFor(200);
    expect((await inspect(page)).sessionPhase).toBe("paused");
    expect(unchanged(await inspect(page))).toEqual(unchanged(frozen));
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(200);
    const resumed = await inspect(page);
    expect(resumed.player.positionTiles).toEqual(frozen.player.positionTiles);
    expect(resumed.attemptId).toBe(frozen.attemptId);
    if (phase === "countdown") {
      expect(resumed.sessionPhase).toBe("countdown");
      expect(resumed.countdownRemainingSeconds).toBeGreaterThan(
        frozen.countdownRemainingSeconds - 0.4,
      );
    } else {
      expect(resumed.sessionPhase).toBe("playing");
      expect(resumed.elapsedSeconds - frozen.elapsedSeconds).toBeGreaterThan(0);
      expect(resumed.elapsedSeconds - frozen.elapsedSeconds).toBeLessThan(0.4);
    }
    await page.keyboard.up("w");
    expect(
      await canvas!.evaluate(
        (element) => element === document.querySelector("canvas"),
      ),
    ).toBe(true);
    expect(resumed.keydownListeners).toBe(1);
  });
}

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
  await page.getByRole("button", { name: "Home", exact: true }).focus();
  expect((await dispatch()).movement).toBe(false);
  await page.getByRole("button", { name: "Home", exact: true }).click();
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

for (const width of [1440, 390]) {
  for (const zoom of [0.25, 1, 3]) {
    test(`real hit feedback stays readable at ${zoom}x zoom at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await launch(page, false);
      const current = (await inspect(page)).zoom;
      for (
        let press = 0;
        press < Math.round(Math.abs(zoom - current) / 0.125);
        press++
      )
        await page.keyboard.press(zoom < current ? "o" : "p");
      await retrySnapshot(page);
      await expect
        .poll(
          async () => {
            await page.clock.runFor(controlledFrameMilliseconds);
            return (await inspect(page)).hitNumbers.length;
          },
          { timeout: 10000, intervals: [0] },
        )
        .toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      const state = await inspect(page);
      expect(state.zoom).toBe(zoom);
      expect(state.hitNumbers.length).toBeGreaterThan(0);
      for (const number of state.hitNumbers) {
        expect(number.text).toBe("-128");
        expect(number.widthCssPixels).toBeGreaterThan(30);
        expect(number.widthCssPixels).toBeLessThan(70);
        expect(number.heightCssPixels).toBeGreaterThan(15);
        expect(number.heightCssPixels).toBeLessThan(40);
      }
      await page.screenshot({
        path: testInfo.outputPath(`feedback-${width}-${zoom}.png`),
        fullPage: true,
      });
      await expect
        .poll(async () => (await renderedPixels(page)).hitText, {
          intervals: [50],
        })
        .toBeGreaterThan(5);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
    });
  }
}

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`renders readable nonblank arena at ${viewport.width}px without layout overlap`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Changelog" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Enemy reference" }),
    ).toHaveAttribute(
      "href",
      "https://www.realmeye.com/wiki/crystal-worm-child",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      await page
        .locator("h1, h2, button, a")
        .evaluateAll((elements) =>
          elements.some((element) => element.scrollWidth > element.clientWidth),
        ),
    ).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`home-${viewport.width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await inspect(page))?.sessionPhase)
      .toBe("countdown");
    const countdownBox = await page
      .getByRole("region", { name: "Encounter", exact: true })
      .boundingBox();
    const camera = await page.evaluate(async () => {
      const path = new URL("src/game/config/encounter.ts", document.baseURI)
        .href;
      return (await import(/* @vite-ignore */ path)).ENCOUNTER_CONFIG.camera;
    });
    for (const target of [
      camera.minZoom,
      camera.defaultZoom,
      camera.maxZoom,
      camera.defaultZoom,
    ]) {
      const current = (await inspect(page)).zoom;
      for (
        let step = 0;
        step < Math.round(Math.abs(target - current) / camera.zoomStep);
        step++
      ) {
        await page.keyboard.press(target < current ? "o" : "p");
      }
      await expect.poll(async () => (await inspect(page)).zoom).toBe(target);
      await expect
        .poll(async () => (await renderedPixels(page)).player)
        .toBeGreaterThan(10);
      await expect
        .poll(async () => (await renderedPixels(page)).healthBar)
        .toBeGreaterThan(150);
      await page.screenshot({
        path: testInfo.outputPath(`geometry-${viewport.width}-${target}.png`),
        fullPage: true,
      });
    }
    await expect
      .poll(async () => (await inspect(page)).elapsedSeconds)
      .toBeGreaterThan(0);
    expect(
      await page
        .getByRole("region", { name: "Encounter", exact: true })
        .boundingBox(),
    ).toEqual(countdownBox);
    await expect(page.getByLabel("Primary stats")).toContainText("42 VIT");
    await expect(page.getByLabel("Primary stats")).toContainText("41 SPD");
    await expect(page.getByLabel("Primary stats")).toContainText("32 DEF");
    await page.keyboard.press("o");
    await page.keyboard.press("o");
    await expect
      .poll(async () => (await inspect(page)).shards.length, { timeout: 6000 })
      .toBeGreaterThan(0);
    const state = await inspect(page);
    expect(state.viewport.width).toBe(viewport.width);
    let pixels = await renderedPixels(page);
    if (viewport.width > 600)
      await expect
        .poll(async () => {
          pixels = await renderedPixels(page);
          return pixels.enemy;
        })
        .toBeGreaterThan(10);
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
