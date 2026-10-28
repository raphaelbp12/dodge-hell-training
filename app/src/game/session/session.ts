import { ENCOUNTER_CONFIG } from "../config/encounter";
import { assertNonnegative } from "../config/stats";
import type { AcceptedHit, SessionPhase, SimulationInput } from "../models";
import type {
  CreateSimulationOptions,
  SimulationState,
} from "../simulation/simulation";
import {
  advanceSimulation,
  createSimulation,
  setDebugSettings,
} from "../simulation/simulation";
import { arbitrarySeed } from "../simulation/random";
import {
  DEFAULT_DEBUG_SETTINGS,
  validateDebugSettings,
  type DebugSettings,
} from "../config/debug";

export type AttemptResult = Readonly<{
  attemptId: number;
  rulesVersion: string;
  elapsedSeconds: number;
  hitsTaken: number;
  outcome: "death";
}>;

const countdownRoundingToleranceSeconds =
  ENCOUNTER_CONFIG.session.startCountdownSeconds * Number.EPSILON * 32;

export class SessionController {
  phase: SessionPhase = "home";
  simulation: SimulationState;
  countdownRemainingSeconds = 0;
  attemptId = 0;
  result: AttemptResult | null = null;
  private phaseBeforePause: "countdown" | "playing" = "playing";
  private debugSettings = DEFAULT_DEBUG_SETTINGS;
  /** Supplies each attempt's seed; injected so a test can pin placement. */
  private nextSeed: () => number;
  /** Drill mode (step 22.5): a single phase to start in and optionally loop. */
  private drillOptions: CreateSimulationOptions;

  constructor(
    nextSeed: () => number = arbitrarySeed,
    drillOptions: CreateSimulationOptions = {},
  ) {
    this.nextSeed = nextSeed;
    this.drillOptions = drillOptions;
    this.simulation = createSimulation(
      ENCOUNTER_CONFIG,
      this.nextSeed(),
      this.drillOptions,
    );
  }

  start(): boolean {
    if (this.phase !== "home") return false;
    this.initialize(ENCOUNTER_CONFIG.session.startCountdownSeconds);
    return true;
  }

  retry(): boolean {
    if (this.phase === "home") return false;
    this.initialize(ENCOUNTER_CONFIG.session.retryCountdownSeconds);
    return true;
  }

  private initialize(countdownSeconds: number): void {
    this.simulation = createSimulation(
      ENCOUNTER_CONFIG,
      this.nextSeed(),
      this.drillOptions,
    );
    setDebugSettings(this.simulation, this.debugSettings);
    this.attemptId++;
    this.result = null;
    this.countdownRemainingSeconds = countdownSeconds;
    this.phase = countdownSeconds > 0 ? "countdown" : "playing";
  }

  setDebugSettings(settings: DebugSettings): void {
    validateDebugSettings(settings);
    this.debugSettings = { ...settings };
    if (this.phase === "ended") return;
    setDebugSettings(this.simulation, settings);
  }

  home(): void {
    this.phase = "home";
    this.result = null;
    this.countdownRemainingSeconds = 0;
  }

  pause(): void {
    if (this.phase !== "playing" && this.phase !== "countdown") return;
    this.phaseBeforePause = this.phase;
    this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") this.phase = this.phaseBeforePause;
  }

  advance(
    elapsedSeconds: number,
    input: SimulationInput,
    onHit?: (hit: AcceptedHit) => void,
  ): AttemptResult | null {
    assertNonnegative(elapsedSeconds, "elapsedSeconds");
    if (this.phase === "countdown") {
      const remainingSeconds = this.countdownRemainingSeconds - elapsedSeconds;
      if (remainingSeconds > countdownRoundingToleranceSeconds) {
        this.countdownRemainingSeconds = remainingSeconds;
        return null;
      }
      this.countdownRemainingSeconds = 0;
      this.phase = "playing";
      elapsedSeconds = Math.max(0, -remainingSeconds);
      if (elapsedSeconds <= countdownRoundingToleranceSeconds) return null;
    }
    if (this.phase !== "playing") return null;
    const advance = advanceSimulation(this.simulation, elapsedSeconds, input);
    for (const hit of advance.acceptedHits) onHit?.(hit);
    if (this.simulation.phase !== "ended") return null;
    this.phase = "ended";
    this.result = Object.freeze({
      attemptId: this.attemptId,
      rulesVersion: this.simulation.rulesVersion,
      elapsedSeconds: this.simulation.elapsedSeconds,
      hitsTaken: this.simulation.hitsTaken,
      outcome: "death",
    });
    return this.result;
  }
}
