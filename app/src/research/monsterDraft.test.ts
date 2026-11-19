import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES, type CadencedAuthoredAttack } from "../game/config/data";
import { archetypeOf, encounterConfigOf } from "../game/config/encounter";
import {
  blocksOfMonster,
  changedAttack,
  monsterFilePath,
  monstersOfEncounter,
  NEW_ATTACK_DEFAULTS,
  newAttack,
  taggableMonsters,
  taggingConfigOf,
} from "./monsterDraft";
import { tracksFromMonsterFile } from "./studyMigrate";

const queen = encounterConfigOf("killer-bee-queen");
const worm = encounterConfigOf("crystal-worm");

function must<T>(
  result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: string }>,
): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const queenAttacks = (): readonly CadencedAuthoredAttack[] =>
  tracksFromMonsterFile(AUTHORED_MONSTER_FILES["killer-bee-queen"]).map((track) => track.attack);
const sample = () =>
  tracksFromMonsterFile(AUTHORED_MONSTER_FILES["red-killer-bee"])[0].attack;

describe("monsters and blocks", () => {
  test("lists every reachable monster once, primary first", () => {
    const ids = monstersOfEncounter(queen);
    expect(ids[0]).toBe("killer-bee-queen");
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
    expect(monstersOfEncounter(worm)).toHaveLength(1);
  });

  test("every monster is taggable under every encounter, the encounter's own first", () => {
    const all = Object.keys(AUTHORED_MONSTER_FILES);
    for (const encounterId of ["killer-bee-queen", "crystal-worm"]) {
      const config = taggingConfigOf(encounterId);
      const ids = taggableMonsters(config);
      expect(ids.toSorted()).toEqual(all.toSorted());
      expect(ids.slice(0, monstersOfEncounter(encounterConfigOf(encounterId)).length)).toEqual(
        monstersOfEncounter(encounterConfigOf(encounterId)),
      );
    }
  });

  test("a tagging config keeps its encounter's arena, player and own archetypes, and adds every other monster and projectile", () => {
    const tagging = taggingConfigOf("crystal-worm");
    expect(tagging.arena).toBe(worm.arena);
    expect(tagging.player).toBe(worm.player);
    expect(tagging.primaryArchetypeId).toBe(worm.primaryArchetypeId);
    expect(tagging.archetypes["crystal-worm-child-head"]).toBe(worm.archetypes["crystal-worm-child-head"]);
    expect(archetypeOf(tagging, "killer-bee-queen")).toBe(queen.archetypes["killer-bee-queen"]);
    for (const id of Object.keys(queen.projectiles)) expect(tagging.projectiles[id]).toBeDefined();
    expect(taggingConfigOf("crystal-worm")).toBe(tagging);
  });

  test("the Queen has 15 blocks with telegraph and duration", () => {
    const blocks = blocksOfMonster(archetypeOf(queen, "killer-bee-queen"));
    expect(blocks).toHaveLength(15);
    const sub = blocks.find((block) => block.subPhaseId !== null)!;
    expect(sub.id).toBe(`${sub.phaseId}/${sub.subPhaseId}`);
    expect(sub.durationSeconds).not.toBeNull();
    const nests = blocks.find((block) => block.id === "phase-6-nests")!;
    // Plan V23 Q13, Q22: the study's measured exitAfterSeconds.
    expect(nests.durationSeconds).toBe(33.133);
    expect(blocks.some((block) => block.durationSeconds === null)).toBe(true);
  });

  test("a nest has 2 blocks and a bee 1", () => {
    expect(blocksOfMonster(archetypeOf(queen, "killer-bee-nest-red"))).toHaveLength(2);
    expect(blocksOfMonster(archetypeOf(queen, "red-killer-bee"))).toHaveLength(1);
  });

  test("a monster's file path", () => {
    expect(monsterFilePath("red-killer-bee")).toBe("app/src/game/data/enemies/red-killer-bee.json");
  });
});

describe("one attack (plan V20 step 86.1)", () => {
  test("changedAttack applies one change, keeps the id and sets the source", () => {
    const before = sample();
    const { attack } = must(
      changedAttack(before, { field: "cadence", key: "cooldownAfterLastShotSeconds", value: 2.5 }, [], queen),
    );
    expect(attack.cadence).toEqual({ ...before.cadence, cooldownAfterLastShotSeconds: 2.5 });
    expect(attack.pattern).toEqual(before.pattern);
    expect(attack.id).toBe(before.id);
    expect(attack.tuningSource).toBe("video-observation");
  });

  test("hidden ring fields survive an edit to the same ring", () => {
    const ring = queenAttacks().find(
      (attack) => attack.pattern.kind === "ring" && attack.pattern.perBurstAdvanceDegrees !== undefined,
    )!;
    expect(ring).toBeDefined();
    const { attack } = must(changedAttack(ring, { field: "pattern", key: "arms", value: 3 }, [], queen));
    expect(attack.pattern).toMatchObject({
      arms: 3,
      perBurstAdvanceDegrees: (ring.pattern as { perBurstAdvanceDegrees: number }).perBurstAdvanceDegrees,
    });
  });

  test("invalid changes are refused and leave the input unchanged", () => {
    const before = sample();
    const snapshot = JSON.stringify(before);
    for (const change of [
      { field: "projectile", value: "no-such" },
      { field: "cadence", key: "shotIntervalSeconds", value: 0 },
      { field: "cadence", key: "shotsPerBurst", value: 0 },
      { field: "target", value: "player" },
    ] as const)
      expect(changedAttack(before, change, [], queen).ok).toBe(false);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  test("ring to spread reports the removed fields", () => {
    const ring = queenAttacks().find((attack) => attack.pattern.kind === "ring")!;
    const { attack, removed } = must(changedAttack(ring, { field: "patternKind", value: "spread" }, [], queen));
    expect(removed).toContain("arms");
    expect(attack.pattern.kind).toBe("spread");
  });

  test("newAttack uses the defaults and the catalog's first projectile and refuses a taken id", () => {
    const attack = must(newAttack("fresh", [], queen));
    expect(attack.projectile).toBe(Object.keys(queen.projectiles)[0]);
    expect(attack.cadence).toEqual(NEW_ATTACK_DEFAULTS.cadence);
    expect(attack.tuningSource).toBe("video-observation");
    expect(newAttack("fresh", ["fresh"], queen).ok).toBe(false);
  });
});
