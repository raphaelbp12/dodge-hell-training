import {
  CONDITION_LABELS,
  type ConditionKey,
  type VisibleCondition,
} from "../game/simulation/conditions";
import styles from "../App.module.css";

/**
 * Short consequence hints, each restating its authored description in
 * CONDITION_DESCRIPTIONS; a key without a hint shows none.
 */
const CONDITION_HINTS: Partial<Record<ConditionKey, string>> = {
  paralyzed: "Can't move",
  slowed: "Base speed only",
  confused: "Directions swapped",
  armorBroken: "DEF is 0",
  exposed: "DEF -20",
  cursed: "+25% damage",
  sick: "No regeneration",
};

export function ConditionList({
  conditions,
  showHints = false,
}: {
  conditions: readonly VisibleCondition[];
  showHints?: boolean;
}) {
  if (conditions.length === 0) return null;
  return (
    <ul aria-label="Active conditions" className={styles.conditionList}>
      {conditions.map((condition) => (
        <li key={condition.key} data-inert={condition.inert || undefined}>
          <span>
            {CONDITION_LABELS[condition.key]}
            {condition.inert && " (inert)"}
          </span>
          <span>{condition.remainingSeconds.toFixed(1)} s</span>
          {showHints && CONDITION_HINTS[condition.key] && (
            <small>{CONDITION_HINTS[condition.key]}</small>
          )}
        </li>
      ))}
    </ul>
  );
}
