# Custom Monsters And Encounters - Draft Plan

Status: **draft, not approved, not registered.** This file is the input to a later `/brainstorm`. That run settles the open decisions below, assigns the plan number (the next free one is V23), the phase numbers (the next free one is 97) and a decision prefix, and adds the row to `implementation-plan.md`. Nothing here may be implemented until then. Process rules live in [`implementation-plan.md`](../implementation-plan.md) and [`AGENTS.md`](../AGENTS.md).

## Goal

1. A file the tagger produces can be used as a monster definition directly, with no hand edits.
2. A player without the source code can add monsters and encounters to their game in the browser.
3. Players can share monsters and encounters with each other as files, without changing any code.

Implementation starts with behaviour tests for these three features (phase A below), before any production code.

## What exists today

These facts come from the code as of 2026-11-18. The plan reuses them; it does not replace them.

- **The tagger already builds a whole monster file.** `monsterFileTextFromStudy` (`app/src/research/studyExport.ts`) rewrites the monster's file from the tracks and validates it with the game's own `validateArchetypes`, `validateProjectile` and `validateAttackSpec`. `ReconcilePanel` shows it in a copy box, which a person pastes over `app/src/game/data/enemies/<id>.json` (L23).
- **The tagger's file is not self-contained.** A measured bomb track exports a projectile variant (`bombVariantOf`, id `<track>-measured`) that must be pasted into `projectiles.json` separately. The monster file references it by id, so the monster file alone fails validation.
- **A new monster file is not picked up automatically.** `AUTHORED_MONSTER_FILES` (`app/src/game/config/data.ts:2053`) is a hand-written import list.
- **A shipped data change also needs a `rulesVersion` bump and a `rules-fingerprint.json` update** (plan V22 A12).
- **All game data is compiled in and frozen at module load.** `ENCOUNTER_CONFIGS`, `ENCOUNTER_LIST`, `STATIC_ARCHETYPES` and `STATIC_PROJECTILES` (`app/src/game/config/encounter.ts:1056-1135`) are module constants. `History.tsx` builds `KNOWN_ENCOUNTERS` once, at import. Nothing reads game data at runtime.
- **The building blocks for runtime data already exist and are pure:** `validateArchetypes`, `validateProjectile`, `validateEncounterEntry` (not yet exported), `archetypeFromAuthored`, `projectileFromAuthored`, `buildStaticEncounterConfig` (reads module constants today), `validateEncounterConfig`, `liveShardBoundForEncounter` and `monstersOfEncounter`.
- **Persistence pattern:** `AttemptHistory` (`app/src/storage/attempts.ts`) wraps `localStorage` with a schema version, rejects an unrecognised value and falls back to visit-only mode with a warning. Attempts are keyed by `rulesVersion`.
- **Lazy route pattern:** the tagger is a lazily loaded chunk behind `?tagger=1` (`app/src/main.tsx`, plan V21 B01).
- **Download pattern:** the tagger's study export already downloads a JSON file through a Blob URL.

## Conflicts with recorded decisions

These decisions stand today. The plan cannot proceed until the user re-opens each one explicitly.

| Recorded rule | Where | Conflict |
| --- | --- | --- |
| "A tuning UI" is out of scope | `AGENTS.md`, Scope and design | A page whose monsters and encounters the running game plays is, by the current wording, a tuning UI. |
| L01: the tagger editor is allowed because "the running game never reads" its output | plan V18 | The game would now read tagger output, through the player's own content. |
| L23: tagger export is a copy box; nothing is written to disk | plan V18 | Goal 1 wants a file, and possibly a save into the player's content. |
| D39: editing phase, sub-phase and monster-level values in the tagger | deferred register | Creating a genuinely new monster needs health, phases, movement and body. |
| D40: editing the projectile catalog | deferred register | A custom monster may need its own projectile values. |

"A backend" and "accounts" stay out of scope. Sharing by file needs neither.

## Open decisions

Each entry gives two options and a recommendation. The recommended option is the smaller one unless a reason is stated.

1. **Re-open the tuning-UI exclusion for player content.** (a) Allow it: the game plays player-made content that lives only in the player's browser and in files the player shares. Shipped encounters, their data and their fingerprints never change. `AGENTS.md` gains one clarifying sentence. (b) Keep the exclusion and drop goals 2 and 3. *Recommended: (a), because goals 2 and 3 are the request.*
2. **What the tagger produces (goal 1).** (a) A downloadable *content pack* file (shape below) holding the monster and its measured projectile variants. The content page imports it, and it is the same format players share. The copy box for the repository file stays as it is. (b) A repository-ready monster file with its variants inlined into the monster's own JSON. This changes the shipped monster schema and still needs a `rulesVersion` bump and a fingerprint update. *Recommended: (a), because one format serves the tagger, the page and sharing, and shipped data does not change.*
3. **Does the tagger write into the player's content (re-open L23)?** (a) No: the tagger only downloads the pack, and the player imports it on the content page. (b) Yes: a "Save to my monsters" button writes into the player's content store. *Recommended: (a). It needs no new tagger-to-storage path, and L23 changes only from "copy box" to "copy box plus download".*
4. **How a new monster comes to exist.** (a) Import a pack, or duplicate an existing monster under a new id and display name, then correct its attacks in the tagger. D39 and D40 stay deferred. (b) Promote D39 and build a form editor for health, phases, movement, body and contact values. *Recommended: (a), because (b) is a large editor. Its limit is that a new monster keeps the phase structure, health and body of the monster it was copied from until D39 is promoted.*
5. **Custom projectiles.** (a) A pack may carry projectile entries, validated by `validateProjectile`, which may only reference existing appearances and shapes. In practice these are the tagger's measured bomb variants. (b) None: packs may only reference shipped projectiles. *Recommended: (a), because without it a tagged bomb monster cannot travel as a file, which breaks goal 1.*
6. **What the encounter editor sets.** (a) Display name, primary monster (shipped or custom), shipped arena, spawn rule (`farthest-from-player` or `arena-center`) and spawn timing. Session values are copied from the shipped defaults. Player, simulation, camera and arenas are not editable. (b) Also custom arenas and session values. *Recommended: (a).*
7. **Sharing mechanism.** (a) Download and upload of the pack file only. (b) Also a share link that encodes the pack in the URL. *Recommended: (a). A link is a convenience with URL length limits.*
8. **Id collisions.** (a) A custom id may not equal any shipped monster, projectile or encounter id, and an import that tries is refused. Importing an id that already exists in the player's content replaces it after an in-page confirmation. (b) Prefix every imported id with a namespace. *Recommended: (a), because a namespace rewrites every reference inside the pack.*
9. **History identity of a custom encounter.** (a) `rulesVersion` is `custom-<encounterId>-<first 12 hex of the SHA-256 of the canonical encounter, monsters and projectiles>`. Editing any part starts a new history identity automatically, as a shipped `rulesVersion` bump does. (b) A user-typed version string. *Recommended: (a), because players cannot be relied on to bump a version.*
10. **Safety limits on imported files**, which are untrusted input. (a) Refuse a pack whose `liveShardBoundForEncounter` exceeds the largest bound among the shipped encounters (derived from existing data, not invented), and refuse a file over a size cap. The cap's value needs user approval before it becomes a named constant. (b) No limits. *Recommended: (a), because a hostile or careless pack must not freeze a player's browser.*
11. **How the first-written behaviour tests stay in CI.** (a) Phase A lands the tests marked as expected to fail (Vitest `it.fails`, Playwright `test.fail()`), each with a comment naming the phase that will make it pass. Each later phase removes the marker from the tests it makes pass, and an unexpected pass fails CI. `AGENTS.md` reserves `test.fails` for findings (plan V22 A10), so this use needs approval and a one-line exemption there. (b) Phase A's tests live on a feature branch and only merge with the phases that make them pass. *Recommended: (a), because the tests are reviewable on `main` from the start.*
12. **Where the content page lives.** (a) A lazily loaded route, `?content=1`, linked from Home, following the tagger's B01 pattern. (b) A section of the Home screen. *Recommended: (a), so players who never use it download nothing extra.*

## Proposed design

This section assumes the recommended options. It changes if the decisions differ.

### Content pack shape

```json
{
  "format": "dodge-content-pack",
  "schemaVersion": 1,
  "monsters": { "<monsterId>": { "...": "the same shape as app/src/game/data/enemies/<id>.json" } },
  "projectiles": { "<projectileId>": { "...": "the same shape as a projectiles.json entry" } },
  "encounters": {
    "<encounterId>": {
      "displayName": "string",
      "primaryArchetype": "<shipped or pack monster id>",
      "arenaId": "<shipped arena id>",
      "spawns": { "...": "the same shape as an encounter.json entry's spawns" }
    }
  }
}
```

- The game's monster and projectile shapes are reused unchanged (L02: one model, no new shared format for behaviour). Only the envelope and the encounter subset are new.
- Every id matches `^[a-z0-9][a-z0-9-]*$`. This refuses `__proto__`-style keys and path characters at the boundary.
- A pack is validated by the game's existing validators, with shipped monsters and projectiles visible as references. Validation never coerces, and it reports the validator's JSON path unchanged, as the tagger's export already does.
- An exported encounter pack includes every custom monster `monstersOfEncounter` reaches and every custom projectile those monsters use, so it plays in a clean browser.

### Module changes (smallest path)

| Area | Change | Boundary note |
| --- | --- | --- |
| `game/config/data.ts` | Export `validateEncounterEntry`'s spawn part, and add a pure `validateContentPack(value)` that composes the existing validators. | Core stays free of storage and DOM (plan V22 A01). |
| `game/config/encounter.ts` | Turn `buildStaticEncounterConfig(entryId)` into a function of `(entry, archetypes, projectiles)`. The shipped constants call it as before, so shipped configs stay deep-equal. Add `customEncounterConfigs(pack)`. | No gameplay data change, so no `rulesVersion` bump and no fingerprint change. |
| `storage/customContent.ts` | New adapter in the `AttemptHistory` pattern: one key, a schema version, refusal of unrecognised values and a visit-only fallback with a warning. | `storage/` must not import React or Phaser (A01). |
| `App.tsx`, `History.tsx` | The encounter list and `KNOWN_ENCOUNTERS` become shipped plus custom, read once at startup and after each change on the content page. Custom encounters are grouped and labelled as player-made, with no fidelity claim. | `encounterConfigOf`'s 70 callers keep working for shipped ids. |
| New `content/ContentRoute.tsx` | Import, list, delete, duplicate a monster, create and edit an encounter, and export a pack. | It must not import `research/` unless decision 3 changes. |
| `research/studyExport.ts`, `ReconcilePanel.tsx` | Add `contentPackFromStudy`, which reuses `monsterFileTextFromStudy` and `bombVariantOf`, plus a "Download as content pack" button beside the copy box. | `taggingConfigOf` also needs custom monsters, so a duplicated monster can be tagged. |

No changes are needed to `simulation.ts`, `projectiles.ts`, `bombs.ts`, `geometry.ts` or Phaser. The benchmark gate does not apply. `data.ts` and `encounter.ts` are probably in the Stryker mutate globs, so each phase that touches them hands `npm run test:mutation:diff` to the verifier.

## Phases

The numbers are placeholders. `/brainstorm` assigns 97 onwards.

### Phase A - Behaviour tests first

Write every test below before any production code. Each test is marked as decided in decision 11 and names the phase that makes it pass. Tests sit at three levels: pure Vitest for packs and configs, React Testing Library flows for the pages (in the style of `TaggerRoute.flows.test.tsx`), and one Playwright golden path in `app/tests/`.

**Tagger output (goal 1)**

- T1. A study of a monster with no bomb variant downloads a pack that `validateContentPack` accepts, and its monster equals `monsterFileTextFromStudy`'s output.
- T2. A study with a measured bomb track downloads a pack that contains the `-measured` projectile. The imported monster's attack resolves to that projectile in the built config.
- T3. A pack downloaded from the tagger imports on the content page with no edits, and its monster appears in the list (RTL flow).
- T4. The existing copy box text is unchanged (characterisation of the current behaviour).

**Adding content in the browser (goal 2)**

- C1. Importing a valid pack lists its monsters and encounters, and they are still there after a reload (storage round trip).
- C2. An invalid pack is refused with the validator's JSON path in the message, and nothing is stored.
- C3. A pack that reuses a shipped monster, projectile or encounter id is refused.
- C4. Re-importing an id the player already has asks for confirmation, then replaces it.
- C5. Duplicating a shipped monster under a new id creates a custom monster that the tagger can open.
- C6. Creating an encounter with a chosen monster, arena and spawn rule adds it to the Home encounter list.
- C7. A custom encounter starts, plays and records an attempt under its derived `rulesVersion`. History labels it with its display name.
- C8. Changing a custom monster changes its encounter's `rulesVersion`, so older attempts are not compared with new ones.
- C9. Deleting a monster that a custom encounter still uses is refused, or flags the encounter, whichever `/brainstorm` settles.
- C10. With storage unavailable, the page warns and the content works for the visit only.
- C11. A pack over the live-shard limit or the file size cap is refused.
- C12. Every shipped encounter config is deep-equal to its value before this plan, and `rules-fingerprint.json` is unchanged.

**Sharing (goal 3)**

- S1. Exporting a custom encounter produces a pack with the encounter, every custom monster it reaches and every custom projectile they use.
- S2. That pack, imported into an empty store, builds a config deep-equal to the original's. The same seed then gives the same simulation state after a fixed number of steps (determinism).
- S3. Playwright golden path: import a pack file, start its encounter from Home, survive the countdown, and see the encounter's display name in History.

Acceptance: every test exists, fails for the stated reason (not a typo or a missing import), and is marked so CI stays green.

### Phase B - Content pack model (pure)

`validateContentPack`, the id rule, the collision rule, the derived `rulesVersion`, `customEncounterConfigs`, the refactored `buildStaticEncounterConfig` and the safety limits. Removes the markers from T1-T2 (pack half), C2, C3, C8, C11, C12, S1 and S2.

### Phase C - Storage adapter

`storage/customContent.ts`. Removes the markers from C1 (storage half) and C10.

### Phase D - The game plays custom encounters

The Home list, `App` selection, History labels and drill selection for custom encounters. Removes the markers from C6 (list half), C7 and S3.

### Phase E - Content page

Import, list, replace, delete, duplicate, encounter editor and export. Removes the markers from C1, C4, C5, C6 and C9.

### Phase F - Tagger download and custom monsters in the tagger

`contentPackFromStudy`, the download button and `taggingConfigOf` with custom monsters. Removes the markers from T1-T4 and C5 (tagger half).

## Not in this plan

- A server, gallery, accounts or share links (decision 7).
- Form editing of health, phases, movement or body (D39), and editing shipped projectiles (D40), unless decision 4 promotes them.
- Custom arenas, appearances, shapes or sprites.
- Adding custom content to the shipped game. A maintainer still adds shipped monsters by hand, with the `rulesVersion` bump and fingerprint update.
- Debug-panel tuning of custom encounters. The panel stays hardwired to the Crystal Worm (K12).

## Risks

- **Untrusted files.** Every imported pack is hostile until validated. The validators must run on the whole pack before anything is stored, and the limits in decision 10 must hold, or one shared file can lock up a player's tab.
- **`localStorage` quota.** Large packs can hit the browser's quota. The adapter must report a failed save instead of losing content silently.
- **Hidden module-level assumptions.** Constants such as `KNOWN_ENCOUNTERS`, and `boundedRecords`' use of the Crystal Worm's `historyLimit`, assume a fixed encounter set. Phase D must find each one, not only the ones listed here.
- **`phaseLabel` expects `phase-<n>` ids.** A duplicated monster keeps valid ids. A hand-written pack may not, so the label needs a fallback, or the id rule needs to require that pattern.
