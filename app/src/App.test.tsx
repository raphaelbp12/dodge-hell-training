import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import styles from "./test/probe.module.css";

const adapter = vi.hoisted(() => ({ active: 0, created: 0, destroyed: 0 }));

vi.mock("./game/phaser/encounter", () => ({
  createEncounter: (host: HTMLElement) => {
    adapter.created++;
    adapter.active++;
    const canvas = document.createElement("canvas");
    host.append(canvas);
    return {
      resume: vi.fn(),
      destroy: () => {
        adapter.active--;
        adapter.destroyed++;
        canvas.remove();
      },
    };
  },
}));

beforeEach(() => {
  adapter.active = 0;
  adapter.created = 0;
  adapter.destroyed = 0;
});

test("launches and unmounts one effective runtime under Strict Mode", async () => {
  const user = userEvent.setup();
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  expect(
    screen.getByRole("heading", { name: "Crystal Worm Child", level: 1 }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Launch encounter" }));
  expect(adapter.created).toBe(2);
  expect(adapter.destroyed).toBe(1);
  expect(adapter.active).toBe(1);
  expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Close encounter" }));
  expect(adapter.active).toBe(0);
  expect(view.container.querySelectorAll("canvas")).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Launch encounter" }));
  expect(adapter.active).toBe(1);
  view.unmount();
  expect(adapter.active).toBe(0);
});

test("loads scoped CSS Module styles", () => {
  render(<span className={styles.probe}>CSS Module probe</span>);

  const probe = screen.getByText("CSS Module probe");
  expect(styles.probe).not.toBe("probe");
  expect(probe).toHaveClass(styles.probe);
  expect(probe).toHaveStyle({ color: "rgb(20, 90, 70)" });
});
