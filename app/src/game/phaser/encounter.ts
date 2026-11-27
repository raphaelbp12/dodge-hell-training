import Phaser from "phaser";
import {
  archetypeOf,
  ENCOUNTER_CONFIG,
  type EncounterConfig,
} from "../config/encounter";
import {
  DEFAULT_DEBUG_SETTINGS,
  DEBUG_RULES_VERSION,
  type DebugSettings,
} from "../config/debug";
import { PALADIN_STATS } from "../config/stats";
import {
  CONDITION_LABELS,
  visibleConditions,
  type VisibleCondition,
} from "../simulation/conditions";
import { currentPhaseOf, forceNextSubPhase } from "../simulation/phases";
import type { CreateSimulationOptions } from "../simulation/simulation";
import { arbitrarySeed } from "../simulation/random";
import type { AcceptedHit, DrillSelection } from "../models";
import { SessionController, type AttemptResult } from "../session/session";
import type { DetonationEvent } from "../simulation/simulation";
import { HitAudio } from "./hit-audio";
import { phaseViewOf, type PhaseView } from "./view";
import {
  initialCameraRotation,
  resetCameraRotation,
  rotationInputOf,
  stepCameraRotation,
} from "./camera-rotation";
import { uprightPlacement } from "./camera-upright";
import { ArenaRenderer } from "./arena-renderer";
import { pixelsPerTile, presentation } from "./presentation";

export type EncounterView = {
  healthHp: number;
  elapsedSeconds: number;
  hitsTaken: number;
  status: "running" | "countdown" | "paused" | "ended";
  countdownRemainingSeconds: number;
  zoom: number;
  result: AttemptResult | null;
  finalHitAmounts?: readonly number[];
  debug?: boolean;
  /** The primary enemy's current top-level phase and its derived label. */
  phaseIndex: number;
  phaseLabel: string;
  /** The primary archetype's authored top-level phase count. */
  phaseCount: number;
  /** The active drill selection; null is the full fight. */
  drill: DrillSelection | null;
  /** Boss progress and sub-phase fields, shared with the Home preview (V17). */
  bossHealthFraction: PhaseView["bossHealthFraction"];
  phaseProgress: PhaseView["phaseProgress"];
  phaseEndsAtFraction: PhaseView["phaseEndsAtFraction"];
  phaseTimedSeconds: PhaseView["phaseTimedSeconds"];
  subPhaseId: PhaseView["subPhaseId"];
  /** The player's visible conditions, for the HUD list. */
  conditions: readonly VisibleCondition[];
};

export type EncounterHandle = {
  destroy(): void;
  resume(): void;
  pause(): void;
  retry(): void;
  applyDrill(drill: DrillSelection | null): void;
  setMuted(muted: boolean): void;
  setControlsOpen(open: boolean): void;
  setDebugSettings(settings: DebugSettings): void;
  /** Debug panel's "next sub-phase" action; a no-op without sub-phases. */
  advanceSubPhase(): void;
};

type EncounterOptions = {
  /** Which encounter to run (K14); omitted means the shipped Crystal Worm default. */
  config?: EncounterConfig;
  /** Pins spawn placement so a run can be reproduced; omitted means varied. */
  seed?: number;
  /** Drill mode (step 22.5): starts the primary enemy in one phase, optionally looping it. */
  drill?: CreateSimulationOptions;
  initialZoom?: number;
  initialMuted?: boolean;
  initialDebugSettings?: DebugSettings;
  onZoomChange?: (zoom: number) => void;
  onResult?: (result: AttemptResult) => void;
};

const encounters = new WeakMap<HTMLElement, EncounterScene>();

class EncounterScene extends Phaser.Scene {
  private session: SessionController;
  private get state() {
    return this.session.simulation;
  }
  private arenaRenderer!: ArenaRenderer;
  private healthBar!: Phaser.GameObjects.Graphics;
  private conditionChips!: Phaser.GameObjects.Graphics;
  private conditionChipTexts: Phaser.GameObjects.Text[] = [];
  private hitNumbers: {
    hit: AcceptedHit;
    ageSeconds: number;
    text: Phaser.GameObjects.Text;
  }[] = [];
  private finalHitAmounts: number[] = [];
  private hitAudio = new HitAudio(() =>
    this.sound instanceof Phaser.Sound.WebAudioSoundManager
      ? this.sound.context
      : null,
  );
  private unlockAudio = (): void => this.hitAudio.unlock();
  private keys!: Record<
    "north" | "south" | "east" | "west" | "rotateLeft" | "rotateRight",
    Phaser.Input.Keyboard.Key
  >;
  private zoom: number;
  private rotation = initialCameraRotation();
  /** Seconds of frame delta the rotation model was stepped with a net turn input since the last reset. */
  private rotationTurningSeconds = 0;
  private heldControls = new Set<string>();
  private controlsOpen = false;
  private suppressedMovement = new Set<string>();
  private processedKeyEvents = new WeakSet<KeyboardEvent>();
  private disposed = false;
  private skipDelta = true;
  private hudRemainingMilliseconds = 0;
  private host: HTMLElement;
  private publish: (view: EncounterView) => void;
  private onResult: EncounterOptions["onResult"];
  private onZoomChange: EncounterOptions["onZoomChange"];

  constructor(
    host: HTMLElement,
    publish: (view: EncounterView) => void,
    options: EncounterOptions,
  ) {
    super("Encounter");
    this.session = new SessionController(
      options.seed === undefined ? arbitrarySeed : () => options.seed!,
      options.drill ?? {},
      options.config ?? ENCOUNTER_CONFIG,
    );
    this.host = host;
    this.publish = publish;
    this.zoom = options.initialZoom ?? ENCOUNTER_CONFIG.camera.defaultZoom;
    this.onResult = options.onResult;
    this.onZoomChange = options.onZoomChange;
    this.hitAudio.setMuted(options.initialMuted ?? false);
    this.session.setDebugSettings(
      options.initialDebugSettings ?? DEFAULT_DEBUG_SETTINGS,
    );
  }

  create(): void {
    if (this.disposed) return;
    this.arenaRenderer = new ArenaRenderer(this, () => this.state);
    this.healthBar = this.add.graphics().setDepth(3);
    this.conditionChips = this.add.graphics().setDepth(3);
    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys(
      {
        north: "W",
        south: "S",
        east: "D",
        west: "A",
        rotateLeft: "Q",
        rotateRight: "E",
      },
      false,
      false,
    ) as typeof this.keys;
    keyboard.on("keydown", this.onKeyDown);
    keyboard.on("keyup", this.onKeyUp);
    this.host.addEventListener("focusout", this.onFocusOut);
    this.host.addEventListener("pointerdown", this.unlockAudio);
    window.addEventListener("blur", this.pauseForFocus);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.centerCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.session.start();
    this.arenaRenderer.drawGround();
    this.drawEntities();
    this.centerCamera();
    this.host.focus({ preventScroll: true });
    this.hitAudio.unlock();
    this.publishView();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.processedKeyEvents.has(event)) return;
    this.processedKeyEvents.add(event);
    if (this.controlsOpen) return;
    if (
      (document.activeElement as HTMLElement | null)?.closest(
        "[data-debug-tools]",
      )
    ) {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(event.code))
        this.suppressedMovement.add(event.code);
      return;
    }
    if (
      this.disposed ||
      document.hidden ||
      !this.host.closest("main")?.contains(document.activeElement)
    )
      return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    this.hitAudio.unlock();
    if (event.code === "KeyR" || event.code === "Escape") {
      if (
        event.code === "Escape" &&
        !["playing", "paused"].includes(this.session.phase)
      )
        return;
      event.preventDefault();
      if (event.repeat || this.heldControls.has(event.code)) return;
      this.heldControls.add(event.code);
      if (event.code === "KeyR") this.retry();
      else if (this.session.phase === "paused") this.resume();
      else this.pauseForFocus();
      return;
    }
    if (
      document.activeElement !== this.host ||
      !["countdown", "playing"].includes(this.session.phase)
    )
      return;
    if (
      ![
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "KeyO",
        "KeyP",
        "KeyQ",
        "KeyE",
        "KeyZ",
      ].includes(event.code)
    )
      return;
    event.preventDefault();
    if (event.repeat) return;
    this.suppressedMovement.delete(event.code);
    if (event.code === "KeyZ" && this.session.phase === "playing") {
      this.rotation = resetCameraRotation();
      this.rotationTurningSeconds = 0;
    }
    const { minZoom, maxZoom, zoomStep } = ENCOUNTER_CONFIG.camera;
    const previousZoom = this.zoom;
    if (event.code === "KeyO")
      this.zoom = Math.max(minZoom, this.zoom - zoomStep);
    if (event.code === "KeyP")
      this.zoom = Math.min(maxZoom, this.zoom + zoomStep);
    if (this.zoom !== previousZoom) {
      this.onZoomChange?.(this.zoom);
      this.drawEntities();
    }
    this.centerCamera();
    if (event.code === "KeyO" || event.code === "KeyP") this.publishView();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.processedKeyEvents.has(event)) return;
    this.processedKeyEvents.add(event);
    this.heldControls.delete(event.code);
    this.suppressedMovement.delete(event.code);
  };

  private clearMovement(): void {
    for (const [direction, code] of Object.entries({
      north: "KeyW",
      south: "KeyS",
      east: "KeyD",
      west: "KeyA",
      rotateLeft: "KeyQ",
      rotateRight: "KeyE",
    })) {
      if (this.keys[direction as keyof typeof this.keys].isDown)
        this.suppressedMovement.add(code);
    }
    this.input.keyboard?.resetKeys();
    this.skipDelta = true;
  }

  private onFocusOut = (event: FocusEvent): void => {
    if (
      event.relatedTarget instanceof HTMLElement &&
      event.relatedTarget.closest("[data-debug-tools]")
    ) {
      this.clearMovement();
      return;
    }
    this.pauseForFocus();
  };
  private onVisibility = (): void => {
    if (document.hidden) this.pauseForFocus();
  };
  private pauseForFocus = (): void => {
    if (this.disposed || this.state.phase === "ended") return;
    this.pause();
  };

  /** Pauses the session and publishes the current view (R09). */
  pause(): void {
    if (this.disposed) return;
    this.session.pause();
    this.hitAudio.stop();
    this.clearMovement();
    this.publishView();
  }

  resume(): void {
    if (
      this.disposed ||
      this.controlsOpen ||
      document.hidden ||
      this.state.phase === "ended"
    )
      return;
    this.clearMovement();
    this.hitAudio.unlock();
    this.session.resume();
    this.host.focus({ preventScroll: true });
    this.publishView();
  }

  retry(): void {
    if (
      this.disposed ||
      this.controlsOpen ||
      document.hidden ||
      !this.session.retry()
    )
      return;
    this.resetAttemptCleanup();
    this.host.focus({ preventScroll: true });
    this.drawEntities();
    this.centerCamera();
    this.publishView();
  }

  /**
   * Applies a drill selection to the live attempt (R09, R16). It reuses the
   * Retry presentation cleanup, then leaves the fresh attempt paused so the
   * panel can stay open.
   */
  applyDrill(drill: DrillSelection | null): void {
    if (this.disposed || !this.session.applyDrill(drill)) return;
    this.resetAttemptCleanup();
    this.drawEntities();
    this.centerCamera();
    this.publishView();
  }

  private resetAttemptCleanup(): void {
    this.clearHitNumbers();
    this.arenaRenderer.clearExplosions();
    this.arenaRenderer.resetCounters();
    this.hitAudio.reset();
    this.hitAudio.unlock();
    this.finalHitAmounts = [];
    this.rotation = resetCameraRotation();
    this.rotationTurningSeconds = 0;
    this.clearMovement();
    this.hudRemainingMilliseconds = 0;
  }

  setMuted(muted: boolean): void {
    this.hitAudio.setMuted(muted);
    if (!muted) this.hitAudio.unlock();
  }

  setDebugSettings(settings: DebugSettings): void {
    if (this.disposed) return;
    this.session.setDebugSettings(settings);
    if (!this.arenaRenderer) return;
    this.drawEntities();
    this.publishView();
  }

  advanceSubPhase(): void {
    if (this.disposed || this.state.phase !== "playing") return;
    const enemy = this.state.enemies.find(
      (candidate) => candidate.archetypeId === this.state.config.primaryArchetypeId,
    );
    if (!enemy) return;
    forceNextSubPhase(this.state, enemy, archetypeOf(this.state.config, enemy.archetypeId));
    if (this.arenaRenderer) this.drawEntities();
    this.publishView();
  }

  setControlsOpen(open: boolean): void {
    if (this.disposed || this.state.phase === "ended") return;
    this.controlsOpen = open;
    if (open) this.pauseForFocus();
    this.clearMovement();
    this.heldControls.clear();
    this.publishView();
  }

  override update(_time: number, delta: number): void {
    if (
      this.disposed ||
      !this.keys ||
      this.controlsOpen ||
      this.session.phase === "paused" ||
      this.session.phase === "ended" ||
      document.hidden
    )
      return;
    if (
      document.activeElement !== this.host &&
      !(document.activeElement as HTMLElement | null)?.closest(
        "[data-debug-tools]",
      )
    ) {
      this.pauseForFocus();
      return;
    }
    if (this.skipDelta) {
      this.skipDelta = false;
      return;
    }
    const previousPhase = this.session.phase;
    const gameplayFocused = document.activeElement === this.host;
    const previousSeconds = this.state.elapsedSeconds;
    const currentHits: AcceptedHit[] = [];
    const newDetonations: DetonationEvent[] = [];
    if (this.session.phase === "playing") {
      const rotationInput = rotationInputOf(
        { q: this.keys.rotateLeft.isDown, e: this.keys.rotateRight.isDown },
        gameplayFocused,
        this.suppressedMovement,
      );
      const rotationSeconds = delta / presentation.millisecondsPerSecond;
      if (rotationInput.clockwise !== rotationInput.counterClockwise)
        this.rotationTurningSeconds += rotationSeconds;
      this.rotation = stepCameraRotation(
        this.rotation,
        rotationInput,
        rotationSeconds,
      );
    }
    const result = this.session.advance(
      delta / presentation.millisecondsPerSecond,
      {
        north:
          gameplayFocused &&
          this.keys.north.isDown &&
          !this.suppressedMovement.has("KeyW"),
        south:
          gameplayFocused &&
          this.keys.south.isDown &&
          !this.suppressedMovement.has("KeyS"),
        east:
          gameplayFocused &&
          this.keys.east.isDown &&
          !this.suppressedMovement.has("KeyD"),
        west:
          gameplayFocused &&
          this.keys.west.isDown &&
          !this.suppressedMovement.has("KeyA"),
      },
      (hit) => {
        currentHits.push(hit);
        this.addHitNumber(hit);
        this.hitAudio.play();
      },
      (event) => newDetonations.push(event),
    );
    if (result) this.finalHitAmounts = currentHits.map((hit) => hit.damageHp);
    const activeSeconds = this.state.elapsedSeconds - previousSeconds;
    this.hitNumbers = this.hitNumbers.filter((number) => {
      number.ageSeconds += activeSeconds;
      if (number.ageSeconds < presentation.hitNumbers.lifetimeSeconds)
        return true;
      number.text.destroy();
      return false;
    });
    this.arenaRenderer.advanceExplosions(activeSeconds);
    if (this.session.phase === "playing")
      for (const event of newDetonations) this.arenaRenderer.addBombExplosion(event);
    else this.arenaRenderer.clearExplosions();
    this.drawEntities();
    this.centerCamera();
    this.hudRemainingMilliseconds -= delta;
    if (
      this.hudRemainingMilliseconds <= 0 ||
      previousPhase !== this.session.phase
    ) {
      this.hudRemainingMilliseconds = presentation.hudIntervalMilliseconds;
      this.publishView();
    }
    if (result) this.onResult?.(result);
  }

  private publishView(): void {
    if (this.disposed) return;
    this.publish({
      healthHp: this.state.player.healthHp,
      elapsedSeconds: this.state.elapsedSeconds,
      hitsTaken: this.state.hitsTaken,
      status:
        this.session.phase === "playing"
          ? "running"
          : this.session.phase === "home"
            ? "countdown"
            : this.session.phase,
      countdownRemainingSeconds: this.session.countdownRemainingSeconds,
      zoom: this.zoom,
      result: this.session.result,
      finalHitAmounts: this.finalHitAmounts,
      debug: this.state.rulesVersion === DEBUG_RULES_VERSION,
      ...phaseViewOf(this.state),
      conditions: visibleConditions(this.state.player),
    });
  }

  /** Phaser rotates the world, so a clockwise camera turn is a negative rotation. */
  private get cameraRotation(): number {
    return 0 - this.rotation.angleRadians;
  }

  private centerCamera(): void {
    if (!this.cameras?.main) return;
    this.cameras.main
      .setZoom(this.zoom)
      .setRotation(this.cameraRotation)
      .centerOn(
        this.state.player.positionTiles.x * pixelsPerTile,
        this.state.player.positionTiles.y * pixelsPerTile,
      );
  }

  private addHitNumber(hit: AcceptedHit): void {
    const policy = presentation.hitNumbers;
    while (this.hitNumbers.length >= policy.maxVisible)
      this.hitNumbers.shift()!.text.destroy();
    const text = this.add
      .text(0, 0, `-${hit.damageHp}`, {
        fontFamily: '"Barlow Semi Condensed", sans-serif',
        fontStyle: "600",
        fontSize: `${policy.fontSizeCssPixels}px`,
        color: policy.color,
        stroke: policy.stroke,
        strokeThickness: policy.strokeCssPixels,
      })
      .setOrigin(0.5, 1)
      .setDepth(4);
    this.hitNumbers.push({ hit, ageSeconds: 0, text });
  }

  private clearHitNumbers(): void {
    for (const number of this.hitNumbers) number.text.destroy();
    this.hitNumbers = [];
  }

  private drawEntities(): void {
    const { player } = this.state;
    this.arenaRenderer.drawWorld(this.zoom, this.cameraRotation);
    const bar = presentation.healthBar;
    const width = bar.widthCssPixels / this.zoom;
    const height = bar.heightCssPixels / this.zoom;
    const border = bar.borderCssPixels / this.zoom;
    const bottom = Math.max(
      ...this.state.config.player.verticesTiles.map((vertex) => vertex.y),
    );
    // The bar and chips are drawn relative to the player and counter-rotated,
    // so they stay upright on screen at every camera angle (D-24-6).
    const anchor = {
      x: player.positionTiles.x * pixelsPerTile,
      y: player.positionTiles.y * pixelsPerTile,
    };
    const upright = uprightPlacement(anchor, { x: 0, y: 0 }, this.cameraRotation);
    this.healthBar.setPosition(anchor.x, anchor.y).setRotation(upright.rotation);
    this.conditionChips.setPosition(anchor.x, anchor.y).setRotation(upright.rotation);
    const left = -width / 2;
    const top = bottom * pixelsPerTile + bar.gapCssPixels / this.zoom;
    this.healthBar
      .clear()
      .fillStyle(bar.border)
      .fillRect(
        left - border,
        top - border,
        width + border * 2,
        height + border * 2,
      )
      .fillStyle(bar.empty)
      .fillRect(left, top, width, height)
      .fillStyle(bar.fill)
      .fillRect(
        left,
        top,
        (width * player.healthHp) / PALADIN_STATS.healthHp,
        height,
      );
    this.drawConditionChips(player, anchor, left, top + height, border);
    const policy = presentation.hitNumbers;
    for (const number of this.hitNumbers) {
      const lane = (number.hit.shardId % policy.lanes) - (policy.lanes - 1) / 2;
      const placed = uprightPlacement(
        {
          x: number.hit.positionTiles.x * pixelsPerTile,
          y: number.hit.positionTiles.y * pixelsPerTile,
        },
        {
          x: (lane * policy.laneWidthCssPixels) / this.zoom,
          y:
            -bottom * pixelsPerTile -
            (policy.gapCssPixels +
              (policy.riseCssPixels * number.ageSeconds) /
                policy.lifetimeSeconds) /
              this.zoom,
        },
        this.cameraRotation,
      );
      number.text
        .setScale(1 / this.zoom)
        .setRotation(placed.rotation)
        .setPosition(placed.x, placed.y);
    }
  }

  /** Draws one labelled chip per active-or-visible condition, below the health bar. */
  private drawConditionChips(
    player: typeof this.state.player,
    anchor: { x: number; y: number },
    left: number,
    topOfBar: number,
    border: number,
  ): void {
    const policy = presentation.conditionChip;
    for (const text of this.conditionChipTexts) text.destroy();
    this.conditionChipTexts = [];
    this.conditionChips.clear();
    let top = topOfBar + border + policy.gapAboveHealthBarCssPixels / this.zoom;
    for (const condition of visibleConditions(player)) {
      const label = `${CONDITION_LABELS[condition.key]} ${condition.remainingSeconds.toFixed(1)}${
        condition.inert ? " (inert)" : ""
      }`;
      const text = this.add
        .text(0, 0, label, {
          fontFamily: '"Barlow Semi Condensed", sans-serif',
          fontStyle: "600",
          fontSize: `${policy.fontSizeCssPixels}px`,
          color: condition.inert ? policy.inertTextColor : policy.activeTextColor,
        })
        .setOrigin(0, 0)
        .setScale(1 / this.zoom)
        .setDepth(4);
      const width =
        text.width / this.zoom + (policy.horizontalPaddingCssPixels * 2) / this.zoom;
      const height = policy.heightCssPixels / this.zoom;
      this.conditionChips
        .fillStyle(condition.inert ? policy.inertFill : policy.activeFill)
        .fillRect(left, top, width, height);
      const placed = uprightPlacement(
        anchor,
        {
          x: left + policy.horizontalPaddingCssPixels / this.zoom,
          y: top + (height - text.height / this.zoom) / 2,
        },
        this.cameraRotation,
      );
      text.setRotation(placed.rotation).setPosition(placed.x, placed.y);
      this.conditionChipTexts.push(text);
      top += height + policy.gapBetweenCssPixels / this.zoom;
    }
  }

  inspect() {
    return {
      ...structuredClone(this.state),
      // phaseIndex and phaseEnteredAtSeconds are already on each cloned
      // enemy; this adds the authored phase id the index resolves to.
      enemyPhaseIds: this.state.enemies.map(
        (enemy) =>
          currentPhaseOf(
            archetypeOf(this.state.config, enemy.archetypeId),
            enemy,
          ).id,
      ),
      volleysFired: this.state.enemies.reduce(
        (total, enemy) =>
          total +
          enemy.attackClocks.reduce(
            (clockTotal, clock) => clockTotal + clock.volleysFired,
            0,
          ),
        0,
      ),
      paused: this.session.phase === "paused",
      sessionPhase: this.session.phase,
      attemptId: this.session.attemptId,
      countdownRemainingSeconds: this.session.countdownRemainingSeconds,
      result: this.session.result ? { ...this.session.result } : null,
      zoom: this.zoom,
      cameraRotationRadians: this.rotation.angleRadians,
      cameraRotationTurningSeconds: this.rotationTurningSeconds,
      camera: {
        x: this.cameras.main.midPoint.x / pixelsPerTile,
        y: this.cameras.main.midPoint.y / pixelsPerTile,
      },
      viewport: { width: this.scale.width, height: this.scale.height },
      keydownListeners: this.input.keyboard?.listenerCount("keydown"),
      hitNumbers: this.hitNumbers.map((number) => ({
        shardId: number.hit.shardId,
        damageHp: number.hit.damageHp,
        ageSeconds: number.ageSeconds,
        text: number.text.text,
        widthCssPixels: number.text.displayWidth * this.zoom,
        heightCssPixels: number.text.displayHeight * this.zoom,
      })),
      ...this.arenaRenderer.counters,
      audio: this.hitAudio.inspect(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearHitNumbers();
    this.arenaRenderer?.destroy();
    this.hitAudio.dispose();
    this.session.home();
    this.input?.keyboard?.resetKeys();
    this.input?.keyboard?.off("keydown", this.onKeyDown);
    this.input?.keyboard?.off("keyup", this.onKeyUp);
    if (this.input?.keyboard) this.input.keyboard.enabled = false;
    this.host.removeEventListener("focusout", this.onFocusOut);
    this.host.removeEventListener("pointerdown", this.unlockAudio);
    window.removeEventListener("blur", this.pauseForFocus);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.scale?.off(Phaser.Scale.Events.RESIZE, this.centerCamera, this);
  }
}

export function inspectEncounter(host: HTMLElement) {
  const scene = encounters.get(host);
  return scene?.sys.isActive() ? scene.inspect() : null;
}

export function createEncounter(
  host: HTMLElement,
  publish: (view: EncounterView) => void,
  options: EncounterOptions = {},
): EncounterHandle {
  let disposed = false;
  let game: Phaser.Game | undefined;
  let scene: EncounterScene | undefined;
  queueMicrotask(() => {
    if (disposed) return;
    scene = new EncounterScene(host, publish, options);
    encounters.set(host, scene);
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: presentation.background,
      render: {
        antialias: true,
        roundPixels: false,
        preserveDrawingBuffer: true,
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: host.clientWidth,
        height: host.clientHeight,
      },
      input: { keyboard: true, mouse: false, touch: false },
      scene,
      banner: false,
    });
  });
  return {
    resume: () => scene?.resume(),
    pause: () => scene?.pause(),
    retry: () => scene?.retry(),
    applyDrill: (drill) => scene?.applyDrill(drill),
    setMuted: (muted) => scene?.setMuted(muted),
    setControlsOpen: (open) => scene?.setControlsOpen(open),
    setDebugSettings: (settings) => {
      options.initialDebugSettings = settings;
      scene?.setDebugSettings(settings);
    },
    advanceSubPhase: () => scene?.advanceSubPhase(),
    destroy: () => {
      if (disposed) return;
      disposed = true;
      encounters.delete(host);
      scene?.dispose();
      game?.destroy(true);
      game?.canvas?.remove();
    },
  };
}
