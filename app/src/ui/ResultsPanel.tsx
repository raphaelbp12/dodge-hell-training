import type { RefObject } from "react";
import { DEBUG_RULES_VERSION } from "../game/config/debug";
import type { EncounterConfig } from "../game/config/encounter";
import type { EncounterView } from "../game/phaser/encounter";
import type { HistorySnapshot } from "../storage/attempts";
import { History } from "./History";
import { compareResult, selectedRulesVersion } from "./historyModel";
import styles from "../App.module.css";

type Props = {
  view: EncounterView;
  config: EncounterConfig;
  displayName: string;
  historySnapshot: HistorySnapshot;
  heading: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
  onHome: () => void;
};

/** Always rendered with a finished attempt, so `view.result` is present. */
export function ResultsPanel({
  view,
  config,
  displayName,
  historySnapshot,
  heading,
  onRetry,
  onHome,
}: Props) {
  const result = view.result!;
  const rulesVersion = selectedRulesVersion(config, view.drill);
  const isDebug = result.rulesVersion === DEBUG_RULES_VERSION;
  const comparison = isDebug
    ? null
    : compareResult(result.elapsedSeconds, historySnapshot.records, rulesVersion);
  return (
    <section className={styles.results} aria-labelledby="result-title">
      <span className={styles.resultsName}>{displayName}</span>
      <h2 id="result-title" ref={heading} tabIndex={-1}>
        {result.outcome === "cleared" ? "Boss defeated" : "Attempt complete"}
      </h2>
      {isDebug && <p className={styles.debugBadge}>Debug attempt / not saved</p>}
      <dl>
        <div>
          <dt>Survival time</dt>
          <dd className={styles.resultTime}>
            {result.elapsedSeconds.toFixed(2)} s
          </dd>
        </div>
        <div>
          <dt>Hits taken</dt>
          <dd>{result.hitsTaken}</dd>
        </div>
        {view.bossHealthFraction !== null && (
          <>
            <div>
              <dt>Reached</dt>
              <dd>{view.phaseLabel}</dd>
            </div>
            <div>
              <dt>Boss progress</dt>
              <dd>{Math.ceil(view.bossHealthFraction * 100)}% left</dd>
            </div>
          </>
        )}
      </dl>
      {comparison && (
        <p
          className={
            comparison.kind === "best" ? styles.newBest : styles.comparison
          }
        >
          {comparison.kind === "first" && "First attempt on this selection"}
          {comparison.kind === "best" && "New best"}
          {comparison.kind === "short" &&
            `${comparison.seconds.toFixed(2)} s short of your best`}
        </p>
      )}
      {!!view.finalHitAmounts?.length && (
        <div
          role="group"
          aria-label="Final hit amounts"
          className={styles.finalHits}
        >
          {view.finalHitAmounts.map((amount, index) => (
            <span key={index}>-{amount}</span>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="button" onClick={onRetry}>
          Retry
        </button>
        <button type="button" onClick={onHome}>
          Home
        </button>
      </div>
      <History snapshot={historySnapshot} rulesVersion={rulesVersion} />
    </section>
  );
}
