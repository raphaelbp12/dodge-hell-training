import type { EncounterConfig } from "../game/config/encounter";
import { phaseDossier } from "../game/config/phaseDossier";
import { CONDITION_LABELS } from "../game/simulation/conditions";
import { ProjectileSprite } from "./ProjectileSprite";
import { subPhaseWords } from "./phaseLadderModel";
import styles from "../App.module.css";

const capitalised = (word: string) => `${word[0].toUpperCase()}${word.slice(1)}`;

/** What the hovered or selected phase throws, read straight from config. */
export function PhaseDossier({
  config,
  phaseIndex,
  label,
}: {
  config: EncounterConfig;
  phaseIndex: number;
  label: string;
}) {
  const dossier = phaseDossier(config, phaseIndex);
  const { damageRange } = dossier;
  return (
    <section className={styles.dossier} aria-label="Phase details">
      <h3>{label}</h3>
      <div className={styles.dossierSprites}>
        {dossier.projectiles.map((projectile) => (
          <span key={projectile.id} title={projectile.id}>
            <ProjectileSprite projectile={projectile} />
          </span>
        ))}
      </div>
      <ul>
        {damageRange && (
          <li>
            Damage {damageRange.min}
            {damageRange.max !== damageRange.min && ` to ${damageRange.max}`} HP
          </li>
        )}
        {dossier.armorPiercing && <li>Armor piercing</li>}
        {dossier.conditions.map((condition) => (
          <li key={condition.key}>
            {CONDITION_LABELS[condition.key]} for {condition.seconds} s
          </li>
        ))}
        {dossier.motions.length > 0 && (
          <li>{dossier.motions.map(capitalised).join(", ")}</li>
        )}
        {dossier.subPhaseIds.length > 0 && (
          <li>Cycles {dossier.subPhaseIds.map(subPhaseWords).join(", ")}</li>
        )}
        {dossier.minions.map((minion) => (
          <li key={minion.archetypeId}>
            {minion.count} x {subPhaseWords(minion.archetypeId)}
          </li>
        ))}
      </ul>
    </section>
  );
}
