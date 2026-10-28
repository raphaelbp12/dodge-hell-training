import { archetypeOf, resolveProgression } from "../config/encounter";
import type {
  AttackSpec,
  EnemyArchetype,
  MovementSpec,
  PhaseSpawnSpec,
  PhaseSpec,
} from "../config/encounter";
import type { AttackClockState, EnemyState } from "../models";
import { pointOnRing } from "./geometry";
import { createEnemy, type SimulationState } from "./simulation";

/** 1 for an archetype with no `health` block, so callers need one query for both kinds. */
export function healthFraction(enemy: EnemyState): number {
  if (enemy.healthHp === null || enemy.maxHealthHp === null) return 1;
  return enemy.healthHp / enemy.maxHealthHp;
}

/**
 * One clock per authored attack, anchored at `epochSeconds`. The telegraph is
 * implemented by this anchor alone (step 22.3): a phase entry anchors the
 * epoch at `phaseEnteredAtSeconds + telegraphSeconds`, so each attack's own
 * `initialDelaySeconds` adds on top without a separate firing gate.
 */
export function createAttackClocks(
  attacks: readonly AttackSpec[],
  epochSeconds: number,
): AttackClockState[] {
  return attacks.map((attack) => ({
    attackId: attack.id,
    epochSeconds,
    volleysAtEpoch: 0,
    initialDelaySeconds: attack.cadence.initialDelaySeconds,
    rotationEpochSeconds: epochSeconds,
    rotationPhaseAtEpoch:
      attack.pattern.kind === "ring" ? attack.pattern.initialPhaseRadians : 0,
    ringPhaseRadians:
      attack.pattern.kind === "ring" ? attack.pattern.initialPhaseRadians : 0,
    volleysFired: 0,
  }));
}

/** Resolves one enemy's currently active phase. */
export function currentPhaseOf(
  archetype: EnemyArchetype,
  enemy: EnemyState,
): PhaseSpec {
  return archetype.phases[enemy.phaseIndex];
}

/**
 * The active attack set (step 22.4): the phase's own attacks, then the
 * active sub-phase's, in that order, so clock and shard ordering stays
 * deterministic. A phase with no sub-phases returns just its own attacks,
 * exactly as step 22.3 left it.
 */
export function activeAttacks(
  archetype: EnemyArchetype,
  enemy: EnemyState,
): readonly AttackSpec[] {
  const phase = currentPhaseOf(archetype, enemy);
  if (!phase.subPhases || phase.subPhases.length === 0) return phase.attacks;
  return [...phase.attacks, ...phase.subPhases[enemy.subPhaseIndex].attacks];
}

/**
 * The active movement (step 22.4): the active sub-phase's override when it
 * authors one, otherwise the phase's own movement - unchanged from step 22.3
 * for a phase with no sub-phases.
 */
export function activeMovement(
  archetype: EnemyArchetype,
  enemy: EnemyState,
): MovementSpec {
  const phase = currentPhaseOf(archetype, enemy);
  const subPhase = phase.subPhases?.[enemy.subPhaseIndex];
  return subPhase?.movement ?? phase.movement;
}

/**
 * Removes every enemy `ownerId` spawned with `despawnOnExit` set (K: the
 * source's Killer Bees despawning when the Queen switches attacks). Their
 * already-fired shards are untouched - they expire on their own lifetimes,
 * exactly as the once-fired rules require.
 */
function despawnExitedMinions(state: SimulationState, ownerId: number): void {
  state.enemies = state.enemies.filter(
    (enemy) => !(enemy.spawnedByEnemyId === ownerId && enemy.despawnOnExit),
  );
}

/**
 * Resolves one spawn entry, once, spreading its count evenly around the
 * chosen ring and offsetting the whole group by the authored golden angle
 * (keyed off the ever-increasing `nextEnemyId`) so repeated entries do not
 * stack minions on the same points. Suppressed, not queued, past
 * `maxConcurrentMinions` - the loader already rejects an unreachable count.
 */
function resolveSpawn(
  state: SimulationState,
  owner: EnemyState,
  spec: PhaseSpawnSpec,
): void {
  const currentMinions = state.enemies.filter(
    (enemy) => enemy.spawnedByEnemyId !== null,
  ).length;
  const toSpawn = Math.min(
    spec.count,
    Math.max(0, state.config.maxConcurrentMinions - currentMinions),
  );
  const center =
    spec.placement.kind === "ring-around-owner"
      ? owner.positionTiles
      : state.config.arena.centerTiles;
  const radiusTiles =
    spec.placement.kind === "ring-around-owner"
      ? spec.placement.radiusTiles
      : spec.placement.ringRadiusFraction * state.config.arena.radiusTiles;
  const baseBearingRadians =
    state.nextEnemyId * state.config.spawns.goldenAngleRadians;
  for (let index = 0; index < toSpawn; index++) {
    const bearingRadians =
      baseBearingRadians + (index * 2 * Math.PI) / spec.count;
    const minion = createEnemy(
      state.config,
      spec.archetypeId,
      state.nextEnemyId++,
      state.elapsedSeconds,
      pointOnRing(center, radiusTiles, bearingRadians),
      {
        startPhaseIndex: spec.startPhaseIndex,
        spawnedByEnemyId: owner.id,
        despawnOnExit: spec.despawnOnExit,
      },
    );
    state.enemies.push(minion);
    resolveEntrySpawns(
      state,
      minion,
      archetypeOf(state.config, spec.archetypeId),
    );
  }
}

/**
 * Resolves the spawns authored by the (sub)phase an enemy starts in. Called
 * for every newly created enemy - both the primary/timed-spawn path and a
 * phase-driven minion - since `createEnemy` itself only anchors clocks and
 * cannot reach `state` to create further enemies.
 */
export function resolveEntrySpawns(
  state: SimulationState,
  enemy: EnemyState,
  archetype: EnemyArchetype,
): void {
  const phase = currentPhaseOf(archetype, enemy);
  resolveSpawns(state, enemy, phase.spawns);
  const subPhase = phase.subPhases?.[enemy.subPhaseIndex];
  if (subPhase) resolveSpawns(state, enemy, subPhase.spawns);
}

function resolveSpawns(
  state: SimulationState,
  owner: EnemyState,
  specs: readonly PhaseSpawnSpec[] | null,
): void {
  if (!specs) return;
  for (const spec of specs) resolveSpawn(state, owner, spec);
}

/**
 * Enters a sub-phase (step 22.4): the same mechanism a phase uses to enter -
 * sets its entry time and invulnerability window, and rebuilds the attack
 * clocks from the combined phase-then-sub-phase attack set, anchored past
 * the sub-phase's own telegraph. Resolves the sub-phase's own spawns once.
 */
export function enterSubPhase(
  state: SimulationState,
  enemy: EnemyState,
  archetype: EnemyArchetype,
  phaseIndex: number,
  subPhaseIndex: number,
): void {
  despawnExitedMinions(state, enemy.id);
  const elapsedSeconds = state.elapsedSeconds;
  const phase = archetype.phases[phaseIndex];
  const subPhase = phase.subPhases?.[subPhaseIndex];
  if (!subPhase) throw new RangeError("Unknown sub-phase index");
  enemy.subPhaseIndex = subPhaseIndex;
  enemy.subPhaseEnteredAtSeconds = elapsedSeconds;
  enemy.invulnerableUntilSeconds =
    elapsedSeconds + subPhase.invulnerableOnEnterSeconds;
  enemy.attackClocks = createAttackClocks(
    [...phase.attacks, ...subPhase.attacks],
    elapsedSeconds + subPhase.telegraphSeconds,
  );
  resolveSpawns(state, enemy, subPhase.spawns);
}

/**
 * Enters a phase: resets every phase-scoped field (K09) - the movement and
 * wander state so a new movement kind starts clean, the invulnerability
 * window, and the attack clocks, rebuilt from the new phase's own attacks.
 * Despawns the previous scope's `despawnOnExit` minions first, then, when
 * the new phase has sub-phases, immediately enters the first one (step
 * 22.4) - which is what actually sets the invulnerability window, the
 * telegraph anchor and resolves spawns in that case. Resolves the phase's
 * own spawns once on entry either way.
 */
export function enterPhase(
  state: SimulationState,
  enemy: EnemyState,
  archetype: EnemyArchetype,
  index: number,
): void {
  despawnExitedMinions(state, enemy.id);
  const elapsedSeconds = state.elapsedSeconds;
  const phase = archetype.phases[index];
  enemy.phaseIndex = index;
  enemy.phaseEnteredAtSeconds = elapsedSeconds;
  enemy.movementPhaseRadians = 0;
  enemy.wanderTargetTiles = null;
  enemy.wanderRetargetAtSeconds = elapsedSeconds;
  if (phase.subPhases && phase.subPhases.length > 0) {
    enterSubPhase(state, enemy, archetype, index, 0);
  } else {
    enemy.subPhaseIndex = 0;
    enemy.subPhaseEnteredAtSeconds = elapsedSeconds;
    enemy.invulnerableUntilSeconds =
      elapsedSeconds + phase.invulnerableOnEnterSeconds;
    enemy.attackClocks = createAttackClocks(
      phase.attacks,
      elapsedSeconds + phase.telegraphSeconds,
    );
  }
  resolveSpawns(state, enemy, phase.spawns);
}

/** Advances one enemy by at most one phase; the caller loops to cross several thresholds in one step. */
function tryAdvancePhase(
  state: SimulationState,
  enemy: EnemyState,
  archetype: EnemyArchetype,
): boolean {
  const nextIndex = enemy.phaseIndex + 1;
  if (nextIndex >= archetype.phases.length) return false;
  const phase = currentPhaseOf(archetype, enemy);
  const nextPhase = archetype.phases[nextIndex];
  const byHealth = healthFraction(enemy) <= nextPhase.enterAtHpFraction;
  const byDuration =
    phase.exitAfterSeconds !== null &&
    state.elapsedSeconds - enemy.phaseEnteredAtSeconds >= phase.exitAfterSeconds;
  if (!byHealth && !byDuration) return false;
  enterPhase(state, enemy, archetype, nextIndex);
  return true;
}

/**
 * Advances one enemy's sub-phase cycle by at most one step, looping to cross
 * several quick cycles in one fixed step the way the phase machine does.
 * Cycles back to the first sub-phase after the last (step 22.4). A phase
 * with no sub-phases is a no-op, unchanged from step 22.3.
 */
function tryAdvanceSubPhase(
  state: SimulationState,
  enemy: EnemyState,
  archetype: EnemyArchetype,
): boolean {
  const phase = currentPhaseOf(archetype, enemy);
  if (!phase.subPhases || phase.subPhases.length === 0) return false;
  const subPhase = phase.subPhases[enemy.subPhaseIndex];
  if (
    state.elapsedSeconds - enemy.subPhaseEnteredAtSeconds <
    subPhase.durationSeconds
  )
    return false;
  const nextIndex = (enemy.subPhaseIndex + 1) % phase.subPhases.length;
  enterSubPhase(state, enemy, archetype, enemy.phaseIndex, nextIndex);
  return true;
}

/**
 * Evaluated once per fixed step, after the progression drain (K09). Loops so
 * a single high-drain step can cross more than one threshold, applying every
 * crossed phase's entry effects in turn. Progression is monotonic: this never
 * re-enters the current phase or returns to an earlier one. Sub-phase cycling
 * (step 22.4) is then advanced for whichever phase is now active.
 */
export function applyPhaseTransitions(state: SimulationState): void {
  for (const enemy of state.enemies) {
    const archetype = archetypeOf(state.config, enemy.archetypeId);
    let advancedPhase = true;
    while (advancedPhase) advancedPhase = tryAdvancePhase(state, enemy, archetype);
    let advancedSubPhase = true;
    while (advancedSubPhase)
      advancedSubPhase = tryAdvanceSubPhase(state, enemy, archetype);
  }
}

/**
 * Drains every enemy's simulated-dps progression by one fixed step, after
 * movement and before attacks (K01, K08). Sets `state.phase` to "cleared"
 * the step an enemy's health reaches zero, stopping the simulation the way
 * "ended" already does. K08: invulnerability blocks progression drain only -
 * the player cannot deal damage, so there is nothing else for it to block.
 */
export function applyProgression(
  state: SimulationState,
  stepSeconds: number,
): void {
  for (const enemy of state.enemies) {
    if (enemy.healthHp === null) continue;
    if (state.elapsedSeconds < enemy.invulnerableUntilSeconds) continue;
    if (state.debugSettings.pauseProgression) continue;
    const archetype = archetypeOf(state.config, enemy.archetypeId);
    const phase = currentPhaseOf(archetype, enemy);
    const progression = resolveProgression(archetype, phase.progression);
    if (progression.kind !== "simulated-dps") continue;
    enemy.healthHp = Math.max(
      0,
      enemy.healthHp - progression.hpPerSecond * stepSeconds,
    );
    if (enemy.healthHp === 0) state.phase = "cleared";
  }
}
