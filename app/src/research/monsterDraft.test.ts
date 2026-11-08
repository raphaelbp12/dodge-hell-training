import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { archetypeOf, encounterConfigOf } from "../game/config/encounter";
import {
  activeDraftAttacks,
  addAttack,
  blocksOfMonster,
  clearAnchor,
  deleteAttack,
  editAttack,
  loadMonsterDraft,
  monsterFilePath,
  monsterFileText,
  monstersOfEncounter,
  setAnchor,
} from "./monsterDraft";

const queen = encounterConfigOf("killer-bee-queen");
const worm = encounterConfigOf("crystal-worm");
const rawText = (id: string) =>
  `${JSON.stringify(AUTHORED_MONSTER_FILES[id], null, 2)}\n`;
const queenDraft = () => loadMonsterDraft(AUTHORED_MONSTER_FILES["killer-bee-queen"], null).draft;

function must<T>(
  result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: string }>,
): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("monsters and blocks", () => {
  test("lists every reachable monster once, primary first", () => {
    const ids = monstersOfEncounter(queen);
    expect(ids[0]).toBe("killer-bee-queen");
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
    expect(monstersOfEncounter(worm)).toHaveLength(1);
  });

  test("the Queen has 15 blocks with telegraph and duration", () => {
    const blocks = blocksOfMonster(archetypeOf(queen, "killer-bee-queen"));
    expect(blocks).toHaveLength(15);
    const sub = blocks.find((block) => block.subPhaseId !== null)!;
    expect(sub.id).toBe(`${sub.phaseId}/${sub.subPhaseId}`);
    expect(sub.durationSeconds).not.toBeNull();
    const nests = blocks.find((block) => block.id === "phase-6-nests")!;
    expect(nests.durationSeconds).toBe(29);
    expect(blocks.some((block) => block.durationSeconds === null)).toBe(true);
  });

  test("a nest has 2 blocks and a bee 1", () => {
    expect(blocksOfMonster(archetypeOf(queen, "killer-bee-nest-red"))).toHaveLength(2);
    expect(blocksOfMonster(archetypeOf(queen, "red-killer-bee"))).toHaveLength(1);
  });
});

describe("loading", () => {
  test("a loaded draft holds the file's attack lists for every monster", () => {
    for (const [id, raw] of Object.entries(AUTHORED_MONSTER_FILES)) {
      const { draft } = loadMonsterDraft(raw, null);
      const phases = (raw as { phases: { attacks: unknown[] }[] }).phases;
      expect(draft.phases.map((phase) => phase.attacks), id).toEqual(
        phases.map((phase) => phase.attacks),
      );
      expect(draft.anchors).toEqual({});
    }
  });

  test("a phase-level attack is active in each sub-phase", () => {
    const draft = queenDraft();
    const phase = draft.phases.find((entry) => entry.subPhases.length > 0)!;
    const sub = phase.subPhases[0];
    const active = activeDraftAttacks(draft, `${phase.phaseId}/${sub.subPhaseId}`);
    expect(active).toEqual([...phase.attacks, ...sub.attacks]);
  });

  test("a reload keeps an anchor, drops one for a missing block and reports it", () => {
    const first = setAnchor(setAnchor(queenDraft(), "phase-6-nests", 12), "gone", 3);
    const { draft, droppedAnchors } = loadMonsterDraft(
      AUTHORED_MONSTER_FILES["killer-bee-queen"],
      first,
    );
    expect(draft.anchors).toEqual({ "phase-6-nests": 12 });
    expect(droppedAnchors).toEqual(["gone"]);
    expect(clearAnchor(draft, "phase-6-nests").anchors).toEqual({});
  });
});

describe("editing", () => {
  const firstAttack = () => {
    const draft = loadMonsterDraft(AUTHORED_MONSTER_FILES["red-killer-bee"], null).draft;
    return { draft, where: { phaseId: draft.phases[0].phaseId, subPhaseId: null }, id: draft.phases[0].attacks[0].id };
  };

  test("an edit changes the named field, keeps the id and sets the source", () => {
    const { draft, where: at, id } = firstAttack();
    const before = draft.phases[0].attacks[0];
    const { draft: next } = must(
      editAttack(draft, at, id, { field: "cadence", key: "cooldownAfterLastShotSeconds", value: 2.5 }, queen),
    );
    const after = next.phases[0].attacks[0];
    expect(after.id).toBe(id);
    expect(after.tuningSource).toBe("video-observation");
    expect(after.cadence).toEqual({ ...before.cadence, cooldownAfterLastShotSeconds: 2.5 });
    expect(after.pattern).toEqual(before.pattern);
    expect(draft.phases[0].attacks[0]).toBe(before);
  });

  test("hidden ring fields survive an edit to the same ring", () => {
    const draft = queenDraft();
    let found: { at: { phaseId: string; subPhaseId: string | null }; id: string } | null = null;
    for (const phase of draft.phases) {
      for (const owner of [{ subPhaseId: null, attacks: phase.attacks }, ...phase.subPhases]) {
        for (const attack of owner.attacks)
          if (
            attack.pattern.kind === "ring" &&
            attack.pattern.perBurstAdvanceDegrees !== undefined
          )
            found ??= {
              at: { phaseId: phase.phaseId, subPhaseId: "subPhaseId" in owner ? (owner.subPhaseId as string) : null },
              id: attack.id,
            };
      }
    }
    expect(found).not.toBeNull();
    const { draft: next } = must(
      editAttack(draft, found!.at, found!.id, { field: "pattern", key: "arms", value: 3 }, queen),
    );
    const list = (d: typeof draft) =>
      [...d.phases.flatMap((p) => [...p.attacks, ...p.subPhases.flatMap((s) => s.attacks)])].find(
        (a) => a.id === found!.id,
      )!;
    expect(list(next).pattern).toMatchObject({
      arms: 3,
      perBurstAdvanceDegrees: (list(draft).pattern as { perBurstAdvanceDegrees: number }).perBurstAdvanceDegrees,
    });
  });

  test("invalid edits are refused and leave the input unchanged", () => {
    const { draft, where: at, id } = firstAttack();
    const snapshot = JSON.stringify(draft);
    for (const change of [
      { field: "projectile", value: "no-such" },
      { field: "cadence", key: "shotIntervalSeconds", value: 0 },
      { field: "target", value: "player" },
    ] as const) {
      const result = editAttack(draft, at, id, change, queen);
      expect(result.ok).toBe(false);
    }
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  test("a duplicate id is refused on add", () => {
    const { draft, where: at, id } = firstAttack();
    expect(addAttack(draft, at, id, queen).ok).toBe(false);
  });

  test("ring to spread reports the removed fields", () => {
    const draft = queenDraft();
    const phase = draft.phases.find((entry) =>
      entry.attacks.some((attack) => attack.pattern.kind === "ring"),
    )!;
    const ring = phase.attacks.find((attack) => attack.pattern.kind === "ring")!;
    const { removed, draft: next } = must(
      editAttack(draft, { phaseId: phase.phaseId, subPhaseId: null }, ring.id,
        { field: "patternKind", value: "spread" }, queen),
    );
    expect(removed).toContain("arms");
    const after = next.phases.find((p) => p.phaseId === phase.phaseId)!.attacks.find((a) => a.id === ring.id)!;
    expect(after.pattern.kind).toBe("spread");
  });

  test("add and delete act only at their location", () => {
    const { draft, where: at } = firstAttack();
    const added = must(addAttack(draft, at, "brand-new", queen));
    expect(added.phases[0].attacks.at(-1)!.id).toBe("brand-new");
    expect(added.phases[0].attacks.at(-1)!.tuningSource).toBe("video-observation");
    expect(added.anchors).toEqual(draft.anchors);
    const removed = must(deleteAttack(added, at, "brand-new"));
    expect(removed).toEqual(draft);
  });
});

describe("export text", () => {
  test("an untouched draft exports byte-identical text for every monster", () => {
    for (const [id, raw] of Object.entries(AUTHORED_MONSTER_FILES)) {
      const { draft } = loadMonsterDraft(raw, null);
      expect(must(monsterFileText(id, draft, raw, queen)), id).toBe(rawText(id));
    }
  });

  test("a hand-changed phase value in the current file survives", () => {
    const id = "killer-bee-queen";
    const raw = structuredClone(AUTHORED_MONSTER_FILES[id]) as { phases: { telegraphSeconds: number }[] };
    const { draft } = loadMonsterDraft(raw, null);
    raw.phases[1].telegraphSeconds = 7.5;
    const text = must(monsterFileText(id, draft, raw, queen));
    expect(JSON.parse(text).phases[1].telegraphSeconds).toBe(7.5);
  });

  test("a missing phase and a missing sub-phase are refused by name", () => {
    const id = "killer-bee-queen";
    const draft = queenDraft();
    const noPhase = { ...draft, phases: draft.phases.slice(1) };
    const lost = monsterFileText(id, noPhase, AUTHORED_MONSTER_FILES[id], queen);
    expect(lost.ok ? "" : lost.error).toContain(draft.phases[0].phaseId);
    const withSub = draft.phases.findIndex((p) => p.subPhases.length > 0);
    const phases = draft.phases.map((p, i) =>
      i === withSub ? { ...p, subPhases: p.subPhases.slice(1) } : p,
    );
    const lostSub = monsterFileText(id, { ...draft, phases }, AUTHORED_MONSTER_FILES[id], queen);
    expect(lostSub.ok ? "" : lostSub.error).toContain(draft.phases[withSub].subPhases[0].subPhaseId);
  });

  test("an edit appears in place and no anchor is exported", () => {
    const id = "red-killer-bee";
    const raw = AUTHORED_MONSTER_FILES[id];
    const draft = setAnchor(loadMonsterDraft(raw, null).draft, draftFirst(raw), 4);
    const attack = draft.phases[0].attacks[0];
    const edited = must(
      editAttack(draft, { phaseId: draft.phases[0].phaseId, subPhaseId: null }, attack.id,
        { field: "cadence", key: "cooldownAfterLastShotSeconds", value: 3.25 }, queen),
    ).draft;
    const text = must(monsterFileText(id, edited, raw, queen));
    expect(JSON.parse(text).phases[0].attacks[0]).toMatchObject({
      id: attack.id,
      cadence: { cooldownAfterLastShotSeconds: 3.25 },
    });
    expect(text).not.toContain("anchors");
    expect(monsterFilePath(id)).toBe(`app/src/game/data/enemies/${id}.json`);
  });
});

function draftFirst(raw: unknown): string {
  return (raw as { phases: { id: string }[] }).phases[0].id;
}
