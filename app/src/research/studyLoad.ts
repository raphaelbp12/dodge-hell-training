/**
 * Pure study-file parsing and the load/video-choice decisions for the
 * tagger (plan V13 phase 44). No React, DOM or video API here.
 */
import {
  studyFromExport,
  validateObservationExport,
  type StudyState,
  type VideoProvenance,
} from "./tagging";

/**
 * Z19: parses and validates a study file. Throws a readable error for invalid
 * JSON, an invalid shape or an unknown encounter. The encounter check lives
 * here, not in the validator (T31); sprites and phases are never checked (Z18).
 */
export function parseStudyFile(
  text: string,
  knownEncounterIds: readonly string[],
): StudyState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The study file is not valid JSON.");
  }
  let study: StudyState;
  try {
    study = studyFromExport(validateObservationExport(parsed));
  } catch (cause) {
    throw new Error(
      `The study file is not a valid study: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
  if (!knownEncounterIds.includes(study.encounterId))
    throw new Error(`Unknown encounter "${study.encounterId}".`);
  return study;
}

/** Z17: replacing existing tags needs an inline confirmation first. */
export function loadDecision(tagCount: number, hasDraft = false): "apply" | "confirm" {
  return tagCount > 0 || hasDraft ? "confirm" : "apply";
}

/**
 * Z15: the first video chosen after a load or restore keeps the tags. A later
 * choice with tags present confirms, then resets; with no tags it resets.
 */
export function videoChoiceDecision(input: {
  tagCount: number;
  keepTagsOnNextVideo: boolean;
  /** V18: a draft is content to confirm, as tags are. */
  hasDraft?: boolean;
}): "keep" | "confirm-reset" | "reset" {
  if (input.keepTagsOnNextVideo) return "keep";
  return input.tagCount > 0 || input.hasDraft ? "confirm-reset" : "reset";
}

/** V16 S19: changing encounter asks whenever tags or saved attacks would be cleared. */
export function encounterChangeDecision(input: {
  tagCount: number;
  savedAttackCount: number;
  hasDraft?: boolean;
}): "change" | "confirm" {
  return input.tagCount > 0 || input.savedAttackCount > 0 || input.hasDraft
    ? "confirm"
    : "change";
}

/** Z16: warn, never block, when the study and the open video differ by name. */
export function fileNameMismatch(
  studyFileName: string | null,
  videoFileName: string | null,
): boolean {
  return (
    studyFileName !== null &&
    videoFileName !== null &&
    studyFileName !== videoFileName
  );
}

/**
 * Z14/Z16/Z26: provenance for export. An open video supplies `fileName` and
 * `durationSeconds`; otherwise the study's stored values are used. The source
 * URL is the typed or loaded one. A blank presented frame rate blocks export.
 */
export function resolveProvenance(input: {
  video: Readonly<{ fileName: string; durationSeconds: number }> | null;
  study: Readonly<{ fileName: string; durationSeconds: number }> | null;
  sourceUrlText: string;
  frameRate: number | null;
}): VideoProvenance {
  const source = input.video ?? input.study;
  if (!source) throw new Error("Load a video or a study before exporting.");
  if (!Number.isFinite(source.durationSeconds) || source.durationSeconds <= 0)
    throw new Error("Wait until the video's duration is known.");
  if (input.frameRate === null)
    throw new Error("Enter the video's presented frame rate before exporting.");
  const fileName = source.fileName.trim();
  if (fileName.length === 0)
    throw new Error("The source needs a file name before exporting.");
  const sourceUrl = input.sourceUrlText.trim();
  return {
    sourceUrl: sourceUrl.length === 0 ? null : sourceUrl,
    fileName,
    frameRate: input.frameRate,
    durationSeconds: source.durationSeconds,
  };
}

/** Z21: the duration bounding a typed time, from the video or else the study. */
export function currentDuration(
  videoDurationSeconds: number,
  studyDurationSeconds: number | null,
): number {
  return videoDurationSeconds > 0
    ? videoDurationSeconds
    : (studyDurationSeconds ?? 0);
}

/**
 * V18 L09, amended by V19 J18: the referential check the route runs on a loaded
 * study. Only an unknown monster is a load error; every monster may hold tags
 * and saved attacks. Returns null when the study is consistent.
 */
export function studyMonsterProblem(
  study: StudyState,
  primaryArchetypeId: string,
  monsterIds: readonly string[],
): string | null {
  const archetypeId = study.archetypeId ?? primaryArchetypeId;
  if (!monsterIds.includes(archetypeId))
    return `Unknown monster "${archetypeId}" in this encounter.`;
  return null;
}

export type MonsterSwitchPlan = Readonly<{
  /** Write the current study to its slot before leaving it. */
  writeCurrent: boolean;
  /** Open the selected monster's slot, or an empty study keeping provenance. */
  open: "slot" | "empty";
  /** Ask first: autosave is failing and the study has unsaved work (L08). */
  confirmFirst: boolean;
}>;

/**
 * V18 L08: what switching monsters does. It never touches the video element or
 * its time; with no video there is no slot to write or open.
 */
export function monsterSwitchPlan(input: {
  hasVideo: boolean;
  unsaved: boolean;
  autosaveFailing: boolean;
  slotExists: boolean;
}): MonsterSwitchPlan {
  return {
    writeCurrent: input.hasVideo && input.unsaved,
    open: input.hasVideo && input.slotExists ? "slot" : "empty",
    confirmFirst: input.autosaveFailing && input.unsaved,
  };
}

/** V18 L25/76.1: a primary study keeps today's name; a minion's names its monster. */
export function observationFileName(
  encounterId: string,
  archetypeId: string,
  primaryArchetypeId: string,
): string {
  return archetypeId === primaryArchetypeId
    ? `${encounterId}-observations.json`
    : `${encounterId}-${archetypeId}-observations.json`;
}

export type StudySections = Readonly<{
  /** The preview's tuning controls and unmatched-tag notice. */
  previewTuning: boolean;
  /** The Draft and Tags switch. */
  sourceSwitch: boolean;
}>;

/** V19 J18, J19: every monster shows tagging and the source switch; tuning follows the source. */
export function studySections(previewSource: "draft" | "tags"): StudySections {
  return {
    previewTuning: previewSource === "tags",
    sourceSwitch: true,
  };
}
