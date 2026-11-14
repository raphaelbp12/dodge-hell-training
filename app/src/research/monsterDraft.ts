/**
 * Pure monster draft for the tagger (plan V18 phase 74): the monsters
 * an encounter reaches, a monster's blocks, a lossless copy of its authored
 * attacks, edits to them, and the text of its whole data file. No React, DOM,
 * storage or simulation here, and nothing is written anywhere (L02, L23).
 */
import {
  AUTHORED_MONSTER_FILES,
  validateArchetypes,
  validateAttack,
  type AuthoredAttack,
} from "../game/config/data";
import {
  attackSpecFromAuthored,
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

export type MonsterDraft = Readonly<{
  phases: readonly Readonly<{
    phaseId: string;
    attacks: readonly AuthoredAttack[];
    subPhases: readonly Readonly<{
      subPhaseId: string;
      attacks: readonly AuthoredAttack[];
    }>[];
  }>[];
  /** Block id to video seconds; never exported (L22). */
  anchors: Readonly<Record<string, number>>;
}>;

export type DraftResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: string }>;

/** Names a phase, or one of its sub-phases, whose attack list is meant. */
export type DraftLocation = Readonly<{
  phaseId: string;
  subPhaseId: string | null;
}>;

type RawPhase = {
  id: string;
  attacks: unknown;
  subPhases?: { id: string; attacks: unknown }[] | null;
};

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

function rawPhasesOf(rawFile: unknown): RawPhase[] {
  return (rawFile as { phases: RawPhase[] }).phases;
}

function rawBlockIds(rawFile: unknown): string[] {
  return rawPhasesOf(rawFile).flatMap((phase) =>
    phase.subPhases && phase.subPhases.length > 0
      ? phase.subPhases.map((sub) => blockIdOf(phase.id, sub.id))
      : [phase.id],
  );
}

/**
 * L04, L28, L29, amended by V19 J07: a lossless copy of the attacks; anchors
 * survive where the block does. With no `previous` draft the whole monster is
 * copied. With one, every other phase keeps `previous`'s attacks and only
 * `phaseId`'s phase-level and sub-phase attacks come from the file.
 */
export function loadMonsterDraft(
  rawFile: unknown,
  previous: MonsterDraft | null,
  phaseId: string,
): Readonly<{ draft: MonsterDraft; droppedAnchors: readonly string[] }> {
  const copy = <T>(value: T): T => structuredClone(value);
  const known = new Set(rawBlockIds(rawFile));
  const anchors: Record<string, number> = {};
  const droppedAnchors: string[] = [];
  for (const [id, seconds] of Object.entries(previous?.anchors ?? {}))
    if (known.has(id)) anchors[id] = seconds;
    else droppedAnchors.push(id);
  return {
    draft: {
      phases: rawPhasesOf(rawFile).map((phase) => {
        const kept = previous?.phases.find((entry) => entry.phaseId === phase.id);
        if (kept && phase.id !== phaseId) return copy(kept);
        return {
          phaseId: phase.id,
          attacks: copy(phase.attacks as AuthoredAttack[]),
          subPhases: (phase.subPhases ?? []).map((sub) => ({
            subPhaseId: sub.id,
            attacks: copy(sub.attacks as AuthoredAttack[]),
          })),
        };
      }),
      anchors,
    },
    droppedAnchors,
  };
}

/** L18: the phase's attacks, then the sub-phase's, as the game's `activeAttacks`. */
export function activeDraftAttacks(
  draft: MonsterDraft,
  blockId: string,
): readonly AuthoredAttack[] {
  for (const phase of draft.phases) {
    if (blockId === phase.phaseId) return phase.attacks;
    for (const sub of phase.subPhases)
      if (blockId === blockIdOf(phase.phaseId, sub.subPhaseId))
        return [...phase.attacks, ...sub.attacks];
  }
  return [];
}

export function setAnchor(
  draft: MonsterDraft,
  blockId: string,
  seconds: number,
): MonsterDraft {
  return { ...draft, anchors: { ...draft.anchors, [blockId]: seconds } };
}

export function clearAnchor(draft: MonsterDraft, blockId: string): MonsterDraft {
  const anchors = { ...draft.anchors };
  delete anchors[blockId];
  return { ...draft, anchors };
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

type Owner = { attacks: readonly AuthoredAttack[] };

function ownerOf(draft: MonsterDraft, at: DraftLocation): Owner | null {
  const phase = draft.phases.find((entry) => entry.phaseId === at.phaseId);
  if (!phase) return null;
  if (at.subPhaseId === null) return phase;
  return phase.subPhases.find((sub) => sub.subPhaseId === at.subPhaseId) ?? null;
}

function withAttacks(
  draft: MonsterDraft,
  at: DraftLocation,
  attacks: readonly AuthoredAttack[],
): MonsterDraft {
  return {
    ...draft,
    phases: draft.phases.map((phase) => {
      if (phase.phaseId !== at.phaseId) return phase;
      if (at.subPhaseId === null) return { ...phase, attacks };
      return {
        ...phase,
        subPhases: phase.subPhases.map((sub) =>
          sub.subPhaseId === at.subPhaseId ? { ...sub, attacks } : sub,
        ),
      };
    }),
  };
}

function allIds(draft: MonsterDraft): string[] {
  return draft.phases.flatMap((phase) => [
    ...phase.attacks.map((attack) => attack.id),
    ...phase.subPhases.flatMap((sub) => sub.attacks.map((attack) => attack.id)),
  ]);
}

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

/** L10, L13, L26: edits one attack, keeping its id and field order where it can. */
export function editAttack(
  draft: MonsterDraft,
  at: DraftLocation,
  attackId: string,
  change: AttackChange,
  config: EncounterConfig,
): DraftResult<Readonly<{ draft: MonsterDraft; removed: readonly string[] }>> {
  const owner = ownerOf(draft, at);
  const current = owner?.attacks.find((attack) => attack.id === attackId);
  if (!owner || !current) return fail(`No attack "${attackId}" at that location.`);
  const { attack, removed } = applyChange(current, change);
  const checked = validated(
    attack,
    allIds(draft).filter((id) => id !== attackId),
    config,
  );
  if (!checked.ok) return checked;
  return {
    ok: true,
    value: {
      draft: withAttacks(
        draft,
        at,
        owner.attacks.map((entry) => (entry.id === attackId ? checked.value : entry)),
      ),
      removed,
    },
  };
}

/** L10, L12: adds a convenience attack using the catalog's first projectile. */
export function addAttack(
  draft: MonsterDraft,
  at: DraftLocation,
  id: string,
  config: EncounterConfig,
): DraftResult<MonsterDraft> {
  const owner = ownerOf(draft, at);
  if (!owner) return fail("No such phase or sub-phase.");
  const projectile = Object.keys(config.projectiles)[0];
  const attack = {
    id,
    projectile,
    tuningSource: EXPORT_TUNING_SOURCE,
    pattern: { ...NEW_ATTACK_DEFAULTS.pattern },
    cadence: { ...NEW_ATTACK_DEFAULTS.cadence },
  } as AuthoredAttack;
  const checked = validated(attack, allIds(draft), config);
  if (!checked.ok) return checked;
  return { ok: true, value: withAttacks(draft, at, [...owner.attacks, checked.value]) };
}

export function deleteAttack(
  draft: MonsterDraft,
  at: DraftLocation,
  attackId: string,
): DraftResult<MonsterDraft> {
  const owner = ownerOf(draft, at);
  if (!owner?.attacks.some((attack) => attack.id === attackId))
    return fail(`No attack "${attackId}" at that location.`);
  return {
    ok: true,
    value: withAttacks(
      draft,
      at,
      owner.attacks.filter((attack) => attack.id !== attackId),
    ),
  };
}

// ---- The export text (74.3) ------------------------------------------------

/** L24: the repository-relative path of a monster's file. */
export function monsterFilePath(archetypeId: string): string {
  return `app/src/game/data/enemies/${archetypeId}.json`;
}

/**
 * L30, amended by V19 J04, J05: the monster's current file with only the
 * selected phase's attack lists, phase-level and sub-phase, replaced from the
 * draft, in place. Every other phase stays as the file has it. Refuses, naming
 * the id, only when the selected phase or one of its sub-phases is on one side
 * only. Never includes an anchor (L22).
 */
export function monsterFileText(
  archetypeId: string,
  draft: MonsterDraft,
  currentRawFile: unknown,
  config: EncounterConfig,
  phaseId: string,
): DraftResult<string> {
  const result = structuredClone(currentRawFile) as {
    phases: (RawPhase & { attacks: unknown })[];
  };
  const phase = result.phases.find((entry) => entry.id === phaseId);
  const draftPhase = draft.phases.find((entry) => entry.phaseId === phaseId);
  if (!phase && !draftPhase) return fail(`Phase "${phaseId}" is in neither the draft nor the file.`);
  if (!phase) return fail(`Phase "${phaseId}" is in the draft but not in the file.`);
  if (!draftPhase) return fail(`Phase "${phaseId}" is in the file but not in the draft.`);
  const rawSubs = phase.subPhases ?? [];
  for (const sub of draftPhase.subPhases)
    if (!rawSubs.some((raw) => raw.id === sub.subPhaseId))
      return fail(`Sub-phase "${sub.subPhaseId}" is in the draft but not in the file.`);
  for (const raw of rawSubs) {
    const sub = draftPhase.subPhases.find((entry) => entry.subPhaseId === raw.id);
    if (!sub) return fail(`Sub-phase "${raw.id}" is in the file but not in the draft.`);
    raw.attacks = structuredClone(sub.attacks);
  }
  phase.attacks = structuredClone(draftPhase.attacks);
  try {
    const archetypes = validateArchetypes(
      { archetypes: { ...AUTHORED_MONSTER_FILES, [archetypeId]: result } },
      new Set(Object.keys(config.projectiles)),
      config.maxConcurrentMinions,
    );
    for (const phase of archetypes[archetypeId].phases)
      for (const attack of [
        ...phase.attacks,
        ...(phase.subPhases ?? []).flatMap((sub) => sub.attacks),
      ])
        validateAttackSpec(config, attackSpecFromAuthored(attack));
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
  return { ok: true, value: `${JSON.stringify(result, null, 2)}\n` };
}
