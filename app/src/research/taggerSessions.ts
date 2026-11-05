/**
 * Saved tagger sessions (plan V13 phase 45): the draft shape and validator,
 * the write decision, sticky restoration and a storage adapter over an
 * injected `Storage` accessor, following the `ZoomPreference` pattern. No
 * React or DOM here; the route owns wiring.
 */
import {
  validateTag,
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

export const TAGGER_SESSION_KEY_PREFIX = "dodge-hell-training.tagger-session.";

export type SessionDraft = Readonly<{
  draftVersion: 1;
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

/** Structural validation of a saved draft; throws on malformed input. */
export function validateSessionDraft(value: unknown): SessionDraft {
  const source = record(value, "");
  if (source.draftVersion !== 1) reject("draftVersion", "must be 1");
  const savedAt = nonEmptyString(source.savedAt, "savedAt");
  if (Number.isNaN(Date.parse(savedAt))) reject("savedAt", "must be a date");
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
  study.tags.forEach((entry, index) =>
    validateTag(entry, `study.tags[${index}]`),
  );
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
    reject("sticky.aim", "must be player or fixed");
  const shots = positiveFinite(sticky.shots, "sticky.shots");
  if (!Number.isInteger(shots)) reject("sticky.shots", "must be an integer");
  return value as SessionDraft;
}

/** Z28/Z30: the draft built from the live session at write time. */
export function buildDraft(input: {
  study: StudyState;
  sticky: StickySelection;
  savedAt: string;
}): SessionDraft {
  return {
    draftVersion: 1,
    savedAt: input.savedAt,
    study: input.study,
    sticky: input.sticky,
  };
}

/**
 * Z30: a slot is written only after a first tag or edit (dirty) and only while
 * the session holds at least one tag, so deleting the last tag keeps the slot.
 */
export function shouldWriteDraft(input: {
  dirty: boolean;
  tagCount: number;
}): boolean {
  return input.dirty && input.tagCount > 0;
}

export type SessionNotice = "sprite-missing" | "phase-missing";

/**
 * Z33: a restored sticky value naming a missing sprite or phase falls back to
 * the tagger's normal default, with a notice. Tags are never touched.
 */
export function restoreSticky(
  sticky: StickySelection,
  config: EncounterConfig,
): { sticky: StickySelection; notices: readonly SessionNotice[] } {
  const notices: SessionNotice[] = [];
  let { spriteId, phaseIndex } = sticky;
  if (!appearanceOptions().some((option) => option.id === spriteId)) {
    spriteId = appearanceOptions()[0].id;
    notices.push("sprite-missing");
  }
  if (!phaseOptions(config).some((phase) => phase.index === phaseIndex)) {
    phaseIndex = 0;
    notices.push("phase-missing");
  }
  return { sticky: { ...sticky, spriteId, phaseIndex }, notices };
}

export type SessionListEntry =
  | Readonly<{
      readable: true;
      key: string;
      fileName: string;
      tagCount: number;
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

  /** One slot per video file name (Z28). */
  static keyFor(fileName: string): string {
    return `${TAGGER_SESSION_KEY_PREFIX}${fileName}`;
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
            tagCount: draft.study.tags.length,
            savedAt: draft.savedAt,
          };
        } catch {
          return { readable: false, key };
        }
      });
    });
  }

  read(key: string): SessionResult<SessionDraft> {
    return this.guard((storage) => {
      const text = storage.getItem(key);
      if (text === null) throw new Error("The saved session is missing.");
      return validateSessionDraft(JSON.parse(text));
    });
  }

  write(draft: SessionDraft): SessionResult<string> {
    return this.guard((storage) => {
      const key = TaggerSessions.keyFor(draft.study.provenance.fileName);
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
