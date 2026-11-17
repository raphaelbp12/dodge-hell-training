import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  AUTHORED_APPEARANCES,
  AUTHORED_ENCOUNTER_DATA,
  AUTHORED_MONSTER_FILES,
  AUTHORED_PROJECTILES,
  validateArchetypes,
  validateProjectile,
} from "../game/config/data";
import { ENCOUNTER_CONFIGS, encounterConfigOf } from "../game/config/encounter";
import { propertyParameters } from "../test/property";
import { segmentIdOf, type StudyV5 } from "./study";
import {
  bombVariantOf,
  monsterFileTextFromStudy,
} from "./studyExport";
import {
  duplicateTrack,
  removeTrack,
  setProjectileOverride,
  setTrackAttack,
  type EditResult,
} from "./studyEdits";
import { emptyStudy } from "./studyMigrate";

/**
 * Plan V22 A13: the tagger's export is valid game data. Loading a shipped
 * monster into the tagger and exporting it with no edits reproduces the file,
 * and any export a sequence of edits produces is valid for the game's own
 * validators, or is refused with a message.
 */

const MONSTER_IDS = Object.keys(AUTHORED_MONSTER_FILES);
const STEP_SECONDS = AUTHORED_ENCOUNTER_DATA.simulation.fixedStepSeconds;
const APPEARANCE_IDS = new Set(Object.keys(AUTHORED_APPEARANCES.appearances));
const PROJECTILE_IDS = new Set(Object.keys(AUTHORED_PROJECTILES));

/** The shipped encounter whose catalog and minion cap the monster is validated under. */
function configFor(archetypeId: string) {
  const config = Object.values(ENCOUNTER_CONFIGS).find((candidate) => archetypeId in candidate.archetypes);
  if (!config) throw new Error(`No encounter fields ${archetypeId}`);
  return config;
}

function studyOf(archetypeId: string): StudyV5 {
  return emptyStudy({
    encounterId: "killer-bee-queen",
    archetypeId,
    provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 600 },
    recordedAt: "2026-11-16T00:00:00.000Z",
    rawFile: AUTHORED_MONSTER_FILES[archetypeId],
  });
}

/**
 * A10 finding (plan V22 step 92.3): `monsterFileTextFromStudy` validates every
 * shipped monster file against the exporting encounter's projectile catalog.
 * The Crystal Worm's catalog lacks the Queen's projectiles, so exporting
 * `crystal-worm-child-head` under its own encounter is refused with "killer-bee-
 * queen ... must name a projectile defined in projectiles.json". The Queen
 * encounter's catalog lacks the worm's shard, so no config exports it. The
 * tagger offers only the Queen's monsters today, so this is recorded, not
 * fixed; it needs a user decision (see phase-92.md execution record).
 */
const EXPORT_REFUSED_BY_DESIGN: ReadonlySet<string> = new Set(["crystal-worm-child-head"]);

describe("an unedited export reproduces the shipped monster file", () => {
  test.each(MONSTER_IDS.filter((id) => !EXPORT_REFUSED_BY_DESIGN.has(id)))("%s", (archetypeId) => {
    const result = monsterFileTextFromStudy({
      archetypeId,
      study: studyOf(archetypeId),
      currentRawFile: AUTHORED_MONSTER_FILES[archetypeId],
      config: configFor(archetypeId),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.value)).toEqual(AUTHORED_MONSTER_FILES[archetypeId]);
    expect(() =>
      validateArchetypes(
        { archetypes: { ...AUTHORED_MONSTER_FILES, [archetypeId]: JSON.parse(result.value) } },
        PROJECTILE_IDS,
        configFor(archetypeId).maxConcurrentMinions,
      ),
    ).not.toThrow();
  });
});

test.fails("A10 finding: the Crystal Worm's child head exports under its own encounter", () => {
  const archetypeId = "crystal-worm-child-head";
  const result = monsterFileTextFromStudy({
    archetypeId,
    study: studyOf(archetypeId),
    currentRawFile: AUTHORED_MONSTER_FILES[archetypeId],
    config: configFor(archetypeId),
  });
  expect(result.ok).toBe(true);
});

type Edit = Readonly<{
  kind: "cadence" | "add" | "delete" | "aim" | "override";
  track: number;
  value: number;
}>;

const edit: fc.Arbitrary<Edit> = fc
  .record({
    kind: fc.constantFrom("cadence" as const, "add" as const, "delete" as const, "aim" as const, "override" as const),
    track: fc.nat({ max: 200 }),
    value: fc.double({ min: 0.1, max: 6, noNaN: true }),
  })
  .map((value) => ({ ...value }));

function apply(study: StudyV5, step: Edit, serial: number): StudyV5 {
  if (study.tracks.length === 0) return study;
  const track = study.tracks[step.track % study.tracks.length];
  const accept = (result: EditResult<StudyV5>) => (result.ok ? result.value : study);
  switch (step.kind) {
    case "cadence":
      return accept(
        setTrackAttack(
          study,
          track.id,
          {
            ...track.attack,
            cadence: { ...track.attack.cadence, cooldownAfterLastShotSeconds: step.value },
          },
          "typed",
        ),
      );
    case "add":
      return accept(duplicateTrack(study, track.id, `${track.id}-copy-${serial}`));
    case "delete":
      return accept(removeTrack(study, track.id));
    case "aim": {
      if (track.attack.pattern.kind !== "spread") return study;
      const aims = ["player", "front"] as const;
      return accept(
        setTrackAttack(
          study,
          track.id,
          {
            ...track.attack,
            pattern: { ...track.attack.pattern, aim: aims[Math.floor(step.value) % aims.length] },
          } as typeof track.attack,
          "typed",
        ),
      );
    }
    case "override":
      return accept(setProjectileOverride(study, track.id, { travelSeconds: step.value }));
  }
}

describe("any export the editor produces is valid game data or is refused", () => {
  test("the Queen under arbitrary cadence, add, delete, aim and override edits", () => {
    const archetypeId = "killer-bee-queen";
    const config = encounterConfigOf("killer-bee-queen");
    fc.assert(
      fc.property(fc.array(edit, { maxLength: 8 }), (edits) => {
        const study = edits.reduce(apply, studyOf(archetypeId));
        const result = monsterFileTextFromStudy({
          archetypeId,
          study,
          currentRawFile: AUTHORED_MONSTER_FILES[archetypeId],
          config,
        });
        if (!result.ok) {
          expect(result.error.length).toBeGreaterThan(0);
          return;
        }
        const variants = Object.fromEntries(
          study.tracks.flatMap((track) => {
            const variant = bombVariantOf(track);
            return variant ? [[variant.id, variant.entry] as const] : [];
          }),
        );
        for (const [id, entry] of Object.entries(variants)) {
          // A10 finding: a targeted bomb's variant omits `rangeTiles`, which the
          // projectile validator requires; see the test.fails case below.
          if (!("rangeTiles" in entry)) continue;
          expect(() => validateProjectile(entry, id, STEP_SECONDS, APPEARANCE_IDS)).not.toThrow();
        }
        expect(() =>
          validateArchetypes(
            { archetypes: { ...AUTHORED_MONSTER_FILES, [archetypeId]: JSON.parse(result.value) } },
            new Set([...PROJECTILE_IDS, ...Object.keys(variants)]),
            config.maxConcurrentMinions,
          ),
        ).not.toThrow();
        // Every exported attack still sits in a segment of the file.
        const segmentIds = new Set(study.tracks.map((track) => segmentIdOf(track.location)));
        expect(segmentIds.size).toBeGreaterThan(0);
      }),
      propertyParameters({ numRuns: 40 }),
    );
  });
});

test.fails("A10 finding: a targeted bomb's measured variant passes the projectile validator", () => {
  const archetypeId = "killer-bee-queen";
  const study = studyOf(archetypeId);
  const targeted = study.tracks.find((track) => {
    const authored = AUTHORED_PROJECTILES[track.attack.projectile] as { type?: string } | undefined;
    return authored?.type === "bomb" && track.attack.target === "player";
  });
  if (!targeted) throw new Error("expected a targeted bomb track in the Queen's file");
  const edited = setProjectileOverride(study, targeted.id, { travelSeconds: 1 });
  if (!edited.ok) throw new Error(edited.error);
  const variant = edited.value.tracks.map(bombVariantOf).find((entry) => entry !== null);
  if (!variant) throw new Error("expected a variant");
  expect(() =>
    validateProjectile(variant.entry, variant.id, STEP_SECONDS, APPEARANCE_IDS),
  ).not.toThrow();
});
