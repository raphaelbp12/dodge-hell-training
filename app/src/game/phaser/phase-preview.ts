import Phaser from "phaser";
import { DEFAULT_DEBUG_SETTINGS } from "../config/debug";
import type { EncounterConfig } from "../config/encounter";
import {
  advanceSimulation,
  createSimulation,
  setDebugSettings,
  type SimulationState,
} from "../simulation/simulation";
import { ArenaRenderer } from "./arena-renderer";
import { arenaExtentTiles } from "./arena-plate";
import { pixelsPerTile, presentation } from "./presentation";

/** A fixed seed, so a preview looks the same each visit. Never saved. */
const PREVIEW_SEED = 1;
const IDLE_INPUT = { north: false, south: false, east: false, west: false };
const PREVIEW_MARGIN = 1.04;

export type PhasePreviewHandle = {
  setPhase(phaseIndex: number): void;
  destroy(): void;
};

function createPreviewState(
  config: EncounterConfig,
  phaseIndex: number,
): SimulationState {
  const state = createSimulation(config, PREVIEW_SEED, {
    drill: { phaseIndices: [phaseIndex], loop: true },
  });
  // God mode so the standing Paladin never ends the loop (H04).
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  return state;
}

class PhasePreviewScene extends Phaser.Scene {
  private readonly encounterConfig: EncounterConfig;
  private phaseIndex: number;
  private previewState: SimulationState;
  private arenaRenderer?: ArenaRenderer;

  constructor(encounterConfig: EncounterConfig, phaseIndex: number) {
    super("PhasePreview");
    this.encounterConfig = encounterConfig;
    this.phaseIndex = phaseIndex;
    this.previewState = createPreviewState(encounterConfig, phaseIndex);
  }

  create(): void {
    this.arenaRenderer = new ArenaRenderer(this, () => this.previewState);
    this.arenaRenderer.drawGround();
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
  }

  setPhase(phaseIndex: number): void {
    if (phaseIndex === this.phaseIndex) return;
    this.phaseIndex = phaseIndex;
    this.previewState = createPreviewState(this.encounterConfig, phaseIndex);
    this.arenaRenderer?.clearExplosions();
  }

  override update(_time: number, delta: number): void {
    if (!this.arenaRenderer) return;
    if (this.previewState.phase !== "playing")
      this.previewState = createPreviewState(this.encounterConfig, this.phaseIndex);
    const before = this.previewState.elapsedSeconds;
    const { detonations } = advanceSimulation(
      this.previewState,
      delta / presentation.millisecondsPerSecond,
      IDLE_INPUT,
    );
    this.arenaRenderer.advanceExplosions(
      this.previewState.elapsedSeconds - before,
    );
    for (const event of detonations) this.arenaRenderer.addBombExplosion(event);
    this.arenaRenderer.drawWorld(this.cameras.main.zoom);
  }

  private fitCamera(): void {
    const { shape } = this.encounterConfig.arena;
    if (this.scale.width === 0 || this.scale.height === 0) return;
    const sizePixels =
      arenaExtentTiles(shape) * 2 * pixelsPerTile * PREVIEW_MARGIN;
    this.cameras.main
      .setZoom(Math.min(this.scale.width, this.scale.height) / sizePixels)
      .centerOn(
        shape.centerTiles.x * pixelsPerTile,
        shape.centerTiles.y * pixelsPerTile,
      );
  }
}

export function createPhasePreview(
  host: HTMLElement,
  config: EncounterConfig,
  phaseIndex: number,
): PhasePreviewHandle {
  let disposed = false;
  let game: Phaser.Game | undefined;
  let scene: PhasePreviewScene | undefined;
  // Same microtask guard as createEncounter, for StrictMode's double effect.
  queueMicrotask(() => {
    if (disposed) return;
    scene = new PhasePreviewScene(config, phaseIndex);
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: presentation.background,
      autoFocus: false,
      render: { antialias: true, roundPixels: false, preserveDrawingBuffer: true },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: host.clientWidth,
        height: host.clientHeight,
      },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
      scene,
      banner: false,
    });
  });
  return {
    setPhase: (index) => scene?.setPhase(index),
    destroy: () => {
      if (disposed) return;
      disposed = true;
      game?.destroy(true);
      game?.canvas?.remove();
    },
  };
}
