import type { EncounterConfig } from "../game/config/encounter";
import { palette } from "../game/config/palette";
import { arenaExtentTiles, octagonBoundaryPath } from "../game/phaser/arena-plate";
import { hazardOutlinesOf } from "../game/phaser/terrain-art";
import styles from "../App.module.css";

/**
 * A still SVG of the selected arena, the reduced-motion fallback under the
 * live preview. It is SVG, not canvas, so Home keeps no canvas of its own.
 */
export function ArenaPlate({ arena }: { arena: EncounterConfig["arena"] }) {
  const { shape } = arena;
  const extent = arenaExtentTiles(shape) * 1.04;
  const floorProps = {
    fill: palette.arena.ground,
    stroke: palette.arena.boundary,
    strokeWidth: 3,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg
      className={styles.arenaPlate}
      viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
      aria-hidden="true"
    >
      <g transform={`translate(${shape.centerTiles.x} ${shape.centerTiles.y})`}>
        {shape.kind === "circle" ? (
          <circle r={shape.radiusTiles} {...floorProps} />
        ) : (
          <path d={octagonBoundaryPath(shape)} {...floorProps} />
        )}
        {hazardOutlinesOf(arena.hazards).map((outline, index) =>
          outline.kind === "diamond" ? (
            <polygon
              key={index}
              points={outline.verticesTiles.map((v) => `${v.x},${v.y}`).join(" ")}
              fill={palette.arena.honey}
              stroke={palette.arena.honeyRim}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <g key={index}>
              <circle
                r={(outline.innerRadiusTiles + outline.outerRadiusTiles) / 2}
                fill="none"
                stroke={palette.arena.honey}
                strokeWidth={outline.outerRadiusTiles - outline.innerRadiusTiles}
              />
              {[outline.innerRadiusTiles, outline.outerRadiusTiles].map((r) => (
                <circle
                  key={r}
                  r={r}
                  fill="none"
                  stroke={palette.arena.honeyRim}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          ),
        )}
      </g>
    </svg>
  );
}
