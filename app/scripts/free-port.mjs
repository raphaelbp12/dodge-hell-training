// Free-port helper (plan V25 D-25-3): asks the operating system for an unused
// TCP port by listening on port 0, then releases it.
import { createServer } from "node:net";

/** Environment variable names that carry the shared Playwright ports. */
export const TEST_PORT_ENV = "PLAYWRIGHT_TEST_PORT";
export const PREVIEW_PORT_ENV = "PLAYWRIGHT_PREVIEW_PORT";

/** Returns a free TCP port, chosen by the operating system. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/**
 * Returns the port stored in `env[name]`, or draws one and stores it there.
 *
 * Playwright evaluates its config again in every worker process. The parent
 * draws the port and the workers, which inherit the environment, read it.
 * Ports in `avoid` are never returned: a stored match is replaced by a new draw.
 */
export async function sharedFreePort(
  name,
  env = process.env,
  draw = freePort,
  avoid = [],
) {
  const stored = env[name];
  const value = Number(stored);
  if (
    stored &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535 &&
    !avoid.includes(value)
  ) {
    return value;
  }
  let port = await draw();
  for (let attempt = 0; avoid.includes(port); attempt++) {
    if (attempt >= 20)
      throw new Error(
        `Could not draw a port distinct from ${avoid.join(", ")}`,
      );
    port = await draw();
  }
  env[name] = String(port);
  return port;
}
