import type { CircularArena, Vector2 } from "../models";
import {
  CONDITION_KEYS,
  type ConditionApplication,
  type ConditionKey,
} from "../simulation/conditions";
import {
  firstArmCollisionDegrees,
  sectorWidthDegrees,
  totalCoverageDegrees,
} from "./sectors";
import { PALADIN_DERIVED_STATS } from "./stats";
import arenaData from "../data/arena.json";
import shapesData from "../data/shapes.json";
import enemiesData from "../data/enemies.json";
import encounterData from "../data/encounter.json";
import projectilesData from "../data/projectiles.json";

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

function safeNonnegativeCount(value: unknown, path: string): number {
  const number = nonnegativeNumber(value, path);
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

export type AuthoredProjectileMotion =
  | Readonly<{
      kind: "boomerang";
      reversalAgeSeconds: number;
      lifetimeSeconds: number;
    }>
  | Readonly<{ kind: "linear"; rangeTiles: number }>
  | Readonly<{
      kind: "turning";
      rangeTiles: number;
      turnRateDegreesPerSecond: number;
    }>
  | Readonly<{
      kind: "wavy";
      rangeTiles: number;
      amplitudeTiles: number;
      frequencyHz: number;
    }>
  | Readonly<{
      kind: "lob";
      travelSeconds: number;
      detonationRadiusTiles: number;
    }>;

/**
 * The maximum a curved path (`turning` or `wavy`) may deviate from the
 * straight chord the collision test sweeps between a step's exact start and
 * end positions. Validated per projectile at load time rather than assumed,
 * because the collision test is a swept straight segment per fixed step and
 * a curved path is not actually straight within a step (G: step 19.4). Both
 * the source's most extreme authored turn rate (±70 deg/s at 8 tiles/s) and
 * its wavy amplitude/frequency (0.8 tiles, 1 Hz) deviate by under a fifth of
 * this bound, so no sub-stepping is needed at the fixed 60 Hz step.
 */
export const MAXIMUM_PATH_DEVIATION_TILES = 0.02;

/** Sagitta of the circular arc traced in one fixed step, in tiles. */
export function turningDeviationTiles(
  speedTilesPerSecond: number,
  turnRateDegreesPerSecond: number,
  stepSeconds: number,
): number {
  const chordLengthTiles = speedTilesPerSecond * stepSeconds;
  const headingChangeRadians =
    ((turnRateDegreesPerSecond * Math.PI) / 180) * stepSeconds;
  return Math.abs((chordLengthTiles * headingChangeRadians) / 8);
}

/** Maximum lateral deviation of the wave from its chord in one fixed step. */
export function wavyDeviationTiles(
  amplitudeTiles: number,
  frequencyHz: number,
  stepSeconds: number,
): number {
  const angularFrequency = 2 * Math.PI * frequencyHz;
  const lateralAccelerationTilesPerSecondSquared =
    amplitudeTiles * angularFrequency * angularFrequency;
  return 0.5 * lateralAccelerationTilesPerSecondSquared * stepSeconds * stepSeconds;
}

export function validateConditions(
  value: unknown,
  path: string,
): readonly ConditionApplication[] {
  if (!Array.isArray(value)) reject(path, "must be an array");
  const seen = new Set<ConditionKey>();
  return Object.freeze(
    value.map((entry, index) => {
      const entryPath = `${path}[${index}]`;
      const condition = record(entry, entryPath);
      const keyText = text(condition.key, `${entryPath}.key`);
      if (!CONDITION_KEYS.includes(keyText as ConditionKey))
        reject(`${entryPath}.key`, "must be a defined condition");
      const key = keyText as ConditionKey;
      if (seen.has(key)) reject(`${entryPath}.key`, "must not be duplicated");
      seen.add(key);
      return Object.freeze({
        key,
        seconds: positiveNumber(condition.seconds, `${entryPath}.seconds`),
      });
    }),
  );
}

export type AuthoredProjectile = Readonly<{
  id: string;
  source: string;
  damageHp: number;
  speedTilesPerSecond: number;
  armorPiercing: boolean;
  conditions: readonly ConditionApplication[];
  body: AuthoredBody;
  expiration: string;
  hitPolicy: string;
  motion: AuthoredProjectileMotion;
}>;

const rangeDerivedKinds = ["linear", "turning", "wavy"] as const;

function rejectIfAuthored(
  motion: Record<string, unknown>,
  path: string,
  field: "reversalAgeSeconds" | "lifetimeSeconds",
  kindLabel: string,
): void {
  if (field in motion)
    reject(`${path}.${field}`, `must not be authored on a ${kindLabel} projectile`);
}

function validateProjectileMotion(
  value: unknown,
  path: string,
): AuthoredProjectileMotion {
  const motion = record(value, path);
  if (motion.kind === "boomerang") {
    const reversalAgeSeconds = positiveNumber(
      motion.reversalAgeSeconds,
      `${path}.reversalAgeSeconds`,
    );
    const lifetimeSeconds = positiveNumber(
      motion.lifetimeSeconds,
      `${path}.lifetimeSeconds`,
    );
    if (reversalAgeSeconds >= lifetimeSeconds)
      reject(
        `${path}.reversalAgeSeconds`,
        "must be strictly inside the shard lifetime",
      );
    return Object.freeze({ kind: "boomerang", reversalAgeSeconds, lifetimeSeconds });
  }
  if (rangeDerivedKinds.includes(motion.kind as never)) {
    const kindLabel = motion.kind as (typeof rangeDerivedKinds)[number];
    rejectIfAuthored(motion, path, "reversalAgeSeconds", kindLabel);
    rejectIfAuthored(motion, path, "lifetimeSeconds", kindLabel);
    const rangeTiles = positiveNumber(motion.rangeTiles, `${path}.rangeTiles`);
    if (kindLabel === "linear") return Object.freeze({ kind: "linear", rangeTiles });
    if (kindLabel === "turning") {
      const turnRateDegreesPerSecond = finiteNumber(
        motion.turnRateDegreesPerSecond,
        `${path}.turnRateDegreesPerSecond`,
      );
      if (turnRateDegreesPerSecond === 0)
        reject(`${path}.turnRateDegreesPerSecond`, "must be nonzero");
      return Object.freeze({ kind: "turning", rangeTiles, turnRateDegreesPerSecond });
    }
    const amplitudeTiles = positiveNumber(
      motion.amplitudeTiles,
      `${path}.amplitudeTiles`,
    );
    const frequencyHz = positiveNumber(motion.frequencyHz, `${path}.frequencyHz`);
    return Object.freeze({ kind: "wavy", rangeTiles, amplitudeTiles, frequencyHz });
  }
  if (motion.kind === "lob") {
    rejectIfAuthored(motion, path, "reversalAgeSeconds", "lob");
    rejectIfAuthored(motion, path, "lifetimeSeconds", "lob");
    if ("rangeTiles" in motion)
      reject(`${path}.rangeTiles`, "must not be authored on a lob projectile");
    const travelSeconds = positiveNumber(
      motion.travelSeconds,
      `${path}.travelSeconds`,
    );
    const detonationRadiusTiles = positiveNumber(
      motion.detonationRadiusTiles,
      `${path}.detonationRadiusTiles`,
    );
    return Object.freeze({ kind: "lob", travelSeconds, detonationRadiusTiles });
  }
  reject(
    `${path}.kind`,
    'must be "boomerang", "linear", "turning", "wavy" or "lob"',
  );
}

/** A single catalog entry, validated in isolation so a test can pass a literal. */
export function validateProjectile(
  value: unknown,
  id: string,
  stepSeconds: number,
): AuthoredProjectile {
  const path = `projectiles.projectiles.${id}`;
  const projectile = record(value, path);
  const motion = validateProjectileMotion(projectile.motion, `${path}.motion`);
  const speedTilesPerSecond = positiveNumber(
    projectile.speedTilesPerSecond,
    `${path}.speedTilesPerSecond`,
  );
  if (motion.kind === "turning") {
    const deviationTiles = turningDeviationTiles(
      speedTilesPerSecond,
      motion.turnRateDegreesPerSecond,
      stepSeconds,
    );
    if (deviationTiles > MAXIMUM_PATH_DEVIATION_TILES)
      reject(
        `${path}.motion.turnRateDegreesPerSecond`,
        `would deviate ${deviationTiles} tiles from its chord per step, over the ${MAXIMUM_PATH_DEVIATION_TILES}-tile bound`,
      );
  }
  if (motion.kind === "wavy") {
    const deviationTiles = wavyDeviationTiles(
      motion.amplitudeTiles,
      motion.frequencyHz,
      stepSeconds,
    );
    if (deviationTiles > MAXIMUM_PATH_DEVIATION_TILES)
      reject(
        `${path}.motion.amplitudeTiles`,
        `would deviate ${deviationTiles} tiles from its chord per step, over the ${MAXIMUM_PATH_DEVIATION_TILES}-tile bound`,
      );
  }
  return Object.freeze({
    id,
    source: text(projectile.source, `${path}.source`),
    damageHp: nonnegativeNumber(projectile.damageHp, `${path}.damageHp`),
    speedTilesPerSecond,
    armorPiercing: boolean(
      projectile.armorPiercing,
      `${path}.armorPiercing`,
    ),
    conditions: validateConditions(projectile.conditions, `${path}.conditions`),
    body: validateBody(projectile.body, `${path}.body`),
    expiration: text(projectile.expiration, `${path}.expiration`),
    hitPolicy: text(projectile.hitPolicy, `${path}.hitPolicy`),
    motion,
  });
}

export function validateProjectiles(
  value: unknown,
  stepSeconds: number,
): Readonly<Record<string, AuthoredProjectile>> {
  const data = record(value, "projectiles");
  const projectiles = record(data.projectiles, "projectiles.projectiles");
  const ids = Object.keys(projectiles);
  if (ids.length === 0)
    reject("projectiles.projectiles", "must define at least one projectile");
  return Object.freeze(
    Object.fromEntries(
      ids.map((id) => [id, validateProjectile(projectiles[id], id, stepSeconds)]),
    ),
  );
}

export type AuthoredRingPattern = Readonly<{
  kind: "ring";
  arms: number;
  emitterRadiusTiles: number;
  initialPhaseDegrees: number;
  clockwiseDegreesPerSecond: number;
  perBurstAdvanceDegrees?: number;
  gapSectorsDegrees?: readonly (readonly [number, number])[];
  armSpreadDegreesPerSecond?: number;
  maxArmSpreadDegrees?: number;
}>;

export type AuthoredSpreadPattern =
  | Readonly<{
      kind: "spread";
      shots: number;
      arcDegrees: number;
      aim: "player";
      emitterRadiusTiles: number;
    }>
  | Readonly<{
      kind: "spread";
      shots: number;
      arcDegrees: number;
      aim: "fixed";
      fixedBearingDegrees: number;
      emitterRadiusTiles: number;
    }>;

export type AuthoredScatterPattern =
  | Readonly<{
      kind: "scatter";
      shots: number;
      coneDegrees: number;
      aim: "player";
      emitterRadiusTiles: number;
    }>
  | Readonly<{
      kind: "scatter";
      shots: number;
      coneDegrees: number;
      aim: "fixed";
      fixedBearingDegrees: number;
      emitterRadiusTiles: number;
    }>;

export type AuthoredAttackPattern =
  | AuthoredRingPattern
  | AuthoredSpreadPattern
  | AuthoredScatterPattern;

export type AuthoredAttackCadence = Readonly<{
  shotsPerBurst: number;
  shotIntervalSeconds: number;
  cooldownAfterLastShotSeconds: number;
  initialDelaySeconds: number;
}>;

const validTuningSources = [
  "approved-v3",
  "wiki-prose",
  "trainer-authored",
] as const;

export type AuthoredAttack = Readonly<{
  id: string;
  projectile: string;
  tuningSource: (typeof validTuningSources)[number];
  pattern: AuthoredAttackPattern;
  cadence: AuthoredAttackCadence;
}>;

/** Validates the shared `aim`/`fixedBearingDegrees` pair for `spread`/`scatter`. */
function validateAim(
  pattern: Record<string, unknown>,
  path: string,
):
  | Readonly<{ aim: "player" }>
  | Readonly<{ aim: "fixed"; fixedBearingDegrees: number }> {
  if (pattern.aim === "fixed") {
    return {
      aim: "fixed",
      fixedBearingDegrees: finiteNumber(
        pattern.fixedBearingDegrees,
        `${path}.fixedBearingDegrees`,
      ),
    };
  }
  if (pattern.aim === "player") {
    if ("fixedBearingDegrees" in pattern)
      reject(
        `${path}.fixedBearingDegrees`,
        "must not be authored when aim is player",
      );
    return { aim: "player" };
  }
  reject(`${path}.aim`, 'must be "player" or "fixed"');
}

/** Validates and copies the optional ring extensions, omitting absent ones. */
function validateRingOptions(
  pattern: Record<string, unknown>,
  arms: number,
  path: string,
): Pick<
  AuthoredRingPattern,
  | "perBurstAdvanceDegrees"
  | "gapSectorsDegrees"
  | "armSpreadDegreesPerSecond"
  | "maxArmSpreadDegrees"
> {
  const options: {
    perBurstAdvanceDegrees?: number;
    gapSectorsDegrees?: readonly (readonly [number, number])[];
    armSpreadDegreesPerSecond?: number;
    maxArmSpreadDegrees?: number;
  } = {};

  if ("perBurstAdvanceDegrees" in pattern)
    options.perBurstAdvanceDegrees = finiteNumber(
      pattern.perBurstAdvanceDegrees,
      `${path}.perBurstAdvanceDegrees`,
    );

  if ("gapSectorsDegrees" in pattern) {
    const raw = pattern.gapSectorsDegrees;
    if (!Array.isArray(raw))
      reject(
        `${path}.gapSectorsDegrees`,
        "must be an array of [fromDegrees, toDegrees] pairs",
      );
    const sectors = raw.map((sector, index) => {
      const sectorPath = `${path}.gapSectorsDegrees[${index}]`;
      if (!Array.isArray(sector) || sector.length !== 2)
        reject(
          sectorPath,
          "must be a two-element [fromDegrees, toDegrees] pair",
        );
      const fromDegrees = finiteNumber(sector[0], `${sectorPath}[0]`);
      const toDegrees = finiteNumber(sector[1], `${sectorPath}[1]`);
      if (sectorWidthDegrees(fromDegrees, toDegrees) >= 360)
        reject(sectorPath, "must be narrower than 360 degrees");
      return [fromDegrees, toDegrees] as const;
    });
    if (totalCoverageDegrees(sectors) >= 360)
      reject(
        `${path}.gapSectorsDegrees`,
        "must leave at least some of the circle un-gapped",
      );
    options.gapSectorsDegrees = Object.freeze(sectors);
  }

  const rate = "armSpreadDegreesPerSecond" in pattern
    ? finiteNumber(
        pattern.armSpreadDegreesPerSecond,
        `${path}.armSpreadDegreesPerSecond`,
      )
    : undefined;
  const maximum = "maxArmSpreadDegrees" in pattern
    ? finiteNumber(
        pattern.maxArmSpreadDegrees,
        `${path}.maxArmSpreadDegrees`,
      )
    : undefined;
  if (maximum !== undefined && maximum < 0)
    reject(`${path}.maxArmSpreadDegrees`, "must be nonnegative");
  if (rate !== undefined && rate !== 0 && maximum === undefined)
    reject(
      `${path}.maxArmSpreadDegrees`,
      "must be present when armSpreadDegreesPerSecond is nonzero",
    );
  if (maximum !== undefined && arms > 1 && maximum >= firstArmCollisionDegrees(arms))
    reject(
      `${path}.maxArmSpreadDegrees`,
      "must stay below the first spread that makes two arms share a bearing",
    );
  if (rate !== undefined) options.armSpreadDegreesPerSecond = rate;
  if (maximum !== undefined) options.maxArmSpreadDegrees = maximum;

  return options;
}

function validateAttackPattern(
  value: unknown,
  path: string,
): AuthoredAttackPattern {
  const pattern = record(value, path);
  if (pattern.kind === "ring") {
    const arms = safeCount(pattern.arms, `${path}.arms`);
    return Object.freeze({
      kind: "ring",
      arms,
      emitterRadiusTiles: nonnegativeNumber(
        pattern.emitterRadiusTiles,
        `${path}.emitterRadiusTiles`,
      ),
      initialPhaseDegrees: finiteNumber(
        pattern.initialPhaseDegrees,
        `${path}.initialPhaseDegrees`,
      ),
      clockwiseDegreesPerSecond: finiteNumber(
        pattern.clockwiseDegreesPerSecond,
        `${path}.clockwiseDegreesPerSecond`,
      ),
      ...validateRingOptions(pattern, arms, path),
    });
  }
  if (pattern.kind === "spread") {
    const shots = safeCount(pattern.shots, `${path}.shots`);
    const arcDegrees = nonnegativeNumber(
      pattern.arcDegrees,
      `${path}.arcDegrees`,
    );
    if (arcDegrees >= 360)
      reject(
        `${path}.arcDegrees`,
        "must be below 360 degrees; a full circle is a ring, not a spread",
      );
    const emitterRadiusTiles = nonnegativeNumber(
      pattern.emitterRadiusTiles,
      `${path}.emitterRadiusTiles`,
    );
    return Object.freeze({
      kind: "spread",
      shots,
      arcDegrees,
      emitterRadiusTiles,
      ...validateAim(pattern, path),
    });
  }
  if (pattern.kind === "scatter") {
    const shots = safeCount(pattern.shots, `${path}.shots`);
    const coneDegrees = positiveNumber(
      pattern.coneDegrees,
      `${path}.coneDegrees`,
    );
    if (coneDegrees > 360)
      reject(`${path}.coneDegrees`, "must be at most 360 degrees");
    const emitterRadiusTiles = nonnegativeNumber(
      pattern.emitterRadiusTiles,
      `${path}.emitterRadiusTiles`,
    );
    return Object.freeze({
      kind: "scatter",
      shots,
      coneDegrees,
      emitterRadiusTiles,
      ...validateAim(pattern, path),
    });
  }
  reject(`${path}.kind`, 'must be "ring", "spread" or "scatter"');
}

function validateAttackCadence(
  value: unknown,
  path: string,
): AuthoredAttackCadence {
  const cadence = record(value, path);
  return Object.freeze({
    shotsPerBurst: safeCount(cadence.shotsPerBurst, `${path}.shotsPerBurst`),
    shotIntervalSeconds: positiveNumber(
      cadence.shotIntervalSeconds,
      `${path}.shotIntervalSeconds`,
    ),
    cooldownAfterLastShotSeconds: positiveNumber(
      cadence.cooldownAfterLastShotSeconds,
      `${path}.cooldownAfterLastShotSeconds`,
    ),
    initialDelaySeconds: nonnegativeNumber(
      cadence.initialDelaySeconds,
      `${path}.initialDelaySeconds`,
    ),
  });
}

export function validateAttack(
  value: unknown,
  path: string,
  projectileIds: ReadonlySet<string>,
  seenIds: Set<string>,
): AuthoredAttack {
  const attack = record(value, path);
  const id = text(attack.id, `${path}.id`);
  if (seenIds.has(id)) reject(`${path}.id`, "must be unique within the archetype");
  seenIds.add(id);
  const projectile = text(attack.projectile, `${path}.projectile`);
  if (!projectileIds.has(projectile))
    reject(
      `${path}.projectile`,
      "must name a projectile defined in projectiles.json",
    );
  if (!validTuningSources.includes(attack.tuningSource as never))
    reject(
      `${path}.tuningSource`,
      'must be "approved-v3", "wiki-prose" or "trainer-authored"',
    );
  return Object.freeze({
    id,
    projectile,
    tuningSource: attack.tuningSource as (typeof validTuningSources)[number],
    pattern: validateAttackPattern(attack.pattern, `${path}.pattern`),
    cadence: validateAttackCadence(attack.cadence, `${path}.cadence`),
  });
}

export type AuthoredMovement =
  | Readonly<{ kind: "chase"; speedTilesPerSecond: number }>
  | Readonly<{ kind: "stationary" }>
  | Readonly<{
      kind: "move-to-point";
      target: "arena-center";
      speedTilesPerSecond: number;
    }>
  | Readonly<{
      kind: "orbit";
      radiusTiles: number;
      degreesPerSecond: number;
      direction: "cw" | "ccw";
      approachSpeedTilesPerSecond: number;
    }>
  | Readonly<{
      kind: "wander";
      speedTilesPerSecond: number;
      retargetSeconds: number;
      radiusTiles: number;
    }>;

const degreesToRadiansLocal = (degrees: number): number =>
  (degrees * Math.PI) / 180;

export function validateMovement(value: unknown, path: string): AuthoredMovement {
  const movement = record(value, path);
  if (movement.kind === "chase") {
    return Object.freeze({
      kind: "chase",
      speedTilesPerSecond: positiveNumber(
        movement.speedTilesPerSecond,
        `${path}.speedTilesPerSecond`,
      ),
    });
  }
  if (movement.kind === "stationary") return Object.freeze({ kind: "stationary" });
  if (movement.kind === "move-to-point") {
    if (movement.target !== "arena-center")
      reject(`${path}.target`, 'must be "arena-center"');
    return Object.freeze({
      kind: "move-to-point",
      target: "arena-center",
      speedTilesPerSecond: positiveNumber(
        movement.speedTilesPerSecond,
        `${path}.speedTilesPerSecond`,
      ),
    });
  }
  if (movement.kind === "orbit") {
    const radiusTiles = positiveNumber(movement.radiusTiles, `${path}.radiusTiles`);
    const degreesPerSecond = positiveNumber(
      movement.degreesPerSecond,
      `${path}.degreesPerSecond`,
    );
    const approachSpeedTilesPerSecond = positiveNumber(
      movement.approachSpeedTilesPerSecond,
      `${path}.approachSpeedTilesPerSecond`,
    );
    if (movement.direction !== "cw" && movement.direction !== "ccw")
      reject(`${path}.direction`, 'must be "cw" or "ccw"');
    const tangentialSpeedTilesPerSecond =
      radiusTiles * degreesToRadiansLocal(degreesPerSecond);
    if (
      tangentialSpeedTilesPerSecond >= PALADIN_DERIVED_STATS.speedTilesPerSecond
    )
      reject(
        `${path}`,
        "orbit tangential speed must stay below the Paladin's",
      );
    return Object.freeze({
      kind: "orbit",
      radiusTiles,
      degreesPerSecond,
      direction: movement.direction,
      approachSpeedTilesPerSecond,
    });
  }
  if (movement.kind === "wander") {
    return Object.freeze({
      kind: "wander",
      speedTilesPerSecond: positiveNumber(
        movement.speedTilesPerSecond,
        `${path}.speedTilesPerSecond`,
      ),
      retargetSeconds: positiveNumber(
        movement.retargetSeconds,
        `${path}.retargetSeconds`,
      ),
      radiusTiles: positiveNumber(movement.radiusTiles, `${path}.radiusTiles`),
    });
  }
  reject(
    `${path}.kind`,
    'must be "chase", "stationary", "move-to-point", "orbit" or "wander"',
  );
}

export type AuthoredProgression =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "simulated-dps"; hpPerSecond: number }>;

export type AuthoredHealth = Readonly<{
  maxHealthHp: number;
  progression: AuthoredProgression;
}>;

export function validateProgression(
  value: unknown,
  path: string,
): AuthoredProgression {
  const progression = record(value, path);
  if (progression.kind === "none") return Object.freeze({ kind: "none" });
  if (progression.kind === "simulated-dps") {
    return Object.freeze({
      kind: "simulated-dps",
      hpPerSecond: positiveNumber(
        progression.hpPerSecond,
        `${path}.hpPerSecond`,
      ),
    });
  }
  reject(`${path}.kind`, 'must be "none" or "simulated-dps"');
}

function validateHealth(value: unknown, path: string): AuthoredHealth {
  const health = record(value, path);
  return Object.freeze({
    maxHealthHp: positiveNumber(health.maxHealthHp, `${path}.maxHealthHp`),
    progression: validateProgression(health.progression, `${path}.progression`),
  });
}

/** Names resolved against the presentation layer's own palette (Phaser owns the hex values). */
export const TELEGRAPH_COLOR_NAMES = [
  "white",
  "amber",
  "red",
  "violet",
  "cyan",
] as const;

export type TelegraphColorName = (typeof TELEGRAPH_COLOR_NAMES)[number];

function validateTelegraphColor(value: unknown, path: string): TelegraphColorName {
  const name = text(value, path);
  if (!TELEGRAPH_COLOR_NAMES.includes(name as TelegraphColorName))
    reject(path, `must be one of ${TELEGRAPH_COLOR_NAMES.join(", ")}`);
  return name as TelegraphColorName;
}

export type AuthoredSubPhase = Readonly<{
  id: string;
  durationSeconds: number;
  telegraphSeconds: number;
  invulnerableOnEnterSeconds: number;
  /** `null` means the phase's own movement continues for this sub-phase. */
  movement: AuthoredMovement | null;
  attacks: readonly AuthoredAttack[];
  spawns: readonly AuthoredPhaseSpawn[] | null;
}>;

function validateSubPhase(
  value: unknown,
  path: string,
  projectileIds: ReadonlySet<string>,
  seenAttackIds: Set<string>,
  maxConcurrentMinions: number,
): AuthoredSubPhase {
  const subPhase = record(value, path);
  if (!Array.isArray(subPhase.attacks))
    reject(`${path}.attacks`, "must be an array of attacks");
  if (subPhase.attacks.length === 0)
    reject(`${path}.attacks`, "must define at least one attack");
  return Object.freeze({
    id: text(subPhase.id, `${path}.id`),
    durationSeconds: positiveNumber(
      subPhase.durationSeconds,
      `${path}.durationSeconds`,
    ),
    telegraphSeconds: nonnegativeNumber(
      subPhase.telegraphSeconds,
      `${path}.telegraphSeconds`,
    ),
    invulnerableOnEnterSeconds: nonnegativeNumber(
      subPhase.invulnerableOnEnterSeconds,
      `${path}.invulnerableOnEnterSeconds`,
    ),
    movement:
      subPhase.movement === undefined || subPhase.movement === null
        ? null
        : validateMovement(subPhase.movement, `${path}.movement`),
    attacks: Object.freeze(
      subPhase.attacks.map((attack, index) =>
        validateAttack(
          attack,
          `${path}.attacks[${index}]`,
          projectileIds,
          seenAttackIds,
        ),
      ),
    ),
    spawns: validatePhaseSpawns(
      subPhase.spawns,
      `${path}.spawns`,
      maxConcurrentMinions,
    ),
  });
}

function validateSubPhases(
  value: unknown,
  path: string,
  projectileIds: ReadonlySet<string>,
  seenAttackIds: Set<string>,
  maxConcurrentMinions: number,
): readonly AuthoredSubPhase[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) reject(path, "must be an array of sub-phases");
  if (value.length === 0) reject(path, "must define at least one sub-phase");
  return Object.freeze(
    value.map((subPhase, index) =>
      validateSubPhase(
        subPhase,
        `${path}[${index}]`,
        projectileIds,
        seenAttackIds,
        maxConcurrentMinions,
      ),
    ),
  );
}

export type AuthoredSpawnPlacement =
  | Readonly<{ kind: "ring-around-owner"; radiusTiles: number }>
  | Readonly<{ kind: "arena-ring"; ringRadiusFraction: number }>;

function validateSpawnPlacement(
  value: unknown,
  path: string,
): AuthoredSpawnPlacement {
  const placement = record(value, path);
  if (placement.kind === "ring-around-owner") {
    return Object.freeze({
      kind: "ring-around-owner",
      radiusTiles: positiveNumber(
        placement.radiusTiles,
        `${path}.radiusTiles`,
      ),
    });
  }
  if (placement.kind === "arena-ring") {
    const ringRadiusFraction = positiveNumber(
      placement.ringRadiusFraction,
      `${path}.ringRadiusFraction`,
    );
    if (ringRadiusFraction >= 1)
      reject(`${path}.ringRadiusFraction`, "must be inside the arena, below 1");
    return Object.freeze({ kind: "arena-ring", ringRadiusFraction });
  }
  reject(`${path}.kind`, 'must be "ring-around-owner" or "arena-ring"');
}

export type AuthoredPhaseSpawn = Readonly<{
  archetype: string;
  count: number;
  despawnOnExit: boolean;
  startPhaseIndex: number;
  placement: AuthoredSpawnPlacement;
}>;

function validatePhaseSpawn(
  value: unknown,
  path: string,
  maxConcurrentMinions: number,
): AuthoredPhaseSpawn {
  const spawn = record(value, path);
  const count = safeCount(spawn.count, `${path}.count`);
  if (count > maxConcurrentMinions)
    reject(`${path}.count`, "must not exceed encounter.maxConcurrentMinions");
  return Object.freeze({
    archetype: text(spawn.archetype, `${path}.archetype`),
    count,
    despawnOnExit: boolean(spawn.despawnOnExit, `${path}.despawnOnExit`),
    startPhaseIndex:
      spawn.startPhaseIndex === undefined
        ? 0
        : safeNonnegativeCount(spawn.startPhaseIndex, `${path}.startPhaseIndex`),
    placement: validateSpawnPlacement(spawn.placement, `${path}.placement`),
  });
}

function validatePhaseSpawns(
  value: unknown,
  path: string,
  maxConcurrentMinions: number,
): readonly AuthoredPhaseSpawn[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) reject(path, "must be an array of spawns");
  if (value.length === 0) reject(path, "must define at least one spawn");
  return Object.freeze(
    value.map((spawn, index) =>
      validatePhaseSpawn(spawn, `${path}[${index}]`, maxConcurrentMinions),
    ),
  );
}

export type AuthoredPhase = Readonly<{
  id: string;
  enterAtHpFraction: number;
  exitAfterSeconds: number | null;
  telegraphSeconds: number;
  invulnerableOnEnterSeconds: number;
  telegraphColor: TelegraphColorName;
  movement: AuthoredMovement;
  progression: AuthoredProgression | null;
  attacks: readonly AuthoredAttack[];
  subPhases: readonly AuthoredSubPhase[] | null;
  spawns: readonly AuthoredPhaseSpawn[] | null;
}>;

function validatePhase(
  value: unknown,
  path: string,
  projectileIds: ReadonlySet<string>,
  maxConcurrentMinions: number,
): AuthoredPhase {
  const phase = record(value, path);
  if (!Array.isArray(phase.attacks))
    reject(`${path}.attacks`, "must be an array of attacks");
  if (phase.attacks.length === 0)
    reject(`${path}.attacks`, "must define at least one attack");
  const enterAtHpFraction = finiteNumber(
    phase.enterAtHpFraction,
    `${path}.enterAtHpFraction`,
  );
  if (enterAtHpFraction <= 0 || enterAtHpFraction > 1)
    reject(`${path}.enterAtHpFraction`, "must be in the range (0, 1]");
  const exitAfterSeconds =
    phase.exitAfterSeconds === null
      ? null
      : positiveNumber(phase.exitAfterSeconds, `${path}.exitAfterSeconds`);
  const seenAttackIds = new Set<string>();
  return Object.freeze({
    id: text(phase.id, `${path}.id`),
    enterAtHpFraction,
    exitAfterSeconds,
    telegraphSeconds: nonnegativeNumber(
      phase.telegraphSeconds,
      `${path}.telegraphSeconds`,
    ),
    invulnerableOnEnterSeconds: nonnegativeNumber(
      phase.invulnerableOnEnterSeconds,
      `${path}.invulnerableOnEnterSeconds`,
    ),
    telegraphColor: validateTelegraphColor(
      phase.telegraphColor,
      `${path}.telegraphColor`,
    ),
    movement: validateMovement(phase.movement, `${path}.movement`),
    progression:
      phase.progression === null
        ? null
        : validateProgression(phase.progression, `${path}.progression`),
    attacks: Object.freeze(
      phase.attacks.map((attack, index) =>
        validateAttack(
          attack,
          `${path}.attacks[${index}]`,
          projectileIds,
          seenAttackIds,
        ),
      ),
    ),
    subPhases: validateSubPhases(
      phase.subPhases,
      `${path}.subPhases`,
      projectileIds,
      seenAttackIds,
      maxConcurrentMinions,
    ),
    spawns: validatePhaseSpawns(
      phase.spawns,
      `${path}.spawns`,
      maxConcurrentMinions,
    ),
  });
}

/**
 * Phases are authored in strictly descending `enterAtHpFraction`, with the
 * first fixed at exactly 1 (K09). Rejects an empty array, a first fraction
 * other than 1, and an ascending or duplicated threshold.
 */
function validatePhases(
  value: unknown,
  path: string,
  projectileIds: ReadonlySet<string>,
  maxConcurrentMinions: number,
): readonly AuthoredPhase[] {
  if (!Array.isArray(value)) reject(path, "must be an array of phases");
  if (value.length === 0) reject(path, "must define at least one phase");
  const phases = value.map((phase, index) =>
    validatePhase(
      phase,
      `${path}[${index}]`,
      projectileIds,
      maxConcurrentMinions,
    ),
  );
  if (phases[0].enterAtHpFraction !== 1)
    reject(`${path}[0].enterAtHpFraction`, "must be exactly 1");
  for (let index = 1; index < phases.length; index++) {
    if (phases[index].enterAtHpFraction >= phases[index - 1].enterAtHpFraction)
      reject(
        `${path}[${index}].enterAtHpFraction`,
        "must be strictly less than the previous phase's",
      );
  }
  return Object.freeze(phases);
}

export type AuthoredArchetype = Readonly<{
  id: string;
  spawnTiles: Vector2;
  body: AuthoredBody;
  /** Omitted entirely by an archetype with no sourced hit-point total, e.g. the Crystal Worm. */
  health?: AuthoredHealth;
  contactDamageHp: number;
  contactConditions: readonly ConditionApplication[];
  contactArmorPiercing: boolean;
  /** Trainer-authored (K17): the source gives no contact rate. Unused while contactDamageHp is 0. */
  contactCooldownSeconds: number;
  blocksPlayer: boolean;
  phases: readonly AuthoredPhase[];
}>;

function validateArchetype(
  value: unknown,
  id: string,
  projectileIds: ReadonlySet<string>,
  maxConcurrentMinions: number,
): AuthoredArchetype {
  const path = `enemies.archetypes.${id}`;
  const archetype = record(value, path);
  return Object.freeze({
    id,
    spawnTiles: readPoint(archetype.spawnTiles, `${path}.spawnTiles`),
    body: validateBody(archetype.body, `${path}.body`),
    ...(archetype.health !== undefined
      ? { health: validateHealth(archetype.health, `${path}.health`) }
      : {}),
    contactDamageHp: nonnegativeNumber(
      archetype.contactDamageHp,
      `${path}.contactDamageHp`,
    ),
    contactConditions: validateConditions(
      archetype.contactConditions,
      `${path}.contactConditions`,
    ),
    contactArmorPiercing: boolean(
      archetype.contactArmorPiercing,
      `${path}.contactArmorPiercing`,
    ),
    contactCooldownSeconds: nonnegativeNumber(
      archetype.contactCooldownSeconds,
      `${path}.contactCooldownSeconds`,
    ),
    blocksPlayer: boolean(archetype.blocksPlayer, `${path}.blocksPlayer`),
    phases: validatePhases(
      archetype.phases,
      `${path}.phases`,
      projectileIds,
      maxConcurrentMinions,
    ),
  });
}

export function validateArchetypes(
  value: unknown,
  projectileIds: ReadonlySet<string>,
  maxConcurrentMinions: number,
): Readonly<Record<string, AuthoredArchetype>> {
  const data = record(value, "enemies");
  const archetypes = record(data.archetypes, "enemies.archetypes");
  const ids = Object.keys(archetypes);
  if (ids.length === 0)
    reject("enemies.archetypes", "must define at least one archetype");
  const built = Object.freeze(
    Object.fromEntries(
      ids.map((id) => [
        id,
        validateArchetype(archetypes[id], id, projectileIds, maxConcurrentMinions),
      ]),
    ),
  );
  for (const [id, archetype] of Object.entries(built)) {
    for (const [phaseIndex, phase] of archetype.phases.entries()) {
      for (const spawn of phase.spawns ?? []) {
        const spawned = built[spawn.archetype];
        if (!spawned)
          reject(
            `enemies.archetypes.${id}.phases[${phaseIndex}].spawns`,
            "archetype must name an archetype defined in enemies.json",
          );
        if (spawn.startPhaseIndex >= spawned.phases.length)
          reject(
            `enemies.archetypes.${id}.phases[${phaseIndex}].spawns`,
            "startPhaseIndex must be within the spawned archetype's phase count",
          );
      }
    }
  }
  return built;
}

export type AuthoredSpawns = Readonly<{
  archetype: string;
  firstSpawnSeconds: number;
  everySeconds: number;
  maxConcurrent: number;
  placement: Readonly<{
    ringRadiusFraction: number;
    rule: string;
    goldenAngleDegrees: number;
  }>;
}>;

export type AuthoredEncounter = Readonly<{
  rulesVersion: string;
  primaryArchetype: string;
  spawns: AuthoredSpawns;
  /** Caps phase/sub-phase-driven minions; a phase spawns fewer than its count rather than exceed it. */
  maxConcurrentMinions: number;
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
  presentation: Readonly<{ lobTelegraphSeconds: number }>;
}>;

export function validateEncounterData(value: unknown): AuthoredEncounter {
  const data = record(value, "encounter");
  const simulation = record(data.simulation, "encounter.simulation");
  const player = record(data.player, "encounter.player");
  const camera = record(data.camera, "encounter.camera");
  const session = record(data.session, "encounter.session");
  const presentation = record(data.presentation, "encounter.presentation");
  const minZoom = positiveNumber(camera.minZoom, "encounter.camera.minZoom");
  const maxZoom = positiveNumber(camera.maxZoom, "encounter.camera.maxZoom");
  const defaultZoom = positiveNumber(
    camera.defaultZoom,
    "encounter.camera.defaultZoom",
  );
  if (minZoom > maxZoom || defaultZoom < minZoom || defaultZoom > maxZoom)
    reject("encounter.camera.defaultZoom", "must be within ordered zoom bounds");
  const spawns = record(data.spawns, "encounter.spawns");
  const placement = record(spawns.placement, "encounter.spawns.placement");
  const ringRadiusFraction = positiveNumber(
    placement.ringRadiusFraction,
    "encounter.spawns.placement.ringRadiusFraction",
  );
  if (ringRadiusFraction >= 1)
    reject(
      "encounter.spawns.placement.ringRadiusFraction",
      "must be inside the arena, below 1",
    );
  if (placement.rule !== "farthest-from-player")
    reject(
      "encounter.spawns.placement.rule",
      "must be the approved farthest-from-player rule",
    );
  return Object.freeze({
    rulesVersion: text(data.rulesVersion, "encounter.rulesVersion"),
    spawns: Object.freeze({
      archetype: text(spawns.archetype, "encounter.spawns.archetype"),
      firstSpawnSeconds: nonnegativeNumber(
        spawns.firstSpawnSeconds,
        "encounter.spawns.firstSpawnSeconds",
      ),
      everySeconds: positiveNumber(
        spawns.everySeconds,
        "encounter.spawns.everySeconds",
      ),
      maxConcurrent: safeCount(
        spawns.maxConcurrent,
        "encounter.spawns.maxConcurrent",
      ),
      placement: Object.freeze({
        ringRadiusFraction,
        rule: text(placement.rule, "encounter.spawns.placement.rule"),
        goldenAngleDegrees: finiteNumber(
          placement.goldenAngleDegrees,
          "encounter.spawns.placement.goldenAngleDegrees",
        ),
      }),
    }),
    primaryArchetype: text(
      data.primaryArchetype,
      "encounter.primaryArchetype",
    ),
    maxConcurrentMinions: safeCount(
      data.maxConcurrentMinions,
      "encounter.maxConcurrentMinions",
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
    presentation: Object.freeze({
      lobTelegraphSeconds: positiveNumber(
        presentation.lobTelegraphSeconds,
        "encounter.presentation.lobTelegraphSeconds",
      ),
    }),
  });
}

export const AUTHORED_ENCOUNTER = validateEncounterData(encounterData);
export const AUTHORED_PROJECTILES = validateProjectiles(
  projectilesData,
  AUTHORED_ENCOUNTER.simulation.fixedStepSeconds,
);
export const AUTHORED_ARCHETYPES = validateArchetypes(
  enemiesData,
  new Set(Object.keys(AUTHORED_PROJECTILES)),
  AUTHORED_ENCOUNTER.maxConcurrentMinions,
);

if (!AUTHORED_ARCHETYPES[AUTHORED_ENCOUNTER.primaryArchetype])
  reject(
    "encounter.primaryArchetype",
    "must name an archetype defined in enemies.json",
  );

if (!AUTHORED_ARCHETYPES[AUTHORED_ENCOUNTER.spawns.archetype])
  reject(
    "encounter.spawns.archetype",
    "must name an archetype defined in enemies.json",
  );
