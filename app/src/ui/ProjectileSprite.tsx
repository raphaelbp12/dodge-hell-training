import type { ProjectileSpec } from "../game/config/encounter";
import { palette } from "../game/config/palette";
import { appearanceRects } from "../game/phaser/appearance-pixels";

type Props = { projectile: ProjectileSpec; sizePixels?: number };

/** A projectile's pixel art as inline SVG, so Home needs no canvas. */
export function ProjectileSprite({ projectile, sizePixels = 36 }: Props) {
  const { appearance } = projectile;
  if (appearance?.bomb) {
    return (
      <svg viewBox="-1 -1 2 2" width={sizePixels} height={sizePixels} aria-hidden="true">
        <circle
          r="0.8"
          fill={appearance.bomb.bodyColor}
          stroke={palette.arena.bombKeyline}
          strokeWidth="0.08"
        />
      </svg>
    );
  }
  if (appearance && appearance.nativeWidthPixels > 0) {
    return (
      <svg
        viewBox={`0 0 ${appearance.nativeWidthPixels} ${appearance.nativeHeightPixels}`}
        width={sizePixels}
        height={sizePixels}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {appearanceRects(appearance).map((rect) => (
          <rect
            key={`${rect.x}-${rect.y}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={1}
            fill={rect.colour}
          />
        ))}
      </svg>
    );
  }
  // No pixel art (the Crystal Worm shard): its polygon body in the gold fallback.
  const extent = Math.max(
    ...projectile.verticesTiles.flatMap((v) => [Math.abs(v.x), Math.abs(v.y)]),
  );
  const points = projectile.verticesTiles.map((v) => `${v.x},${v.y}`).join(" ");
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
      width={sizePixels}
      height={sizePixels}
      aria-hidden="true"
    >
      <polygon points={points} fill={palette.entity.shard} />
    </svg>
  );
}
