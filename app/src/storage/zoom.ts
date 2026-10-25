import { ENCOUNTER_CONFIG } from "../game/config/encounter";
import type { HistoryStorage } from "./attempts";

export const ZOOM_STORAGE_KEY = "dodge-hell-training.zoom";

function validZoom(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= ENCOUNTER_CONFIG.camera.minZoom && value <= ENCOUNTER_CONFIG.camera.maxZoom;
}

export class ZoomPreference {
  private value: number = ENCOUNTER_CONFIG.camera.defaultZoom;
  private storage: HistoryStorage | null = null;

  constructor(getStorage: () => HistoryStorage) {
    try {
      const storage = getStorage();
      const text = storage.getItem(ZOOM_STORAGE_KEY);
      if (text !== null) {
        const value: unknown = JSON.parse(text);
        if (!validZoom(value)) throw new TypeError("Invalid saved zoom");
        this.value = value;
      }
      this.storage = storage;
    } catch {
      this.storage = null;
    }
  }

  get(): number { return this.value; }

  set(value: number): void {
    if (!validZoom(value)) throw new RangeError("Zoom outside camera limits");
    if (value === this.value) return;
    this.value = value;
    try {
      this.storage?.setItem(ZOOM_STORAGE_KEY, JSON.stringify(value));
    } catch {
      this.storage = null;
    }
  }
}