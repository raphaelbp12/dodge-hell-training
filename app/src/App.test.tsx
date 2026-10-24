import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import App from "./App";
import styles from "./test/probe.module.css";

test("renders the starter and increments its counter", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "Get started", level: 1 }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Count is 0" }));
  expect(screen.getByRole("button", { name: "Count is 1" })).toBeVisible();
});

test("loads scoped CSS Module styles", () => {
  render(<span className={styles.probe}>CSS Module probe</span>);

  const probe = screen.getByText("CSS Module probe");
  expect(styles.probe).not.toBe("probe");
  expect(probe).toHaveClass(styles.probe);
  expect(probe).toHaveStyle({ color: "rgb(20, 90, 70)" });
});
