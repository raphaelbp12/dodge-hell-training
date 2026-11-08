/**
 * Mirrors `TelegraphColorName` in `data.ts`. It is written out here so this
 * file has no imports and the Playwright project can load it directly.
 */
type TelegraphColorName = "white" | "amber" | "red" | "violet" | "cyan";

/**
 * The single colour source for CSS and Phaser (plan V17 H01). Presentation
 * only: no value here changes a gameplay rule. Entity, health and telegraph
 * colours are unchanged from before the redesign because they carry gameplay
 * meaning.
 */
export const palette = {
  ui: {
    night: "#15111B",
    comb: "#1E1A26",
    combRaised: "#262131",
    seam: "#3A3246",
    wax: "#EFE6D8",
    smoke: "#A89BB0",
    honey: "#F2A91E",
    ember: "#E5482F",
    crystal: "#69E8EA",
    coral: "#EA7969",
    warning: "#FF8FA3",
  },
  arena: {
    background: "#15111B",
    ground: "#1E1A26",
    groundCellLight: "#252030",
    groundCellDark: "#1A1622",
    grid: "#2F2839",
    boundary: "#7A6C8A",
    honey: "#4A2F0C",
    honeyRim: "#FFCF7A",
    bombKeyline: "#EFE6D8",
  },
  entity: {
    player: "#F0F5EF",
    enemy: "#EA7969",
    shard: "#FFDF69",
    spentShard: "#C9A948",
    lobTelegraph: "#FF5F5F",
  },
  health: {
    fill: "#55D6A0",
    empty: "#592E39",
    border: "#15111B",
  },
  telegraph: {
    white: "#FFFFFF",
    amber: "#FFB347",
    red: "#FF5F5F",
    violet: "#B388FF",
    cyan: "#69E8EA",
  } satisfies Record<TelegraphColorName, string>,
  hitNumber: { fill: "#FF8FA3", stroke: "#15111B" },
  conditionChip: {
    activeFill: "#55303A",
    inertFill: "#2A2A2A",
    activeText: "#FFDF69",
    inertText: "#7A7A7A",
  },
} as const;

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** CSS custom properties for every colour the stylesheets use. */
export function paletteCssVariables(): Readonly<Record<string, string>> {
  const { ui, health, telegraph } = palette;
  return {
    "--night": ui.night,
    "--comb": ui.comb,
    "--comb-raised": ui.combRaised,
    "--seam": ui.seam,
    "--wax": ui.wax,
    "--smoke": ui.smoke,
    "--honey": ui.honey,
    "--ember": ui.ember,
    "--crystal": ui.crystal,
    "--coral": ui.coral,
    "--warning": ui.warning,
    "--hp-fill": health.fill,
    "--hp-empty": health.empty,
    "--telegraph-white": telegraph.white,
    "--telegraph-amber": telegraph.amber,
    "--telegraph-red": telegraph.red,
    "--telegraph-violet": telegraph.violet,
    "--telegraph-cyan": telegraph.cyan,
  };
}
