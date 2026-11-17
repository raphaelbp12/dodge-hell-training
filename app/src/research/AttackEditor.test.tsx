import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AUTHORED_ARCHETYPES, type AuthoredAttack } from "../game/config/data";
import { encounterConfigOf } from "../game/config/encounter";
import { AttackEditor } from "./AttackEditor";
import * as help from "./helpText";
import type { AttackChange } from "./monsterDraft";

const config = encounterConfigOf("killer-bee-queen");

const allAttacks: AuthoredAttack[] = Object.values(AUTHORED_ARCHETYPES).flatMap((archetype) =>
  archetype.phases.flatMap((phase) => [
    ...phase.attacks,
    ...(phase.subPhases ?? []).flatMap((sub) => sub.attacks),
  ]),
);
const kindOf = (attack: AuthoredAttack) => (attack.pattern as unknown as { kind: string }).kind;
const ringAttack = allAttacks.find((attack) => kindOf(attack) === "ring")!;
const spreadAttack = allAttacks.find(
  (attack) => kindOf(attack) === "spread" && config.projectiles[attack.projectile],
)!;

function renderEditor(attack: AuthoredAttack, extra: Partial<Parameters<typeof AttackEditor>[0]> = {}) {
  const apply = vi.fn<(change: AttackChange) => boolean>(() => true);
  render(<AttackEditor attack={attack} config={config} apply={apply} {...extra} />);
  return apply;
}

describe("the editor of a spread attack", () => {
  test("names the attack and shows its authored values", () => {
    renderEditor(spreadAttack);
    expect(screen.getByRole("group", { name: `Editing ${spreadAttack.id}` })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: `Projectile of ${spreadAttack.id}` })).toHaveValue(spreadAttack.projectile);
    expect(screen.getByRole("combobox", { name: `Pattern kind of ${spreadAttack.id}` })).toHaveValue("spread");
    expect(screen.getByRole("spinbutton", { name: `Shot interval (s) of ${spreadAttack.id}` })).toHaveValue(
      spreadAttack.cadence.shotIntervalSeconds ?? NaN,
    );
  });

  test("changing the projectile reports a projectile change", async () => {
    const user = userEvent.setup();
    const apply = renderEditor(spreadAttack);
    const other = Object.keys(config.projectiles).find((id) => id !== spreadAttack.projectile)!;
    await user.selectOptions(screen.getByRole("combobox", { name: `Projectile of ${spreadAttack.id}` }), other);
    expect(apply).toHaveBeenCalledWith({ field: "projectile", value: other });
  });

  test("changing the aim reports an aim change", async () => {
    const user = userEvent.setup();
    const apply = renderEditor(spreadAttack);
    const aims = ["player", "front", "fixed"];
    const target = aims.find((aim) => aim !== (spreadAttack.pattern as unknown as { aim: string }).aim)!;
    await user.selectOptions(screen.getByRole("combobox", { name: `Aim of ${spreadAttack.id}` }), target);
    expect(apply).toHaveBeenCalledWith({ field: "aim", value: target });
  });

  test("committing a cadence value reports a cadence change with the number", async () => {
    const user = userEvent.setup();
    const apply = renderEditor(spreadAttack);
    const input = screen.getByRole("spinbutton", { name: `Cooldown after last shot (s) of ${spreadAttack.id}` });
    await user.clear(input);
    await user.type(input, "2.5");
    await user.tab();
    expect(apply).toHaveBeenCalledWith({
      field: "cadence",
      key: "cooldownAfterLastShotSeconds",
      value: 2.5,
    });
  });

  test("a blank cadence value is refused without reporting", async () => {
    const user = userEvent.setup();
    const apply = renderEditor(spreadAttack);
    const input = screen.getByRole("spinbutton", { name: `Cooldown after last shot (s) of ${spreadAttack.id}` });
    await user.clear(input);
    await user.tab();
    expect(apply).not.toHaveBeenCalled();
  });

  test("the target checkbox reports player or null", async () => {
    const user = userEvent.setup();
    const apply = renderEditor(spreadAttack);
    const box = screen.getByRole("checkbox", { name: `Target the player: ${spreadAttack.id}` });
    await user.click(box);
    expect(apply).toHaveBeenCalledWith({ field: "target", value: box.hasAttribute("checked") ? null : "player" });
  });

  test("each section carries its help text", () => {
    renderEditor(spreadAttack);
    const texts = screen.getAllByRole("img", { name: "Help" }).map((mark) => mark.getAttribute("title"));
    expect(texts).toContain(help.HELP_ATTACK_PROJECTILE);
    expect(texts).toContain(help.HELP_COOLDOWN);
    expect(texts).toContain(help.HELP_PATTERN_AIM);
  });
});

describe("the editor of a ring attack", () => {
  test("shows ring fields and no aim", () => {
    renderEditor(ringAttack);
    expect(screen.getByRole("spinbutton", { name: `Arms of ${ringAttack.id}` })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: `Arm pattern of ${ringAttack.id}` })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: `Aim of ${ringAttack.id}` })).not.toBeInTheDocument();
  });

  test("choosing a single arm pattern clears it, choosing spread installs its defaults", async () => {
    const user = userEvent.setup();
    const apply = renderEditor(ringAttack);
    const select = screen.getByRole("combobox", { name: `Arm pattern of ${ringAttack.id}` });
    await user.selectOptions(select, "spread");
    expect(apply).toHaveBeenLastCalledWith({
      field: "pattern",
      key: "armPattern",
      value: { kind: "spread", shots: 2, arcDegrees: 30 },
    });
    await user.selectOptions(select, "single");
    expect(apply).toHaveBeenLastCalledWith({ field: "pattern", key: "armPattern", value: undefined });
  });
});

describe("deleting", () => {
  test("there is no Delete button without an onDelete handler", () => {
    renderEditor(spreadAttack);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  test("Delete calls the handler, and confirming shows Confirm delete and Cancel", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onCancelDelete = vi.fn();
    renderEditor(spreadAttack, { onDelete, onCancelDelete, confirmingDelete: true });
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelDelete).toHaveBeenCalledTimes(1);
  });
});
