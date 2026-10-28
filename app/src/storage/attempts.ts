import { ENCOUNTER_CONFIG } from "../game/config/encounter";

export const HISTORY_STORAGE_KEY = "dodge-hell-training.attempts";
export const HISTORY_SCHEMA_VERSION = 1;

export type AttemptRecord = Readonly<{
  id: string;
  rulesVersion: string;
  elapsedSeconds: number;
  hitsTaken: number;
  outcome: "death" | "cleared";
}>;

export type HistorySnapshot = Readonly<{
  records: readonly AttemptRecord[];
  warning: string | null;
}>;

export type HistoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAttemptRecord(value: unknown): value is AttemptRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.rulesVersion === "string" &&
    value.rulesVersion.trim().length > 0 &&
    (value.outcome === "death" || value.outcome === "cleared") &&
    typeof value.elapsedSeconds === "number" &&
    Number.isFinite(value.elapsedSeconds) &&
    value.elapsedSeconds >= 0 &&
    typeof value.hitsTaken === "number" &&
    Number.isSafeInteger(value.hitsTaken) &&
    value.hitsTaken >= 0
  );
}

function boundedRecords(
  records: readonly AttemptRecord[],
): readonly AttemptRecord[] {
  const ids = new Set<string>();
  return Object.freeze(
    records
      .filter((record) => {
        if (ids.has(record.id)) return false;
        ids.add(record.id);
        return true;
      })
      .slice(0, ENCOUNTER_CONFIG.session.historyLimit)
      .map((record) =>
        Object.freeze({
          id: record.id,
          rulesVersion: record.rulesVersion,
          elapsedSeconds: record.elapsedSeconds,
          hitsTaken: record.hitsTaken,
          outcome: record.outcome,
        }),
      ),
  );
}

export function retainedBestSeconds(
  records: readonly AttemptRecord[],
  rulesVersion: string,
): number | null {
  const compatible = records.filter(
    (record) => record.rulesVersion === rulesVersion,
  );
  return compatible.length
    ? Math.max(...compatible.map((record) => record.elapsedSeconds))
    : null;
}

export class AttemptHistory {
  private storage: HistoryStorage | null = null;
  private records: readonly AttemptRecord[] = Object.freeze([]);
  private warning: string | null = null;

  constructor(getStorage: () => HistoryStorage) {
    try {
      const storage = getStorage();
      const text = storage.getItem(HISTORY_STORAGE_KEY);
      if (text !== null) {
        const parsed: unknown = JSON.parse(text);
        if (
          !isObject(parsed) ||
          parsed.schemaVersion !== HISTORY_SCHEMA_VERSION ||
          !Array.isArray(parsed.records) ||
          !parsed.records.every(isAttemptRecord)
        ) {
          throw new TypeError("Unrecognized attempt history");
        }
        this.records = boundedRecords(parsed.records);
      }
      this.storage = storage;
    } catch {
      this.warning =
        "Saved history is unavailable. Results are kept for this visit only.";
    }
  }

  snapshot(): HistorySnapshot {
    return { records: this.records, warning: this.warning };
  }

  save(record: AttemptRecord): HistorySnapshot {
    if (!isAttemptRecord(record))
      throw new TypeError("Invalid completed attempt");
    if (this.records.some((existing) => existing.id === record.id))
      return this.snapshot();
    this.records = boundedRecords([record, ...this.records]);
    try {
      this.storage?.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: HISTORY_SCHEMA_VERSION,
          records: this.records,
        }),
      );
    } catch {
      this.storage = null;
      this.warning =
        "History could not be saved. Results are kept for this visit only.";
    }
    return this.snapshot();
  }
}
