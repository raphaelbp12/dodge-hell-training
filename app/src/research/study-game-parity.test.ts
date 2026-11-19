/**
 * Study-to-game parity (plan V23 Q01, Q22; docs/study-parity-plan.md): the
 * committed Killer Bee Queen study against the shipped Queen file, which is
 * that study's export. Every exported track's marks are fired by the
 * simulation at their offsets from the segment's entry, and every shipped
 * telegraph is the study's measured one.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { DEFAULT_DEBUG_SETTINGS } from "../game/config/debug";
import { encounterConfigOf, primaryArchetype } from "../game/config/encounter";
import { forceNextSubPhase } from "../game/simulation/phases";
import { advanceSimulation, createSimulation, setDebugSettings } from "../game/simulation/simulation";
import { firstMismatch } from "./parity";
import { segmentIdOf, segmentsOfMonster, type AttackTrack, type StudyV6 } from "./study";
import { exportedTracksOf, measuredSegmentValues, studyWindowsOfFile } from "./studyExport";
import { validateObservationExport } from "./tagging";
import { firstWindowOf, volleyTimesInWindow } from "./trackMarks";

const study = validateObservationExport(
  JSON.parse(
    readFileSync(new URL("../../../docs/killer-bee-queen-study-TFclwuPtC94.json", import.meta.url), "utf8"),
  ),
) as StudyV6;
const config = encounterConfigOf("killer-bee-queen");
const archetype = primaryArchetype(config);
const segments = segmentsOfMonster(archetype);
const shipped = AUTHORED_MONSTER_FILES["killer-bee-queen"];
const windows = studyWindowsOfFile(study, shipped);
const { fixedStepSeconds } = config.simulation;
const IDLE = { north: false, south: false, east: false, west: false };

/** One video frame plus one simulation step: the finest either side can resolve. */
const TOLERANCE_SECONDS = 1 / (study.provenance.frameRate ?? 30) + fixedStepSeconds;

/** The track's volley marks in its first window, as seconds after that window's start (Q03). */
function markedOffsets(track: AttackTrack): Readonly<{ spanSeconds: number; offsets: number[] }> {
  const window = firstWindowOf(track, windows)!;
  return {
    spanSeconds: window.endSeconds - window.startSeconds,
    offsets: volleyTimesInWindow(track, windows, window).map((time) => time - window.startSeconds),
  };
}

/**
 * The attack's volleys in a god-mode, progression-paused drill of its phase
 * (its sub-phase forced active), as seconds after the attack clock's segment
 * entry, until `spanSeconds` pass or the clock is re-entered.
 */
function gameOffsets(track: AttackTrack, spanSeconds: number): number[] {
  const phaseIndex = archetype.phases.findIndex((phase) => phase.id === track.location.phaseId);
  const state = createSimulation(config, 1, { drill: { phaseIndices: [phaseIndex], loop: false } });
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true, pauseProgression: true });
  const enemy = state.enemies.find((candidate) => candidate.archetypeId === archetype.id)!;
  const subIndex =
    archetype.phases[phaseIndex].subPhases?.findIndex((sub) => sub.id === track.location.subPhaseId) ?? -1;
  if (subIndex >= 0)
    while (enemy.subPhaseIndex !== subIndex) forceNextSubPhase(state, enemy, archetype);
  const clockOf = () => enemy.attackClocks.find((clock) => clock.attackId === track.attack.id);
  let clock = clockOf()!;
  const entrySeconds = clock.marks!.entrySeconds;
  const offsets: number[] = [];
  let fired = clock.volleysFired;
  while (state.phase === "playing" && state.elapsedSeconds < entrySeconds + spanSeconds) {
    advanceSimulation(state, fixedStepSeconds, IDLE);
    // The step a segment exits fires its due volleys on the outgoing clock first.
    for (; fired < clock.volleysFired; fired++) offsets.push(state.elapsedSeconds - entrySeconds);
    const current = clockOf();
    if (current?.marks?.entrySeconds !== entrySeconds) break;
    if (current !== clock) {
      clock = current;
      fired = clock.volleysFired;
    }
  }
  return offsets;
}

describe("study-game parity: telegraph", () => {
  // Plan V23 Q13: export writes each observed segment's measured telegraph.
  const measured = segments.flatMap((segment) => {
    const telegraph = measuredSegmentValues(study, segment.id).telegraphSeconds;
    return telegraph === null ? [] : [[segment.id, segment.telegraphSeconds, telegraph] as const];
  });
  test("the study measures at least one telegraph", () => expect(measured.length).toBeGreaterThan(0));
  test.each(measured)("%s ships its measured telegraph", (_id, shippedSeconds, measuredSeconds) => {
    expect(shippedSeconds).toBe(measuredSeconds);
  });
});

// Findings F100-1 and F100-2 were resolved by the user on 2026-11-19: due
// marks fire before a segment exits, and segment values follow the first
// window instead of the median.
function expectMarksFired(track: AttackTrack): void {
  const { spanSeconds, offsets } = markedOffsets(track);
  const game = gameOffsets(track, spanSeconds);
  expect(firstMismatch(offsets, game, TOLERANCE_SECONDS), JSON.stringify({ marked: offsets, game })).toBeNull();
}

describe("study-game parity: marks", () => {
  const exported = exportedTracksOf(study, windows).map(({ track }) => track);
  const labelled = (tracks: readonly AttackTrack[]) =>
    tracks.map((track) => [`${segmentIdOf(track.location)} ${track.id}`, track] as const);
  test("the study exports at least one marked track", () => expect(exported.length).toBeGreaterThan(0));
  test.each(labelled(exported))("%s fires its marked volleys from the segment's entry", (_label, track) =>
    expectMarksFired(track),
  );
});
