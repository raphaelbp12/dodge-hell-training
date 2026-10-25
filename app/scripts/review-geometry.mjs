import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { V2_GEOMETRY_CANDIDATE as candidate } from "../src/game/config/geometry-candidate.ts";

const output = new URL("../test-results/geometry-review/", import.meta.url);
const decimal = (value) => value.toFixed(6);
const colors = { player: "#3f9988", head: "#b95c8c", shard: "#efc54a" };
const points = (body) =>
  body.verticesTiles.map((vertex) => `${vertex.x},${vertex.y}`).join(" ");
const drawBody = (name, horizontal, vertical, scale, angle = 0) => {
  const bodyPoints = points(candidate.bodies[name]);
  return `<g transform="translate(${horizontal} ${vertical}) rotate(${angle}) scale(${scale})">
    <polygon data-body="${name}" points="${bodyPoints}" fill="${colors[name]}"/>
    <polygon data-collider="${name}" points="${bodyPoints}" fill="none" stroke="#172326" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-dasharray="4 3"/>
    <path d="M -.08 0 H .08 M 0 -.08 V .08" stroke="#172326" stroke-width="1" vector-effect="non-scaling-stroke"/>
  </g>`;
};
const frame = (label, content, width = 600, height = 420) =>
  `<figure><figcaption>${label}</figcaption><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" viewBox="0 0 ${width} ${height}">${content}</svg></figure>`;

const comparison = frame(
  "Common scale: 96 pixels/tile; dashed collision outline uses identical vertices",
  `
  <path d="M 25 310 H 575" stroke="#ccd4d4"/>
  ${drawBody("player", 110, 170, 96)}
  ${drawBody("head", 280, 170, 96)}
  ${drawBody("shard", 520, 170, 96)}
  <g font-size="16" text-anchor="middle"><text x="110" y="330">Player</text><text x="280" y="330">Head (occluded reference)</text><text x="520" y="330">Shard</text></g>
  <g font-size="14" text-anchor="middle"><text x="110" y="358">${decimal(36 / candidate.sourcePixelsPerTile)} x ${decimal(33 / candidate.sourcePixelsPerTile)}</text><text x="280" y="358">${decimal(42 / candidate.sourcePixelsPerTile)} x ${decimal(55 / candidate.sourcePixelsPerTile)}</text><text x="520" y="358">${decimal(56.576 / candidate.sourcePixelsPerTile)} x ${decimal(34.66 / candidate.sourcePixelsPerTile)}</text></g>
  <text x="300" y="395" text-anchor="middle" font-size="14">Dimensions in tiles; cross marks the simulation/body-center anchor</text>`,
  660,
);

const diagramScale = 9.5;
const center = { x: 210, y: 210 };
const reach = candidate.arenaRadiusTiles * diagramScale;
const shardCenter = candidate.maximumShardCenterDistanceTiles * diagramScale;
const contact = frame(
  "Calibration only: stationary head at arena center; body touches R = 19.2 tiles",
  `
  <circle cx="${center.x}" cy="${center.y}" r="${reach}" fill="none" stroke="#53666a"/>
  <path d="M ${center.x} ${center.y} H ${center.x + reach}" stroke="#53666a" stroke-dasharray="5 4"/>
  ${drawBody("head", center.x, center.y, diagramScale)}
  ${drawBody("shard", center.x + shardCenter, center.y, diagramScale)}
  <circle cx="${center.x + candidate.emitterOffsetTiles * diagramScale}" cy="${center.y}" r="2.5" fill="#dc4c4c"/>
  <text x="420" y="150" font-size="14">R = 19.2</text><text x="420" y="175" font-size="14">C = ${decimal(candidate.maximumShardCenterDistanceTiles)}</text>
  <text x="420" y="200" font-size="14">e = ${decimal(candidate.emitterOffsetTiles)}</text>
  <text x="420" y="225" font-size="14">t = ${decimal(candidate.reversalAgeSeconds)} s</text>
  <text x="420" y="250" font-size="14">T = ${decimal(candidate.lifetimeSeconds)} s</text>
  <text x="300" y="410" text-anchor="middle" font-size="14">Play spawn stays north; off-arena shards still expire only by lifetime</text>`,
);

const zoomRows = [0.25, 1, 3]
  .map((zoom, index) => {
    const vertical = [70, 220, 430][index];
    return (
      `<text x="8" y="${vertical}" font-size="16">${zoom}x</text>` +
      drawBody("player", 110, vertical, 32 * zoom) +
      drawBody("head", 280, vertical, 32 * zoom) +
      drawBody("shard", 520, vertical, 32 * zoom, 30)
    );
  })
  .join("");
const zoomComparison = frame(
  "Approved min/default/max zoom at 32 pixels/tile; shard shown at 30 degrees",
  zoomRows,
  660,
  580,
);

const spawn = candidate.enemySpawnTiles;
const spawnMaximumRadiusTiles = Math.max(
  ...candidate.bodies.head.verticesTiles.map((vertex) =>
    Math.hypot(vertex.x + spawn.x, vertex.y + spawn.y),
  ),
);
const spawnReview = frame(
  "Actual north spawn fit; head outline stays inside the arena",
  `
  <circle cx="300" cy="210" r="${reach}" fill="none" stroke="#53666a"/>
  ${drawBody("head", 300 + spawn.x * diagramScale, 210 + spawn.y * diagramScale, diagramScale)}
  ${drawBody("player", 300, 210, diagramScale)}
  <text x="300" y="420" text-anchor="middle" font-size="15">Head center (0, -16.2); farthest vertex ${decimal(spawnMaximumRadiusTiles)} tiles</text>
  <text x="300" y="450" text-anchor="middle" font-size="15">Zero extra pursuit gap approved; runtime remains v1</text>`,
  600,
  490,
);

const diagonal = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const pursuitBodies = [candidate.bodies.player, candidate.bodies.head];
const axes = pursuitBodies.flatMap((body) =>
  body.verticesTiles.map((vertex, index, vertices) => {
    const next = vertices[(index + 1) % vertices.length];
    return { x: -(next.y - vertex.y), y: next.x - vertex.x };
  }),
);
const diagonalSeparationTiles = Math.min(
  ...axes.map((axis) => {
    const projectedDirection = Math.abs(
      axis.x * diagonal.x + axis.y * diagonal.y,
    );
    if (projectedDirection < Number.EPSILON) return Infinity;
    const support = pursuitBodies.reduce(
      (sum, body) =>
        sum +
        Math.max(
          ...body.verticesTiles.map(
            (vertex) => vertex.x * axis.x + vertex.y * axis.y,
          ),
        ),
      0,
    );
    return support / projectedDirection;
  }),
);
const summary = {
  approval: candidate.approval,
  sourcePixelsPerTile: candidate.sourcePixelsPerTile,
  emitterOffsetTiles: candidate.emitterOffsetTiles,
  maximumShardCenterDistanceTiles: candidate.maximumShardCenterDistanceTiles,
  reversalAgeSeconds: candidate.reversalAgeSeconds,
  lifetimeSeconds: candidate.lifetimeSeconds,
  conservativeLiveShardBound: candidate.conservativeLiveShardBound,
  spawnMaximumRadiusTiles,
  pursuit: { ...candidate.pursuit, diagonalSeparationTiles },
  bodies: Object.fromEntries(
    Object.entries(candidate.bodies).map(([name, body]) => [
      name,
      {
        verticesTiles: body.verticesTiles,
        widthTiles: body.sourceWidthPixels / candidate.sourcePixelsPerTile,
        heightTiles: body.sourceHeightPixels / candidate.sourcePixelsPerTile,
        dimensionToleranceSourcePixels: body.dimensionToleranceSourcePixels,
        aspectRange: [
          (body.sourceWidthPixels - body.dimensionToleranceSourcePixels.width) /
            (body.sourceHeightPixels +
              body.dimensionToleranceSourcePixels.height),
          (body.sourceWidthPixels + body.dimensionToleranceSourcePixels.width) /
            (body.sourceHeightPixels -
              body.dimensionToleranceSourcePixels.height),
        ],
      },
    ]),
  ),
};

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Step 8.2 approved geometry</title>
<style>body{margin:24px;color:#172326;background:#f4f7f6;font-family:Georgia,serif}h1{font-size:26px}p{max-width:80ch;line-height:1.5}.figures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;min-width:0}figcaption{font-size:16px;min-height:48px;line-height:1.4}svg{display:block;width:100%;height:auto;background:white}svg text{font-family:Georgia,serif;fill:#172326}@media(max-width:800px){body{margin:12px}.figures{grid-template-columns:1fr}h1{font-size:22px}}</style>
<h1>Step 8.2: Approved body geometry</h1><p>G01-G04 approved by the user on 2026-10-25. Original shapes only, not copied artwork. Player/head are upright and centered; the symmetric shard keeps its firing orientation on reversal. These figures are generated from the candidate's exact vertices, not separate approximations. Runtime is still v1.</p>
<div class="figures">${comparison}${contact}${zoomComparison}${spawnReview}</div>
<p>Approved shape/anchor choices retain the head's occlusion uncertainty and source-pixel review tolerances (player +/-2 x +/-2; head +/-2 x +/-7; shard +/-1 x +/-1), with zero additional pursuit gap. Geometry approval does not activate gameplay or certify ROTMG fidelity.</p></html>`;

await mkdir(output, { recursive: true });
await writeFile(new URL("index.html", output), html);
await writeFile(
  new URL("values.json", output),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary, null, 2));
console.log(`Review: ${fileURLToPath(new URL("index.html", output))}`);
