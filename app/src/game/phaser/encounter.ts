import Phaser from "phaser";
import { ENCOUNTER_CONFIG } from "../config/encounter";
import { SessionController, type AttemptResult } from "../session/session";

export type EncounterView = {
  healthHp: number;
  elapsedSeconds: number;
  hitsTaken: number;
  status: "running" | "countdown" | "paused" | "ended";
  countdownRemainingSeconds: number;
  zoom: number;
  result: AttemptResult | null;
};

export type EncounterHandle = {
  destroy(): void;
  resume(): void;
  retry(): void;
};

type EncounterOptions = {
  initialZoom?: number;
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
  playerOutline: 0x55d6a0,
  enemy: 0xea7969,
  enemyCore: 0x86ded9,
  shard: 0xffdf69,
  spentShard: 0xc9a948,
} as const;
const pixelsPerTile = ENCOUNTER_CONFIG.camera.cssPixelsPerTile;
const encounters = new WeakMap<HTMLElement, EncounterScene>();

class EncounterScene extends Phaser.Scene {
  private session = new SessionController();
  private get state() {
    return this.session.simulation;
  }
  private ground!: Phaser.GameObjects.Graphics;
  private bodies!: Phaser.GameObjects.Graphics;
  private projectiles!: Phaser.GameObjects.Graphics;
  private keys!: Record<
    "north" | "south" | "east" | "west",
    Phaser.Input.Keyboard.Key
  >;
  private zoom: number;
  private heldControls = new Set<string>();
  private suppressedMovement = new Set<string>();
  private processedKeyEvents = new WeakSet<KeyboardEvent>();
  private disposed = false;
  private skipDelta = true;
  private hudRemainingMilliseconds = 0;
  private host: HTMLElement;
  private publish: (view: EncounterView) => void;
  private onResult: EncounterOptions["onResult"];

  constructor(
    host: HTMLElement,
    publish: (view: EncounterView) => void,
    options: EncounterOptions,
  ) {
    super("Encounter");
    this.host = host;
    this.publish = publish;
    this.zoom = options.initialZoom ?? ENCOUNTER_CONFIG.camera.defaultZoom;
    this.onResult = options.onResult;
  }

  create(): void {
    if (this.disposed) return;
    this.ground = this.add.graphics().setDepth(0);
    this.bodies = this.add.graphics().setDepth(1);
    this.projectiles = this.add.graphics().setDepth(2);
    const keyboard = this.input.keyboard!;
    this.keys = keyboard.addKeys(
      { north: "W", south: "S", east: "D", west: "A" },
      false,
      false,
    ) as typeof this.keys;
    keyboard.on("keydown", this.onKeyDown);
    keyboard.on("keyup", this.onKeyUp);
    this.host.addEventListener("focusout", this.onFocusOut);
    window.addEventListener("blur", this.pauseForFocus);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.centerCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.session.start();
    this.drawGround();
    this.drawEntities();
    this.centerCamera();
    this.host.focus({ preventScroll: true });
    this.publishView();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.processedKeyEvents.has(event)) return;
    this.processedKeyEvents.add(event);
    if (
      this.disposed ||
      document.hidden ||
      !this.host.closest("main")?.contains(document.activeElement)
    )
      return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
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
    if (event.code === "KeyO")
      this.zoom = Math.max(minZoom, this.zoom - zoomStep);
    if (event.code === "KeyP")
      this.zoom = Math.min(maxZoom, this.zoom + zoomStep);
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

  private onFocusOut = (): void => {
    this.pauseForFocus();
  };
  private onVisibility = (): void => {
    if (document.hidden) this.pauseForFocus();
  };
  private pauseForFocus = (): void => {
    if (this.disposed || this.state.phase === "ended") return;
    this.session.pause();
    this.clearMovement();
    this.publishView();
  };

  resume(): void {
    if (this.disposed || document.hidden || this.state.phase === "ended")
      return;
    this.clearMovement();
    this.session.resume();
    this.host.focus({ preventScroll: true });
    this.publishView();
  }

  retry(): void {
    if (this.disposed || document.hidden || !this.session.retry()) return;
    this.clearMovement();
    this.hudRemainingMilliseconds = 0;
    this.host.focus({ preventScroll: true });
    this.drawEntities();
    this.centerCamera();
    this.publishView();
  }

  update(_time: number, delta: number): void {
    if (
      this.disposed ||
      !this.keys ||
      this.session.phase === "paused" ||
      this.session.phase === "ended" ||
      document.hidden ||
      document.activeElement !== this.host
    )
      return;
    if (this.skipDelta) {
      this.skipDelta = false;
      return;
    }
    const previousPhase = this.session.phase;
    const result = this.session.advance(
      delta / presentation.millisecondsPerSecond,
      {
        north: this.keys.north.isDown && !this.suppressedMovement.has("KeyW"),
        south: this.keys.south.isDown && !this.suppressedMovement.has("KeyS"),
        east: this.keys.east.isDown && !this.suppressedMovement.has("KeyD"),
        west: this.keys.west.isDown && !this.suppressedMovement.has("KeyA"),
      },
    );
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

  private drawEntities(): void {
    const { player, enemy, shards } = this.state;
    const playerRadius =
      ENCOUNTER_CONFIG.player.colliderRadiusTiles * pixelsPerTile;
    const enemyRadius =
      ENCOUNTER_CONFIG.enemy.colliderRadiusTiles * pixelsPerTile;
    this.bodies.clear();
    this.bodies
      .fillStyle(presentation.enemy)
      .fillCircle(
        enemy.positionTiles.x * pixelsPerTile,
        enemy.positionTiles.y * pixelsPerTile,
        enemyRadius,
      );
    this.bodies
      .fillStyle(presentation.enemyCore)
      .fillCircle(
        enemy.positionTiles.x * pixelsPerTile,
        enemy.positionTiles.y * pixelsPerTile,
        enemyRadius / 2,
      );
    this.bodies
      .fillStyle(presentation.player)
      .fillCircle(
        player.positionTiles.x * pixelsPerTile,
        player.positionTiles.y * pixelsPerTile,
        playerRadius,
      );
    this.bodies
      .lineStyle(2, presentation.playerOutline)
      .strokeCircle(
        player.positionTiles.x * pixelsPerTile,
        player.positionTiles.y * pixelsPerTile,
        playerRadius,
      );
    this.projectiles.clear();
    for (const shard of shards) {
      this.projectiles
        .fillStyle(
          shard.hasHitPlayer ? presentation.spentShard : presentation.shard,
        )
        .fillCircle(
          shard.positionTiles.x * pixelsPerTile,
          shard.positionTiles.y * pixelsPerTile,
          ENCOUNTER_CONFIG.shard.colliderRadiusTiles * pixelsPerTile,
        );
    }
  }

  inspect() {
    return {
      ...structuredClone(this.state),
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
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.session.home();
    this.input?.keyboard?.resetKeys();
    this.input?.keyboard?.off("keydown", this.onKeyDown);
    this.input?.keyboard?.off("keyup", this.onKeyUp);
    if (this.input?.keyboard) this.input.keyboard.enabled = false;
    this.host.removeEventListener("focusout", this.onFocusOut);
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
