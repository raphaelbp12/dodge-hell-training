/**
 * Saved tagger sessions (plan V13 phase 45): the draft shape and validator,
 * the write decision, sticky restoration and a storage adapter over an
 * injected `Storage` accessor, following the `ZoomPreference` pattern. No
 * React or DOM here; the route owns wiring.
 */
import {
  validateMonsterDraft,
  validateSavedAttackLinks,
  validateSavedAttacks,
  validateStoredTag,
  type SavedAttack,
  type StudyState,
} from "./tagging";
import {
  appearanceOptions,
  OFFERABLE_PATTERNS,
  phaseOptions,
  TAG_AIMS,
  type StickySelection,
} from "./taggingOptions";
import type { EncounterConfig } from "../game/config/encounter";
import { studyV6FromV5, validateStudyV6, type StudyV6 } from "./study";

export const TAGGER_SESSION_KEY_PREFIX = "dodge-hell-training.tagger-session.";

/**
 * Plan V20 E14, plan V23 Q15: a version 5 draft carries a v6 study and the
 * selected track. A version 4 draft's v5 study converts on restore.
 */
export type SessionDraft = Readonly<{
  draftVersion: 5;
  /** ISO-8601 time of this write. */
  savedAt: string;
  study: StudyV6;
  selectedTrackId: string | null;
}>;

/** A draft written before plan V20; the route converts it with `studyV5FromLegacy`. */
export type LegacySessionDraft = Readonly<{
  /**
   * V16 S05: version 1 drafts upgrade on restore with no saved attacks.
   * V18: version 3 carries the study's monster and draft; older drafts are the
   * primary monster with none.
   */
  draftVersion: 3;
  /** ISO-8601 time of this write. */
  savedAt: string;
  study: StudyState;
  sticky: StickySelection;
}>;

/** The slice of `Storage` the adapter needs, so tests inject a fake. */
export type SessionStorage = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function reject(path: string, reason: string): never {
  throw new RangeError(`Session draft ${path} ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) reject(path, "must be an object");
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    reject(path, "must be a nonempty string");
  return value;
}

function positiveFinite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    reject(path, "must be a positive finite number");
  return value;
}

export function isLegacyDraft(
  draft: SessionDraft | LegacySessionDraft,
): draft is LegacySessionDraft {
  return draft.draftVersion !== 5;
}

/** Every mark on the study's tracks and scratch track. */
export function markCountOf(study: StudyV6): number {
  return study.tracks.reduce((sum, track) => sum + track.marks.length, study.scratch.length);
}

/**
 * Structural validation of a saved draft; throws on malformed input. Versions
 * 1-3 come back as a legacy draft for the route to convert (E14).
 */
export function validateSessionDraft(value: unknown): SessionDraft | LegacySessionDraft {
  const source = record(value, "");
  const version = source.draftVersion;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5)
    reject("draftVersion", "must be 1, 2, 3, 4 or 5");
  const savedAt = nonEmptyString(source.savedAt, "savedAt");
  if (Number.isNaN(Date.parse(savedAt))) reject("savedAt", "must be a date");
  if (version === 4 || version === 5) {
    // A version 4 draft carries a v5 study; it converts here (plan V23 Q15).
    const converted = version === 4 ? studyV6FromV5(source.study) : source.study;
    let study: StudyV6;
    try {
      if (version === 4 && record(source.study, "study").schemaVersion !== 5)
        reject("study.schemaVersion", "must be 5 in a version 4 draft");
      study = validateStudyV6(converted);
    } catch (cause) {
      reject("study", cause instanceof Error ? cause.message : String(cause));
    }
    if (source.selectedTrackId !== null) nonEmptyString(source.selectedTrackId, "selectedTrackId");
    return { ...(value as SessionDraft), draftVersion: 5, study };
  }
  const study = record(source.study, "study");
  nonEmptyString(study.encounterId, "study.encounterId");
  const provenance = record(study.provenance, "study.provenance");
  if (provenance.sourceUrl !== null && typeof provenance.sourceUrl !== "string")
    reject("study.provenance.sourceUrl", "must be a string or null");
  nonEmptyString(provenance.fileName, "study.provenance.fileName");
  if (provenance.frameRate !== null)
    positiveFinite(provenance.frameRate, "study.provenance.frameRate");
  positiveFinite(provenance.durationSeconds, "study.provenance.durationSeconds");
  if (!Array.isArray(study.tags)) reject("study.tags", "must be an array");
  const savedAttacks =
    version !== 1
      ? validateSavedAttacks(study.savedAttacks, "study.savedAttacks")
      : [];
  const tags = study.tags.map((entry, index) =>
    validateStoredTag(entry, `study.tags[${index}]`),
  );
  validateSavedAttackLinks(tags, savedAttacks, "study.tags");
  if (version === 3) {
    if (study.archetypeId !== null)
      nonEmptyString(study.archetypeId, "study.archetypeId");
    if (study.monsterDraft !== null)
      validateMonsterDraft(study.monsterDraft, "study.monsterDraft");
  }
  const sticky = record(source.sticky, "sticky");
  if (
    typeof sticky.phaseIndex !== "number" ||
    !Number.isInteger(sticky.phaseIndex) ||
    sticky.phaseIndex < 0
  )
    reject("sticky.phaseIndex", "must be a nonnegative integer");
  nonEmptyString(sticky.spriteId, "sticky.spriteId");
  if (!OFFERABLE_PATTERNS.includes(sticky.pattern as never))
    reject("sticky.pattern", "must be an offerable pattern");
  if (!TAG_AIMS.includes(sticky.aim as never))
    reject("sticky.aim", "must be player, fixed or front");
  const shots = positiveFinite(sticky.shots, "sticky.shots");
  if (!Number.isInteger(shots)) reject("sticky.shots", "must be an integer");
  // Plan V15 N35: typed-geometry choices are optional and absent in older drafts.
  if (
    sticky.armPattern !== undefined &&
    !["spread", "scatter", "ring"].includes(sticky.armPattern as string)
  )
    reject("sticky.armPattern", "must be spread, scatter or ring");
  if (sticky.shotsPerArm !== undefined) {
    const perArm = positiveFinite(sticky.shotsPerArm, "sticky.shotsPerArm");
    if (!Number.isInteger(perArm)) reject("sticky.shotsPerArm", "must be an integer");
  }
  if (sticky.armArcDegrees !== undefined) {
    const arc = sticky.armArcDegrees;
    if (typeof arc !== "number" || !Number.isFinite(arc) || arc < 0)
      reject("sticky.armArcDegrees", "must be a nonnegative finite number");
  }
  for (const field of ["clockwiseDegreesPerSecond", "initialPhaseDegrees"] as const) {
    const typed = sticky[field];
    if (typed !== undefined && (typeof typed !== "number" || !Number.isFinite(typed)))
      reject(`sticky.${field}`, "must be a finite number");
  }
  if (sticky.savedAttackId !== undefined)
    nonEmptyString(sticky.savedAttackId, "sticky.savedAttackId");
  if (version === 3) return value as LegacySessionDraft;
  return {
    ...(value as Record<string, unknown>),
    draftVersion: 3,
    study: {
      ...study,
      savedAttacks,
      archetypeId: null,
      monsterDraft: null,
    },
  } as unknown as LegacySessionDraft;
}

/** E14: the draft built from the live session at write time. */
export function buildDraft(input: {
  study: StudyV6;
  selectedTrackId: string | null;
  savedAt: string;
}): SessionDraft {
  return {
    draftVersion: 5,
    savedAt: input.savedAt,
    study: input.study,
    selectedTrackId: input.selectedTrackId,
  };
}

/**
 * Z30, amended by E14: a slot is written only after an edit (dirty) and only
 * while the study holds a mark or a boundary, so removing the last one keeps
 * the slot.
 */
export function shouldWriteDraft(input: {
  dirty: boolean;
  markCount: number;
  boundaryCount: number;
}): boolean {
  return input.dirty && (input.markCount > 0 || input.boundaryCount > 0);
}

export type SessionNotice =
  | "sprite-missing"
  | "phase-missing"
  | "attack-missing";

/**
 * Z33: a restored sticky value naming a missing sprite or phase falls back to
 * the tagger's normal default, with a notice. Tags are never touched.
 */
export function restoreSticky(
  sticky: StickySelection,
  config: EncounterConfig,
  archetypeId: string,
  savedAttacks: readonly SavedAttack[] = [],
): { sticky: StickySelection; notices: readonly SessionNotice[] } {
  const notices: SessionNotice[] = [];
  let { spriteId, phaseIndex } = sticky;
  if (!appearanceOptions().some((option) => option.id === spriteId)) {
    spriteId = appearanceOptions()[0].id;
    notices.push("sprite-missing");
  }
  if (!phaseOptions(config, archetypeId).some((phase) => phase.index === phaseIndex)) {
    phaseIndex = 0;
    notices.push("phase-missing");
  }
  const restored: { -readonly [K in keyof StickySelection]: StickySelection[K] } = {
    ...sticky,
    spriteId,
    phaseIndex,
  };
  if (
    sticky.savedAttackId !== undefined &&
    !savedAttacks.some((attack) => attack.id === sticky.savedAttackId)
  ) {
    delete restored.savedAttackId;
    notices.push("attack-missing");
  }
  return { sticky: restored, notices };
}

export type SessionListEntry =
  | Readonly<{
      readable: true;
      key: string;
      fileName: string;
      /** Null is the primary monster (L33). */
      archetypeId: string | null;
      /** Marks over tracks and scratch; a legacy draft's tag count. */
      markCount: number;
      savedAt: string;
    }>
  | Readonly<{ readable: false; key: string }>;

export type SessionResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: string }>;

function failure(cause: unknown): { ok: false; error: string } {
  return {
    ok: false,
    error: cause instanceof Error ? cause.message : String(cause),
  };
}

export class TaggerSessions {
  private storage: SessionStorage | null = null;
  private unavailable: string | null = null;

  constructor(getStorage: () => SessionStorage) {
    try {
      this.storage = getStorage();
    } catch (cause) {
      this.unavailable = failure(cause).error;
    }
  }

  /**
   * One slot per video file name and monster (Z28, amended by L33): the
   * primary monster keeps today's key, a minion's adds its archetype id.
   */
  static keyFor(fileName: string, minionArchetypeId?: string | null): string {
    const base = `${TAGGER_SESSION_KEY_PREFIX}${fileName}`;
    return minionArchetypeId ? `${base}#${minionArchetypeId}` : base;
  }

  private guard<T>(action: (storage: SessionStorage) => T): SessionResult<T> {
    if (!this.storage)
      return { ok: false, error: this.unavailable ?? "Storage is unavailable." };
    try {
      return { ok: true, value: action(this.storage) };
    } catch (cause) {
      return failure(cause);
    }
  }

  list(): SessionResult<readonly SessionListEntry[]> {
    return this.guard((storage) => {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null && key.startsWith(TAGGER_SESSION_KEY_PREFIX))
          keys.push(key);
      }
      return keys.sort().map((key): SessionListEntry => {
        try {
          const text = storage.getItem(key);
          if (text === null) return { readable: false, key };
          const draft = validateSessionDraft(JSON.parse(text));
          return {
            readable: true,
            key,
            fileName: draft.study.provenance.fileName,
            archetypeId: draft.study.archetypeId,
            markCount: isLegacyDraft(draft)
              ? draft.study.tags.length
              : markCountOf(draft.study),
            savedAt: draft.savedAt,
          };
        } catch {
          return { readable: false, key };
        }
      });
    });
  }

  read(key: string): SessionResult<SessionDraft | LegacySessionDraft> {
    return this.guard((storage) => {
      const text = storage.getItem(key);
      if (text === null) throw new Error("The saved session is missing.");
      return validateSessionDraft(JSON.parse(text));
    });
  }

  /** `primaryArchetypeId` lets the primary monster keep today's slot (L33). */
  write(draft: SessionDraft, primaryArchetypeId?: string): SessionResult<string> {
    return this.guard((storage) => {
      const { archetypeId } = draft.study;
      const key = TaggerSessions.keyFor(
        draft.study.provenance.fileName,
        archetypeId === primaryArchetypeId ? null : archetypeId,
      );
      storage.setItem(key, JSON.stringify(draft));
      return key;
    });
  }

  discard(key: string): SessionResult<null> {
    return this.guard((storage) => {
      storage.removeItem(key);
      return null;
    });
  }
}
