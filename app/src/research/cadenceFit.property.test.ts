import fc from "fast-check";
import { expect, test } from "vitest";
import { propertyParameters } from "../test/property";
import {
  BURST_GAP_SPLIT_RATIO,
  fitCadence,
  predictedVolleyTime,
} from "./cadenceFit";
import type { Mark, SegmentWindow } from "./study";

/** Length of the synthesized recording, in seconds (a generator bound, not a game value). */
const RECORDING_SECONDS = 30;
/**
 * `cadenceFit.ts` documents no recovery tolerance. Synthesized marks are exact,
 * so recovery is checked against floating-point rounding only (plan V22 A09
 * finding, recorded in the step's execution record).
 */
const RECOVERY_TOLERANCE_SECONDS = 1e-9;
/** The fit needs this many complete bursts to see a stable burst size. */
const MINIMUM_COMPLETE_BURSTS = 3;

const cadence = fc.record({
  shotsPerBurst: fc.integer({ min: 1, max: 8 }),
  shotIntervalSeconds: fc.double({ min: 0.05, max: 1, noNaN: true }),
  cooldownAfterLastShotSeconds: fc.double({ min: 0.2, max: 5, noNaN: true }),
  initialDelaySeconds: fc.double({ min: 0, max: 3, noNaN: true }),
});

test("a cadence synthesized within bounds is recovered by the fit", () => {
  fc.assert(
    fc.property(cadence, (authored) => {
      const volleyTimes: number[] = [];
      for (let index = 0; ; index += 1) {
        const time = predictedVolleyTime(authored.initialDelaySeconds, authored, index);
        if (time >= RECORDING_SECONDS) break;
        volleyTimes.push(time);
      }
      const completeBursts = Math.floor(volleyTimes.length / authored.shotsPerBurst) - 1;
      fc.pre(completeBursts >= MINIMUM_COMPLETE_BURSTS);
      // The automatic split needs the cooldown clearly longer than the shot interval.
      fc.pre(
        authored.shotsPerBurst === 1 ||
          authored.cooldownAfterLastShotSeconds >=
            authored.shotIntervalSeconds * BURST_GAP_SPLIT_RATIO * 1.01,
      );
      const marks: Mark[] = volleyTimes.map((timeSeconds) => ({
        timeSeconds,
        kind: "volley",
      }));
      const windows: SegmentWindow[] = [
        { segmentId: "s", startSeconds: 0, epochSeconds: 0, endSeconds: RECORDING_SECONDS },
      ];
      const fit = fitCadence({ marks, windows });
      expect(fit.shotsPerBurst).toBe(authored.shotsPerBurst);
      expect(fit.initialDelaySeconds).toBeCloseTo(authored.initialDelaySeconds, 9);
      expect(
        Math.abs((fit.cooldownAfterLastShotSeconds ?? NaN) - authored.cooldownAfterLastShotSeconds),
      ).toBeLessThanOrEqual(RECOVERY_TOLERANCE_SECONDS * RECORDING_SECONDS);
      if (authored.shotsPerBurst > 1)
        expect(
          Math.abs((fit.shotIntervalSeconds ?? NaN) - authored.shotIntervalSeconds),
        ).toBeLessThanOrEqual(RECOVERY_TOLERANCE_SECONDS * RECORDING_SECONDS);
    }),
    propertyParameters({ maxSkipsPerRun: 5000 }),
  );
});
