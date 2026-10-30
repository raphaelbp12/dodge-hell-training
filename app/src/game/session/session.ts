import { ENCOUNTER_CONFIG, type EncounterConfig } from "../config/encounter";
import { assertNonnegative } from "../config/stats";
import type { AcceptedHit, SessionPhase, SimulationInput } from "../models";
import type {
  CreateSimulationOptions,
  SimulationState,
} from "../simulation/simulation";
import {
  advanceSimulation,
  type DetonationEvent,
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
  outcome: "death" | "cleared";
}>;

export class SessionController {
  phase: SessionPhase = "home";
  simulation: SimulationState;
  countdownRemainingSeconds = 0;
  attemptId = 0;
  result: AttemptResult | null = null;
  private readonly config: EncounterConfig;
  private readonly countdownRoundingToleranceSeconds: number;
  private phaseBeforePause: "countdown" | "playing" = "playing";
  private debugSettings = DEFAULT_DEBUG_SETTINGS;
  /** Supplies each attempt's seed; injected so a test can pin placement. */
  private nextSeed: () => number;
  /** Drill mode (step 22.5): a single phase to start in and optionally loop. */
  private drillOptions: CreateSimulationOptions;

  constructor(
    nextSeed: () => number = arbitrarySeed,
    drillOptions: CreateSimulationOptions = {},
    config: EncounterConfig = ENCOUNTER_CONFIG,
  ) {
    this.nextSeed = nextSeed;
    this.drillOptions = drillOptions;
    this.config = config;
    this.countdownRoundingToleranceSeconds =
      config.session.startCountdownSeconds * Number.EPSILON * 32;
    this.simulation = createSimulation(
      this.config,
      this.nextSeed(),
      this.drillOptions,
    );
  }

  start(): boolean {
    if (this.phase !== "home") return false;
    this.initialize(this.config.session.startCountdownSeconds);
    return true;
  }

  retry(): boolean {
    if (this.phase === "home") return false;
    this.initialize(this.config.session.retryCountdownSeconds);
    return true;
  }

  private initialize(countdownSeconds: number): void {
    this.simulation = createSimulation(
      this.config,
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
    onDetonation?: (event: DetonationEvent) => void,
  ): AttemptResult | null {
    assertNonnegative(elapsedSeconds, "elapsedSeconds");
    if (this.phase === "countdown") {
      const remainingSeconds = this.countdownRemainingSeconds - elapsedSeconds;
      if (remainingSeconds > this.countdownRoundingToleranceSeconds) {
        this.countdownRemainingSeconds = remainingSeconds;
        return null;
      }
      this.countdownRemainingSeconds = 0;
      this.phase = "playing";
      elapsedSeconds = Math.max(0, -remainingSeconds);
      if (elapsedSeconds <= this.countdownRoundingToleranceSeconds) return null;
    }
    if (this.phase !== "playing") return null;
    const advance = advanceSimulation(this.simulation, elapsedSeconds, input);
    for (const hit of advance.acceptedHits) onHit?.(hit);
    for (const event of advance.detonations) onDetonation?.(event);
    if (
      this.simulation.phase !== "ended" &&
      this.simulation.phase !== "cleared"
    )
      return null;
    this.phase = "ended";
    this.result = Object.freeze({
      attemptId: this.attemptId,
      rulesVersion: this.simulation.rulesVersion,
      elapsedSeconds: this.simulation.elapsedSeconds,
      hitsTaken: this.simulation.hitsTaken,
      outcome: this.simulation.phase === "cleared" ? "cleared" : "death",
    });
    return this.result;
  }
}
