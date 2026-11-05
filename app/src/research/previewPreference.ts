import type { HistoryStorage } from "../storage/attempts";

export type PreviewSize = "small" | "medium" | "large";

/** M25: canvas side in CSS pixels. */
export const PREVIEW_SIZE_PIXELS: Readonly<Record<PreviewSize, number>> = {
  small: 320,
  medium: 480,
  large: 720,
};

/** The video's width in CSS pixels per size; its height follows the video's own aspect. */
export const VIDEO_SIZE_PIXELS: Readonly<Record<PreviewSize, number>> = {
  small: 480,
  medium: 720,
  large: 960,
};

export type PreviewPreferenceValue = Readonly<{
  shown: boolean;
  size: PreviewSize;
  videoSize: PreviewSize;
}>;

export const PREVIEW_PREFERENCE_STORAGE_KEY = "dodge-hell-training.tagger-preview";

/** M35 */
export const DEFAULT_PREVIEW_PREFERENCE: PreviewPreferenceValue = {
  shown: true,
  size: "medium",
  videoSize: "medium",
};

function parseValue(text: string): PreviewPreferenceValue | null {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null) return null;
  const { shown, size, videoSize } = value as Record<string, unknown>;
  const isSize = (candidate: unknown): candidate is PreviewSize =>
    typeof candidate === "string" &&
    Object.hasOwn(PREVIEW_SIZE_PIXELS, candidate);
  if (typeof shown !== "boolean" || !isSize(size)) return null;
  // A value saved before the video selector existed has no `videoSize`.
  if (videoSize !== undefined && !isSize(videoSize)) return null;
  return {
    shown,
    size,
    videoSize: videoSize ?? DEFAULT_PREVIEW_PREFERENCE.videoSize,
  };
}

/** M18/M24: only the panel's shown state and size, and the video size, persist. */
export class PreviewPreference {
  private value: PreviewPreferenceValue = DEFAULT_PREVIEW_PREFERENCE;
  private storage: HistoryStorage | null = null;

  constructor(getStorage: () => HistoryStorage) {
    try {
      const storage = getStorage();
      this.storage = storage;
      const text = storage.getItem(PREVIEW_PREFERENCE_STORAGE_KEY);
      if (text !== null) this.value = parseValue(text) ?? this.value;
    } catch {
      /* An unreadable value or storage keeps the default (M18). */
    }
  }

  get(): PreviewPreferenceValue {
    return this.value;
  }

  set(value: PreviewPreferenceValue): void {
    this.value = value;
    try {
      this.storage?.setItem(PREVIEW_PREFERENCE_STORAGE_KEY, JSON.stringify(value));
    } catch {
      this.storage = null;
    }
  }
}
