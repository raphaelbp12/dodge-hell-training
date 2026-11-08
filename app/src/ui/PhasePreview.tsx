import { useEffect, useRef } from "react";
import type { EncounterConfig } from "../game/config/encounter";
import type { PhasePreviewHandle } from "../game/phaser/phase-preview";
import styles from "../App.module.css";

const PREVIEW_DEBOUNCE_MILLISECONDS = 120;

export function motionAllowed(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Props = { config: EncounterConfig; phaseIndex: number };

/**
 * The live Home preview (plan V17 H04): a separate, unsaved simulation that
 * exists only while no encounter is mounted. The module is imported
 * dynamically, so jsdom tests and the reduced-motion path never load Phaser.
 */
export function PhasePreview({ config, phaseIndex }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<PhasePreviewHandle | null>(null);
  const latestPhase = useRef(phaseIndex);
  latestPhase.current = phaseIndex;

  useEffect(() => {
    if (!motionAllowed()) return;
    let cancelled = false;
    void import("../game/phaser/phase-preview").then(({ createPhasePreview }) => {
      if (cancelled || !host.current) return;
      handle.current = createPhasePreview(
        host.current,
        config,
        latestPhase.current,
      );
    });
    return () => {
      cancelled = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => handle.current?.setPhase(phaseIndex),
      PREVIEW_DEBOUNCE_MILLISECONDS,
    );
    return () => window.clearTimeout(timer);
  }, [phaseIndex]);

  return (
    <div
      ref={host}
      className={styles.previewHost}
      data-phase-preview
      aria-hidden="true"
    />
  );
}
