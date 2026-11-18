import { describe, expect, test } from "vitest";
import { AUTHORED_MONSTER_FILES, AUTHORED_PROJECTILES } from "../game/config/data";
import { encounterConfigOf } from "../game/config/encounter";
import type { StudyV5 } from "./study";
import { emptyStudy } from "./studyMigrate";
import {
  bombVariantOf,
  MEASURED_VARIANT_SOURCE,
  monsterFileTextFromStudy,
  studyExportJson,
} from "./studyExport";

const config = encounterConfigOf("killer-bee-queen");
const rawText = (id: string) => `${JSON.stringify(AUTHORED_MONSTER_FILES[id], null, 2)}\n`;
const studyOf = (archetypeId: string): StudyV5 =>
  emptyStudy({
    encounterId: "killer-bee-queen",
    archetypeId,
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
    recordedAt: "2026-11-13T00:00:00.000Z",
    rawFile: AUTHORED_MONSTER_FILES[archetypeId],
  });

function must<T>(result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: string }>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

const exported = (archetypeId: string, study: StudyV5) =>
  JSON.parse(
    must(
      monsterFileTextFromStudy({
        archetypeId,
        study,
        currentRawFile: AUTHORED_MONSTER_FILES[archetypeId],
        config,
      }),
    ),
  );

type RawSegment = { id: string; telegraphSeconds: number; durationSeconds?: number; attacks: { id: string; projectile: string }[] };
type Raw = { phases: (RawSegment & { subPhases?: RawSegment[] | null })[] };

describe("monsterFileTextFromStudy", () => {
  test("an untouched study exports every monster's file byte-identical", () => {
    const ids = Object.keys(AUTHORED_MONSTER_FILES);
    expect(ids).toHaveLength(12);
    for (const id of ids)
      expect(
        must(
          monsterFileTextFromStudy({
            archetypeId: id,
            study: studyOf(id),
            currentRawFile: AUTHORED_MONSTER_FILES[id],
            config,
          }),
        ),
        id,
      ).toBe(rawText(id));
  });

  test("an accepted telegraph on a sub-phase lands on that sub-phase only", () => {
    const raw = AUTHORED_MONSTER_FILES["killer-bee-queen"] as Raw;
    const phase = raw.phases.find((entry) => (entry.subPhases ?? []).length > 1)!;
    const [first, second] = phase.subPhases!;
    const study = {
      ...studyOf("killer-bee-queen"),
      acceptedSegmentValues: { [`${phase.id}/${first.id}`]: { telegraphSeconds: 1.234 } },
    };
    const out = exported("killer-bee-queen", study) as Raw;
    const outPhase = out.phases.find((entry) => entry.id === phase.id)!;
    expect(outPhase.subPhases![0].telegraphSeconds).toBe(1.234);
    expect(outPhase.subPhases![1].telegraphSeconds).toBe(second.telegraphSeconds);
    expect(outPhase.telegraphSeconds).toBe(phase.telegraphSeconds);
  });

  test("an accepted duration on a phase changes nothing", () => {
    const raw = AUTHORED_MONSTER_FILES["killer-bee-queen"] as Raw;
    const plain = raw.phases.find((entry) => (entry.subPhases ?? []).length === 0)!;
    const study = {
      ...studyOf("killer-bee-queen"),
      acceptedSegmentValues: { [plain.id]: { durationSeconds: 9 } },
    };
    expect(
      must(
        monsterFileTextFromStudy({
          archetypeId: "killer-bee-queen",
          study,
          currentRawFile: raw,
          config,
        }),
      ),
    ).toBe(rawText("killer-bee-queen"));
  });

  test("a track in a segment missing from the file fails, naming it", () => {
    const study = studyOf("killer-bee-queen");
    const moved = {
      ...study,
      tracks: [{ ...study.tracks[0], location: { phaseId: "nowhere", subPhaseId: null } }, ...study.tracks.slice(1)],
    };
    const result = monsterFileTextFromStudy({
      archetypeId: "killer-bee-queen",
      study: moved,
      currentRawFile: AUTHORED_MONSTER_FILES["killer-bee-queen"],
      config,
    });
    expect(result).toEqual({
      ok: false,
      error: `Track ${study.tracks[0].id} is in segment nowhere, which is not in the file.`,
    });
  });

  test("a bomb track with an override exports the -measured projectile id", () => {
    const study = studyOf("killer-bee-queen");
    const index = study.tracks.findIndex((track) => track.id === "blue-bomb-ring");
    const tracks = study.tracks.map((track, at) =>
      at === index ? { ...track, projectileOverride: { travelSeconds: 0.75 } } : track,
    );
    const out = exported("killer-bee-queen", { ...study, tracks }) as Raw;
    expect(out.phases[0].attacks.find((attack) => attack.id === "blue-bomb-ring")!.projectile).toBe(
      "blue-bomb-ring-measured",
    );
  });

  test("a measured variant the projectile validator rejects is refused, not exported", () => {
    const study = studyOf("killer-bee-queen");
    const tracks = study.tracks.map((track) =>
      track.id === "blue-bomb-ring" ? { ...track, projectileOverride: { travelSeconds: -1 } } : track,
    );
    const result = monsterFileTextFromStudy({
      archetypeId: "killer-bee-queen",
      study: { ...study, tracks },
      currentRawFile: AUTHORED_MONSTER_FILES["killer-bee-queen"],
      config,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("blue-bomb-ring-measured");
  });
});

describe("bombVariantOf", () => {
  const track = (id: string) => studyOf("killer-bee-queen").tracks.find((entry) => entry.id === id)!;

  test("is null without an override", () => {
    expect(bombVariantOf(track("blue-bomb-ring"))).toBeNull();
  });

  test("lays the override over the catalog bomb", () => {
    const variant = bombVariantOf({ ...track("blue-bomb-ring"), projectileOverride: { travelSeconds: 0.75, rangeTiles: 3 } });
    expect(variant?.id).toBe("blue-bomb-ring-measured");
    expect(variant?.entry).toMatchObject({
      type: "bomb",
      source: MEASURED_VARIANT_SOURCE,
      travelSeconds: 0.75,
      rangeTiles: 3,
      detonationRadiusTiles: 2,
    });
    expect(variant?.entry).not.toHaveProperty("id");
  });

  test("a targeted bomb's variant keeps the authored rangeTiles, even when an override names one", () => {
    // The game ignores a targeted bomb's range, but every bomb entry must carry one (user decision 2026-11-17).
    const targeted = track("white-bomb-targeted");
    const authoredRange = (AUTHORED_PROJECTILES[targeted.attack.projectile] as { rangeTiles: number }).rangeTiles;
    const variant = bombVariantOf({
      ...targeted,
      projectileOverride: { travelSeconds: 0.7, rangeTiles: authoredRange + 3 },
    });
    expect(variant?.entry.travelSeconds).toBe(0.7);
    expect(variant?.entry.rangeTiles).toBe(authoredRange);
  });
});

test("studyExportJson refreshes recordedAt", () => {
  const text = studyExportJson(studyOf("killer-bee-queen"), "2027-01-01T00:00:00.000Z");
  expect(JSON.parse(text).recordedAt).toBe("2027-01-01T00:00:00.000Z");
  expect(JSON.parse(text).schemaVersion).toBe(5);
});
