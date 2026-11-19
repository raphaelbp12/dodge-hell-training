// Test support (plan V22 A07): the projectile catalog, split by motion
// kind and by the bomb type, for property-test generators.
import {
  ENCOUNTER_CONFIGS,
  type AttackSpec,
  type CadencedAttackSpec,
  type BombSpec,
  type BulletSpec,
  type EncounterConfig,
} from "../config/encounter";

export type CatalogEntry<Spec> = Readonly<{
  encounterId: string;
  config: EncounterConfig;
  projectile: Spec;
}>;

const bullets: CatalogEntry<BulletSpec>[] = [];
const bombs: CatalogEntry<BombSpec>[] = [];
for (const [encounterId, config] of Object.entries(ENCOUNTER_CONFIGS)) {
  for (const projectile of Object.values(config.projectiles)) {
    if (projectile.type === "bomb")
      bombs.push({ encounterId, config, projectile });
    else bullets.push({ encounterId, config, projectile });
  }
}

/**
 * No shipped projectile uses the `turning` or `wavy` motion today, so a derived
 * variant of the first shipped linear bullet stands in for each missing kind.
 * The values are the source rows already used by `projectiles.test.ts`: turning
 * at 70 degrees per second and wavy at 0.8 tiles and 1 Hz, both over 16 tiles.
 * They are test inputs, not gameplay values.
 */
function derivedCurvedEntries(): CatalogEntry<BulletSpec>[] {
  const template = bullets.find((entry) => entry.projectile.motion.kind === "linear");
  if (!template) return [];
  const present = new Set(bullets.map((entry) => entry.projectile.motion.kind));
  const derived: CatalogEntry<BulletSpec>[] = [];
  const withProjectile = (projectile: BulletSpec): CatalogEntry<BulletSpec> => ({
    ...template,
    config: {
      ...template.config,
      projectiles: { ...template.config.projectiles, [projectile.id]: projectile },
    },
    projectile,
  });
  if (!present.has("turning"))
    derived.push(
      withProjectile({
        ...template.projectile,
        id: `${template.projectile.id}-derived-turning`,
        motion: { kind: "turning", rangeTiles: 16, turnRateDegreesPerSecond: 70 },
      }),
    );
  if (!present.has("wavy"))
    derived.push(
      withProjectile({
        ...template.projectile,
        id: `${template.projectile.id}-derived-wavy`,
        motion: { kind: "wavy", rangeTiles: 16, amplitudeTiles: 0.8, frequencyHz: 1 },
      }),
    );
  return derived;
}
bullets.push(...derivedCurvedEntries());

export const SHIPPED_BOMBS: readonly CatalogEntry<BombSpec>[] = bombs;

/** Shipped bullets of one motion kind. */
export function shippedBullets(
  kind: BulletSpec["motion"]["kind"],
): readonly CatalogEntry<BulletSpec>[] {
  return bullets.filter((entry) => entry.projectile.motion.kind === kind);
}

export const SHIPPED_BULLETS: readonly CatalogEntry<BulletSpec>[] = bullets;

/** Narrows a shipped attack to its cadence form; throws on a marked attack (plan V23 Q10). */
export function cadenced<T extends AttackSpec>(attack: T | undefined): T & CadencedAttackSpec {
  if (!attack || attack.cadence === undefined) throw new Error("expected a cadence attack");
  return attack as T & CadencedAttackSpec;
}
