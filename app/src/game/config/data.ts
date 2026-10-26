import type { CircularArena, Vector2 } from "../models";
import arenaData from "../data/arena.json";
import shapesData from "../data/shapes.json";
import enemiesData from "../data/enemies.json";
import encounterData from "../data/encounter.json";

// Boundary between authored JSON and the derived runtime configuration.
//
// `strict` is not enabled for this project (G21), so the compiler does not
// reject a missing or mistyped authored value. Every value is therefore
// validated here at runtime, in the same defensive style as the storage
// adapter. A malformed data file is a programming error caught at module load,
// not a recoverable user condition, so these throw rather than fall back.

const minimumOutlineVertices = 3;
const maximumOutlineVertices = 8;
const normalizedOutlineSpanTiles = 1;

function reject(path: string, reason: string): never {
  throw new RangeError(`Authored data ${path} ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    reject(path, "must be a finite number");
  return value;
}

function readPoint(value: unknown, path: string): Vector2 {
  if (!isRecord(value)) reject(path, "must be an object with x and y tiles");
  return {
    x: finiteNumber(value.x, `${path}.x`),
    y: finiteNumber(value.y, `${path}.y`),
  };
}

export function validateArena(value: unknown): CircularArena {
  if (!isRecord(value)) reject("arena", "must be an object");
  const centerTiles = readPoint(value.centerTiles, "arena.centerTiles");
  const radiusTiles = finiteNumber(value.radiusTiles, "arena.radiusTiles");
  if (radiusTiles <= 0)
    reject("arena.radiusTiles", "must be a positive number of tiles");
  return Object.freeze({ centerTiles, radiusTiles });
}

function outlineSpan(
  outline: readonly Vector2[],
  axis: "x" | "y",
): number {
  return (
    Math.max(...outline.map((vertex) => vertex[axis])) -
    Math.min(...outline.map((vertex) => vertex[axis]))
  );
}

export function validateOutline(
  value: unknown,
  name: string,
): readonly Vector2[] {
  const path = `shapes.${name}`;
  if (!Array.isArray(value)) reject(path, "must be an array of vertices");
  if (
    value.length < minimumOutlineVertices ||
    value.length > maximumOutlineVertices
  )
    reject(path, "must have 3 to 8 ordered vertices");
  const outline = value.map((vertex, index) =>
    readPoint(vertex, `${path}[${index}]`),
  );
  for (const axis of ["x", "y"] as const) {
    if (outlineSpan(outline, axis) !== normalizedOutlineSpanTiles)
      reject(path, `must span exactly 1 tile on ${axis} before scaling`);
  }
  return Object.freeze(outline);
}

function validateShapes(value: unknown): Readonly<
  Record<string, readonly Vector2[]>
> {
  if (!isRecord(value)) reject("shapes", "must be an object");
  const shapes = isRecord(value.shapes) ? value.shapes : undefined;
  if (!shapes) reject("shapes.shapes", "must be an object of named outlines");
  const names = Object.keys(shapes);
  if (names.length === 0) reject("shapes", "must define at least one outline");
  return Object.freeze(
    Object.fromEntries(
      names.map((name) => [name, validateOutline(shapes[name], name)]),
    ),
  );
}

export const AUTHORED_ARENA = validateArena(arenaData);
export const AUTHORED_SHAPES = validateShapes(shapesData);

export function loadOutline(name: string): readonly Vector2[] {
  const outline = AUTHORED_SHAPES[name];
  if (!outline) reject(`shapes.${name}`, "is not a defined outline");
  return outline;
}

export type AuthoredBody = Readonly<{
  shape: string;
  widthTiles: number;
  heightTiles: number;
}>;

function positiveNumber(value: unknown, path: string): number {
  const number = finiteNumber(value, path);
  if (number <= 0) reject(path, "must be positive");
  return number;
}

function nonnegativeNumber(value: unknown, path: string): number {
  const number = finiteNumber(value, path);
  if (number < 0) reject(path, "must be nonnegative");
  return number;
}

function safeCount(value: unknown, path: string): number {
  const number = positiveNumber(value, path);
  if (!Number.isSafeInteger(number)) reject(path, "must be a safe integer");
  return number;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") reject(path, "must be a boolean");
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    reject(path, "must be a nonempty string");
  return value;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) reject(path, "must be an object");
  return value;
}

export function validateBody(value: unknown, path: string): AuthoredBody {
  const body = record(value, path);
  const shape = text(body.shape, `${path}.shape`);
  loadOutline(shape);
  return Object.freeze({
    shape,
    widthTiles: positiveNumber(body.widthTiles, `${path}.widthTiles`),
    heightTiles: positiveNumber(body.heightTiles, `${path}.heightTiles`),
  });
}

export type AuthoredArchetype = Readonly<{
  id: string;
  spawnTiles: Vector2;
  body: AuthoredBody;
  speedTilesPerSecond: number;
  contactDamageHp: number;
  blocksPlayer: boolean;
  weapon: Readonly<{
    emitters: Readonly<{
      count: number;
      radiusTiles: number;
      initialPhaseDegrees: number;
      clockwiseDegreesPerSecond: number;
      rotateDuringCooldown: boolean;
    }>;
    burst: Readonly<{
      shotsPerEmitter: number;
      shotIntervalSeconds: number;
      cooldownAfterLastShotSeconds: number;
      initialCooldownSeconds: number;
    }>;
    shard: Readonly<{
      damageHp: number;
      speedTilesPerSecond: number;
      body: AuthoredBody;
      reversalAgeSeconds: number;
      lifetimeSeconds: number;
      expiration: string;
      hitPolicy: string;
    }>;
  }>;
}>;

function validateArchetype(value: unknown, id: string): AuthoredArchetype {
  const path = `enemies.archetypes.${id}`;
  const archetype = record(value, path);
  const weapon = record(archetype.weapon, `${path}.weapon`);
  const emitters = record(weapon.emitters, `${path}.weapon.emitters`);
  const burst = record(weapon.burst, `${path}.weapon.burst`);
  const shard = record(weapon.shard, `${path}.weapon.shard`);
  const reversalAgeSeconds = positiveNumber(
    shard.reversalAgeSeconds,
    `${path}.weapon.shard.reversalAgeSeconds`,
  );
  const lifetimeSeconds = positiveNumber(
    shard.lifetimeSeconds,
    `${path}.weapon.shard.lifetimeSeconds`,
  );
  if (reversalAgeSeconds >= lifetimeSeconds)
    reject(
      `${path}.weapon.shard.reversalAgeSeconds`,
      "must be strictly inside the shard lifetime",
    );
  return Object.freeze({
    id,
    spawnTiles: readPoint(archetype.spawnTiles, `${path}.spawnTiles`),
    body: validateBody(archetype.body, `${path}.body`),
    speedTilesPerSecond: positiveNumber(
      archetype.speedTilesPerSecond,
      `${path}.speedTilesPerSecond`,
    ),
    contactDamageHp: nonnegativeNumber(
      archetype.contactDamageHp,
      `${path}.contactDamageHp`,
    ),
    blocksPlayer: boolean(archetype.blocksPlayer, `${path}.blocksPlayer`),
    weapon: Object.freeze({
      emitters: Object.freeze({
        count: safeCount(emitters.count, `${path}.weapon.emitters.count`),
        radiusTiles: nonnegativeNumber(
          emitters.radiusTiles,
          `${path}.weapon.emitters.radiusTiles`,
        ),
        initialPhaseDegrees: finiteNumber(
          emitters.initialPhaseDegrees,
          `${path}.weapon.emitters.initialPhaseDegrees`,
        ),
        clockwiseDegreesPerSecond: finiteNumber(
          emitters.clockwiseDegreesPerSecond,
          `${path}.weapon.emitters.clockwiseDegreesPerSecond`,
        ),
        rotateDuringCooldown: boolean(
          emitters.rotateDuringCooldown,
          `${path}.weapon.emitters.rotateDuringCooldown`,
        ),
      }),
      burst: Object.freeze({
        shotsPerEmitter: safeCount(
          burst.shotsPerEmitter,
          `${path}.weapon.burst.shotsPerEmitter`,
        ),
        shotIntervalSeconds: positiveNumber(
          burst.shotIntervalSeconds,
          `${path}.weapon.burst.shotIntervalSeconds`,
        ),
        cooldownAfterLastShotSeconds: positiveNumber(
          burst.cooldownAfterLastShotSeconds,
          `${path}.weapon.burst.cooldownAfterLastShotSeconds`,
        ),
        initialCooldownSeconds: positiveNumber(
          burst.initialCooldownSeconds,
          `${path}.weapon.burst.initialCooldownSeconds`,
        ),
      }),
      shard: Object.freeze({
        damageHp: nonnegativeNumber(
          shard.damageHp,
          `${path}.weapon.shard.damageHp`,
        ),
        speedTilesPerSecond: positiveNumber(
          shard.speedTilesPerSecond,
          `${path}.weapon.shard.speedTilesPerSecond`,
        ),
        body: validateBody(shard.body, `${path}.weapon.shard.body`),
        reversalAgeSeconds,
        lifetimeSeconds,
        expiration: text(
          shard.expiration,
          `${path}.weapon.shard.expiration`,
        ),
        hitPolicy: text(shard.hitPolicy, `${path}.weapon.shard.hitPolicy`),
      }),
    }),
  });
}

export function validateArchetypes(
  value: unknown,
): Readonly<Record<string, AuthoredArchetype>> {
  const data = record(value, "enemies");
  const archetypes = record(data.archetypes, "enemies.archetypes");
  const ids = Object.keys(archetypes);
  if (ids.length === 0)
    reject("enemies.archetypes", "must define at least one archetype");
  return Object.freeze(
    Object.fromEntries(
      ids.map((id) => [id, validateArchetype(archetypes[id], id)]),
    ),
  );
}

export type AuthoredEncounter = Readonly<{
  rulesVersion: string;
  primaryArchetype: string;
  simulation: Readonly<{ fixedStepSeconds: number; maxStepsPerUpdate: number }>;
  player: Readonly<{ spawnTiles: Vector2; body: AuthoredBody }>;
  camera: Readonly<{
    cssPixelsPerTile: number;
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
  }>;
  session: Readonly<{
    startCountdownSeconds: number;
    retryCountdownSeconds: number;
    historyLimit: number;
  }>;
}>;

export function validateEncounterData(value: unknown): AuthoredEncounter {
  const data = record(value, "encounter");
  const simulation = record(data.simulation, "encounter.simulation");
  const player = record(data.player, "encounter.player");
  const camera = record(data.camera, "encounter.camera");
  const session = record(data.session, "encounter.session");
  const minZoom = positiveNumber(camera.minZoom, "encounter.camera.minZoom");
  const maxZoom = positiveNumber(camera.maxZoom, "encounter.camera.maxZoom");
  const defaultZoom = positiveNumber(
    camera.defaultZoom,
    "encounter.camera.defaultZoom",
  );
  if (minZoom > maxZoom || defaultZoom < minZoom || defaultZoom > maxZoom)
    reject("encounter.camera.defaultZoom", "must be within ordered zoom bounds");
  return Object.freeze({
    rulesVersion: text(data.rulesVersion, "encounter.rulesVersion"),
    primaryArchetype: text(
      data.primaryArchetype,
      "encounter.primaryArchetype",
    ),
    simulation: Object.freeze({
      fixedStepSeconds:
        1 / safeCount(simulation.fixedStepHz, "encounter.simulation.fixedStepHz"),
      maxStepsPerUpdate: safeCount(
        simulation.maxStepsPerUpdate,
        "encounter.simulation.maxStepsPerUpdate",
      ),
    }),
    player: Object.freeze({
      spawnTiles: readPoint(player.spawnTiles, "encounter.player.spawnTiles"),
      body: validateBody(player.body, "encounter.player.body"),
    }),
    camera: Object.freeze({
      cssPixelsPerTile: positiveNumber(
        camera.cssPixelsPerTile,
        "encounter.camera.cssPixelsPerTile",
      ),
      defaultZoom,
      minZoom,
      maxZoom,
      zoomStep: positiveNumber(camera.zoomStep, "encounter.camera.zoomStep"),
    }),
    session: Object.freeze({
      startCountdownSeconds: nonnegativeNumber(
        session.startCountdownSeconds,
        "encounter.session.startCountdownSeconds",
      ),
      retryCountdownSeconds: nonnegativeNumber(
        session.retryCountdownSeconds,
        "encounter.session.retryCountdownSeconds",
      ),
      historyLimit: safeCount(
        session.historyLimit,
        "encounter.session.historyLimit",
      ),
    }),
  });
}

export const AUTHORED_ARCHETYPES = validateArchetypes(enemiesData);
export const AUTHORED_ENCOUNTER = validateEncounterData(encounterData);

if (!AUTHORED_ARCHETYPES[AUTHORED_ENCOUNTER.primaryArchetype])
  reject(
    "encounter.primaryArchetype",
    "must name an archetype defined in enemies.json",
  );
