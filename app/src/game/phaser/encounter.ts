import Phaser from "phaser";
import {
  archetypeOf,
  ENCOUNTER_CONFIG,
  projectileOf,
} from "../config/encounter";
import {
  DEFAULT_DEBUG_SETTINGS,
  DEBUG_RULES_VERSION,
  type DebugSettings,
} from "../config/debug";
import { PALADIN_STATS } from "../config/stats";
import { transformBodyVertices } from "../simulation/geometry";
import { CONDITION_LABELS, visibleConditions } from "../simulation/conditions";
import type { AcceptedHit, Vector2 } from "../models";
import { SessionController, type AttemptResult } from "../session/session";
import { HitAudio } from "./hit-audio";

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
};

export type EncounterHandle = {
  destroy(): void;
  resume(): void;
  retry(): void;
  setMuted(muted: boolean): void;
  setControlsOpen(open: boolean): void;
  setDebugSettings(settings: DebugSettings): void;
};

type EncounterOptions = {
  /** Pins spawn placement so a run can be reproduced; omitted means varied. */
  seed?: number;
  initialZoom?: number;
  initialMuted?: boolean;
  initialDebugSettings?: DebugSettings;
  onZoomChange?: (zoom: number) => void;
  onResult?: (result: AttemptResult) => void;
};

const presentation = {
  hudIntervalMilliseconds: 100,
  millisecondsPerSecond: 1000,
  background: 0x101b1b,
  ground: 0x1c302a,
  grid: 0x29423a,
  boundary: 0x648575,
  player: 0xf0f5ef,
  enemy: 0xea7969,
  shard: 0xffdf69,
  spentShard: 0xc9a948,
  lobTelegraph: {
    color: 0xff5f5f,
    lineWidthCssPixels: 2,
  },
  hitNumbers: {
    lifetimeSeconds: 0.9,
    riseCssPixels: 28,
    gapCssPixels: 12,
    laneWidthCssPixels: 54,
    lanes: 7,
    fontSizeCssPixels: 18,
    maxVisible: 16,
    color: "#ff8fa3",
    stroke: "#101b1b",
    strokeCssPixels: 3,
  },
  healthBar: {
    widthCssPixels: 48,
    heightCssPixels: 6,
    gapCssPixels: 6,
    borderCssPixels: 1,
    fill: 0x55d6a0,
    empty: 0x592e39,
    border: 0x101b1b,
  },
  conditionChip: {
    gapAboveHealthBarCssPixels: 4,
    gapBetweenCssPixels: 3,
    heightCssPixels: 14,
    horizontalPaddingCssPixels: 5,
    fontSizeCssPixels: 10,
    activeFill: 0x55303a,
    inertFill: 0x2a2a2a,
    activeTextColor: "#ffdf69",
    inertTextColor: "#7a7a7a",
  },
} as const;
const pixelsPerTile = ENCOUNTER_CONFIG.camera.cssPixelsPerTile;
const encounters = new WeakMap<HTMLElement, EncounterScene>();

class EncounterScene extends Phaser.Scene {
  private session: SessionController;
  private get state() {
    return this.session.simulation;
  }
  private ground!: Phaser.GameObjects.Graphics;
  private bodies!: Phaser.GameObjects.Graphics;
  private projectiles!: Phaser.GameObjects.Graphics;
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
    "north" | "south" | "east" | "west",
    Phaser.Input.Keyboard.Key
  >;
  private zoom: number;
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
    this.session =
      options.seed === undefined
        ? new SessionController()
        : new SessionController(() => options.seed!);
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
    this.ground = this.add.graphics().setDepth(0);
    this.bodies = this.add.graphics().setDepth(1);
    this.projectiles = this.add.graphics().setDepth(2);
    this.healthBar = this.add.graphics().setDepth(3);
    this.conditionChips = this.add.graphics().setDepth(3);
    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys(
      { north: "W", south: "S", east: "D", west: "A" },
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
    this.drawGround();
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
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code))
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
    if (!["KeyW", "KeyA", "KeyS", "KeyD", "KeyO", "KeyP"].includes(event.code))
      return;
    event.preventDefault();
    if (event.repeat) return;
    this.suppressedMovement.delete(event.code);
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
    this.session.pause();
    this.hitAudio.stop();
    this.clearMovement();
    this.publishView();
  };

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
    this.clearHitNumbers();
    this.hitAudio.reset();
    this.hitAudio.unlock();
    this.finalHitAmounts = [];
    this.clearMovement();
    this.hudRemainingMilliseconds = 0;
    this.host.focus({ preventScroll: true });
    this.drawEntities();
    this.centerCamera();
    this.publishView();
  }

  setMuted(muted: boolean): void {
    this.hitAudio.setMuted(muted);
    if (!muted) this.hitAudio.unlock();
  }

  setDebugSettings(settings: DebugSettings): void {
    if (this.disposed) return;
    this.session.setDebugSettings(settings);
    if (!this.bodies) return;
    this.drawEntities();
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

  update(_time: number, delta: number): void {
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
    });
  }

  private centerCamera(): void {
    if (!this.cameras?.main) return;
    this.cameras.main
      .setZoom(this.zoom)
      .centerOn(
        this.state.player.positionTiles.x * pixelsPerTile,
        this.state.player.positionTiles.y * pixelsPerTile,
      );
  }

  private drawGround(): void {
    const { radiusTiles, centerTiles } = ENCOUNTER_CONFIG.arena;
    const centerX = centerTiles.x * pixelsPerTile;
    const centerY = centerTiles.y * pixelsPerTile;
    const radius = radiusTiles * pixelsPerTile;
    this.ground
      .fillStyle(presentation.ground)
      .fillCircle(centerX, centerY, radius);
    this.ground.lineStyle(1, presentation.grid);
    for (let tile = -radiusTiles + 1; tile < radiusTiles; tile++) {
      const extent =
        Math.sqrt(radiusTiles * radiusTiles - tile * tile) * pixelsPerTile;
      this.ground.lineBetween(
        centerX + tile * pixelsPerTile,
        centerY - extent,
        centerX + tile * pixelsPerTile,
        centerY + extent,
      );
      this.ground.lineBetween(
        centerX - extent,
        centerY + tile * pixelsPerTile,
        centerX + extent,
        centerY + tile * pixelsPerTile,
      );
    }
    this.ground
      .lineStyle(3, presentation.boundary)
      .strokeCircle(centerX, centerY, radius);
  }

  private addHitNumber(hit: AcceptedHit): void {
    const policy = presentation.hitNumbers;
    while (this.hitNumbers.length >= policy.maxVisible)
      this.hitNumbers.shift()!.text.destroy();
    const text = this.add
      .text(0, 0, `-${hit.damageHp}`, {
        fontFamily: "Consolas, monospace",
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
    const { player, enemies, shards } = this.state;
    this.bodies.clear();
    const draw = (
      graphics: Phaser.GameObjects.Graphics,
      vertices: readonly Vector2[],
      position: Vector2,
      color: number,
      orientation = 0,
    ) => {
      const points = transformBodyVertices(vertices, position, orientation).map(
        (vertex) =>
          new Phaser.Math.Vector2(
            vertex.x * pixelsPerTile,
            vertex.y * pixelsPerTile,
          ),
      );
      graphics.fillStyle(color).fillPoints(points, true);
    };
    for (const enemy of enemies) {
      draw(
        this.bodies,
        archetypeOf(this.state.config, enemy.archetypeId).verticesTiles,
        enemy.positionTiles,
        presentation.enemy,
      );
    }
    draw(
      this.bodies,
      this.state.config.player.verticesTiles,
      player.positionTiles,
      presentation.player,
    );
    this.projectiles.clear();
    const telegraphSeconds = this.state.config.presentation.lobTelegraphSeconds;
    for (const shard of shards) {
      const projectile = projectileOf(this.state.config, shard.projectileId);
      draw(
        this.projectiles,
        projectile.verticesTiles,
        shard.positionTiles,
        shard.hasHitPlayer ? presentation.spentShard : presentation.shard,
        shard.orientationRadians,
      );
      if (
        projectile.motion.kind === "lob" &&
        shard.detonationTargetTiles &&
        shard.ageSeconds >= shard.lifetimeSeconds - telegraphSeconds
      ) {
        this.projectiles
          .lineStyle(
            presentation.lobTelegraph.lineWidthCssPixels,
            presentation.lobTelegraph.color,
          )
          .strokeCircle(
            shard.detonationTargetTiles.x * pixelsPerTile,
            shard.detonationTargetTiles.y * pixelsPerTile,
            projectile.motion.detonationRadiusTiles * pixelsPerTile,
          );
      }
    }
    const bar = presentation.healthBar;
    const width = bar.widthCssPixels / this.zoom;
    const height = bar.heightCssPixels / this.zoom;
    const border = bar.borderCssPixels / this.zoom;
    const bottom = Math.max(
      ...this.state.config.player.verticesTiles.map((vertex) => vertex.y),
    );
    const left = player.positionTiles.x * pixelsPerTile - width / 2;
    const top =
      (player.positionTiles.y + bottom) * pixelsPerTile +
      bar.gapCssPixels / this.zoom;
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
    this.drawConditionChips(player, left, top + height, border);
    const policy = presentation.hitNumbers;
    for (const number of this.hitNumbers) {
      const lane = (number.hit.shardId % policy.lanes) - (policy.lanes - 1) / 2;
      number.text
        .setScale(1 / this.zoom)
        .setPosition(
          number.hit.positionTiles.x * pixelsPerTile +
            (lane * policy.laneWidthCssPixels) / this.zoom,
          (number.hit.positionTiles.y - bottom) * pixelsPerTile -
            (policy.gapCssPixels +
              (policy.riseCssPixels * number.ageSeconds) /
                policy.lifetimeSeconds) /
              this.zoom,
        );
    }
  }

  /** Draws one labelled chip per active-or-visible condition, below the health bar. */
  private drawConditionChips(
    player: typeof this.state.player,
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
          fontFamily: "Consolas, monospace",
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
      text.setPosition(
        left + policy.horizontalPaddingCssPixels / this.zoom,
        top + (height - text.height / this.zoom) / 2,
      );
      this.conditionChipTexts.push(text);
      top += height + policy.gapBetweenCssPixels / this.zoom;
    }
  }

  inspect() {
    return {
      ...structuredClone(this.state),
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
      audio: this.hitAudio.inspect(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearHitNumbers();
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
    retry: () => scene?.retry(),
    setMuted: (muted) => scene?.setMuted(muted),
    setControlsOpen: (open) => scene?.setControlsOpen(open),
    setDebugSettings: (settings) => {
      options.initialDebugSettings = settings;
      scene?.setDebugSettings(settings);
    },
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
