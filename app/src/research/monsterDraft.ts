/**
 * Pure monster helpers for the tagger (plan V18 phase 74, trimmed by
 * plan V20 steps 86.5 and 88.2): the monsters an encounter reaches, a
 * monster's blocks, the path of its file, and validated edits to one attack.
 * The monster file text now comes from `studyExport.ts`. No React, DOM,
 * storage or simulation here, and nothing is written anywhere (L02, L23).
 */
import { validateAttack, type AuthoredAttack } from "../game/config/data";
import {
  attackSpecFromAuthored,
  ENCOUNTER_CONFIGS,
  encounterConfigOf,
  validateAttackSpec,
  type EncounterConfig,
  type EnemyArchetype,
  type PhaseSpawnSpec,
} from "../game/config/encounter";
import { EXPORT_TUNING_SOURCE } from "./exportAttack";

export type DraftBlock = Readonly<{
  /** `phaseId`, or `phaseId/subPhaseId` for a sub-phase. */
  id: string;
  phaseId: string;
  subPhaseId: string | null;
  label: string;
  /** The sub-phase's telegraph, or the phase's when it has no sub-phases. */
  telegraphSeconds: number;
  /** `durationSeconds`, or `exitAfterSeconds`; null when neither is authored. */
  durationSeconds: number | null;
}>;

export type DraftResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: string }>;

const BLOCK_SEPARATOR = "/";

export function blockIdOf(phaseId: string, subPhaseId: string | null): string {
  return subPhaseId === null ? phaseId : `${phaseId}${BLOCK_SEPARATOR}${subPhaseId}`;
}

function fail<T>(error: string): DraftResult<T> {
  return { ok: false, error };
}

// ---- Monsters and blocks (74.1) -------------------------------------------

/** L05: the primary monster, then every monster reached by authored spawns. */
export function monstersOfEncounter(config: EncounterConfig): readonly string[] {
  const seen: string[] = [];
  const visit = (id: string) => {
    if (seen.includes(id)) return;
    seen.push(id);
    for (const phase of config.archetypes[id]?.phases ?? []) {
      const spawns: readonly PhaseSpawnSpec[] = [
        ...(phase.spawns ?? []),
        ...(phase.subPhases ?? []).flatMap((sub) => sub.spawns ?? []),
      ];
      for (const spawn of spawns) visit(spawn.archetypeId);
    }
  };
  visit(config.primaryArchetypeId);
  return seen;
}

const taggingConfigs = new Map<string, EncounterConfig>();

/**
 * The config the tagger works under: the encounter's own arena, player, tuning
 * and archetypes, plus every archetype and projectile any encounter defines,
 * so any monster can be tagged under any encounter, in its arena (user
 * decision 2026-11-17). The encounter's own entries win, so the Crystal Worm's
 * debug-tunable build keeps its values. The game never reads this config.
 */
export function taggingConfigOf(encounterId: string): EncounterConfig {
  const cached = taggingConfigs.get(encounterId);
  if (cached) return cached;
  const own = encounterConfigOf(encounterId);
  const others = Object.values(ENCOUNTER_CONFIGS);
  const config: EncounterConfig = Object.freeze({
    ...own,
    archetypes: Object.freeze(Object.assign({}, ...others.map((other) => other.archetypes), own.archetypes)),
    projectiles: Object.freeze(Object.assign({}, ...others.map((other) => other.projectiles), own.projectiles)),
  });
  taggingConfigs.set(encounterId, config);
  return config;
}

/** Every monster in `config`: the encounter's own (primary, then spawned) first, then the rest in authored order. */
export function taggableMonsters(config: EncounterConfig): readonly string[] {
  const own = monstersOfEncounter(config);
  return [...own, ...Object.keys(config.archetypes).filter((id) => !own.includes(id))];
}

/** L17, L18: one block per phase with no sub-phases, and one per sub-phase. */
export function blocksOfMonster(archetype: EnemyArchetype): readonly DraftBlock[] {
  return archetype.phases.flatMap((phase): DraftBlock[] => {
    if (phase.subPhases && phase.subPhases.length > 0)
      return phase.subPhases.map((sub) => ({
        id: blockIdOf(phase.id, sub.id),
        phaseId: phase.id,
        subPhaseId: sub.id,
        label: `${phase.id} / ${sub.id}`,
        telegraphSeconds: sub.telegraphSeconds,
        durationSeconds: sub.durationSeconds,
      }));
    return [
      {
        id: phase.id,
        phaseId: phase.id,
        subPhaseId: null,
        label: phase.id,
        telegraphSeconds: phase.telegraphSeconds,
        durationSeconds: phase.exitAfterSeconds,
      },
    ];
  });
}

/** L24: the repository-relative path of a monster's file. */
export function monsterFilePath(archetypeId: string): string {
  return `app/src/game/data/enemies/${archetypeId}.json`;
}

// ---- Editing attacks (74.2) -----------------------------------------------

/**
 * Input conveniences for a new attack, not observations (L10): a single
 * player-aimed shot every second.
 */
export const NEW_ATTACK_DEFAULTS = Object.freeze({
  pattern: Object.freeze({
    kind: "spread",
    shots: 1,
    arcDegrees: 0,
    aim: "player",
    emitterRadiusTiles: 0,
  }),
  cadence: Object.freeze({
    shotsPerBurst: 1,
    shotIntervalSeconds: 0.1,
    cooldownAfterLastShotSeconds: 1,
    initialDelaySeconds: 0,
  }),
});

/** Input conveniences for the fields a pattern-kind change has to add. */
const KIND_DEFAULTS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  ring: { arms: 4, emitterRadiusTiles: 0, initialPhaseDegrees: 0, clockwiseDegreesPerSecond: 0 },
  spread: { shots: 1, arcDegrees: 0, aim: "player", emitterRadiusTiles: 0 },
  scatter: { shots: 1, coneDegrees: 30, aim: "player", emitterRadiusTiles: 0 },
};

/** Fields each pattern kind owns; a kind change keeps the ones that still apply. */
const KIND_FIELDS: Readonly<Record<string, readonly string[]>> = {
  ring: [
    "kind", "arms", "emitterRadiusTiles", "initialPhaseDegrees", "clockwiseDegreesPerSecond",
    "perBurstAdvanceDegrees", "gapSectorsDegrees", "armSpreadDegreesPerSecond",
    "maxArmSpreadDegrees", "armPattern",
  ],
  spread: ["kind", "shots", "arcDegrees", "aim", "offsetDegrees", "fixedBearingDegrees", "emitterRadiusTiles"],
  scatter: ["kind", "shots", "coneDegrees", "aim", "offsetDegrees", "fixedBearingDegrees", "emitterRadiusTiles"],
};

export type AttackChange =
  | Readonly<{ field: "projectile"; value: string }>
  | Readonly<{ field: "target"; value: "player" | null }>
  | Readonly<{
      field: "cadence";
      key: keyof AuthoredAttack["cadence"];
      value: number;
    }>
  | Readonly<{ field: "patternKind"; value: "ring" | "spread" | "scatter" }>
  | Readonly<{ field: "aim"; value: "player" | "front" | "fixed" }>
  /** Any other pattern field; an undefined value removes it. */
  | Readonly<{ field: "pattern"; key: string; value: unknown }>;

/** Runs the game's own validators; returns their message unchanged on refusal. */
function validated(
  attack: AuthoredAttack,
  otherIds: readonly string[],
  config: EncounterConfig,
): DraftResult<AuthoredAttack> {
  try {
    const checked = validateAttack(
      attack,
      "attack",
      new Set(Object.keys(config.projectiles)),
      new Set(otherIds),
    );
    validateAttackSpec(config, attackSpecFromAuthored(checked));
    return { ok: true, value: attack };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
}

function applyChange(
  attack: AuthoredAttack,
  change: AttackChange,
): Readonly<{ attack: AuthoredAttack; removed: readonly string[] }> {
  const pattern = { ...attack.pattern } as Record<string, unknown>;
  let removed: string[] = [];
  const next: Record<string, unknown> = { ...attack };
  if (change.field === "projectile") next.projectile = change.value;
  else if (change.field === "target") {
    if (change.value === null) delete next.target;
    else next.target = change.value;
  } else if (change.field === "cadence")
    next.cadence = { ...attack.cadence, [change.key]: change.value };
  else if (change.field === "patternKind") {
    const keep = KIND_FIELDS[change.value];
    const rebuilt: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(pattern)) {
      if (key === "kind") continue;
      if (keep.includes(key)) rebuilt[key] = value;
      else removed.push(key);
    }
    if (change.value === pattern.kind) removed = [];
    next.pattern = { kind: change.value, ...KIND_DEFAULTS[change.value], ...rebuilt };
  } else if (change.field === "aim") {
    delete pattern.offsetDegrees;
    delete pattern.fixedBearingDegrees;
    pattern.aim = change.value;
    if (change.value === "front") pattern.offsetDegrees = 0;
    if (change.value === "fixed") pattern.fixedBearingDegrees = 0;
    next.pattern = pattern;
  } else {
    if (change.value === undefined) delete pattern[change.key];
    else pattern[change.key] = change.value;
    next.pattern = pattern;
  }
  next.tuningSource = EXPORT_TUNING_SOURCE;
  return { attack: next as AuthoredAttack, removed };
}

/** Plan V20 step 86.1: one change to one attack, validated against the other ids. */
export function changedAttack(
  current: AuthoredAttack,
  change: AttackChange,
  otherIds: readonly string[],
  config: EncounterConfig,
): DraftResult<Readonly<{ attack: AuthoredAttack; removed: readonly string[] }>> {
  const { attack, removed } = applyChange(current, change);
  const checked = validated(attack, otherIds, config);
  if (!checked.ok) return checked;
  return { ok: true, value: { attack: checked.value, removed } };
}

/** L10, L12: a convenience attack using the catalog's first projectile. */
export function newAttack(
  id: string,
  otherIds: readonly string[],
  config: EncounterConfig,
): DraftResult<AuthoredAttack> {
  const projectile = Object.keys(config.projectiles)[0];
  const attack = {
    id,
    projectile,
    tuningSource: EXPORT_TUNING_SOURCE,
    pattern: { ...NEW_ATTACK_DEFAULTS.pattern },
    cadence: { ...NEW_ATTACK_DEFAULTS.cadence },
  } as AuthoredAttack;
  return validated(attack, otherIds, config);
}
