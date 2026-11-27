// Free-port helper (plan V25 D-25-3): asks the operating system for an unused
// TCP port by listening on port 0, then releases it.
import { createServer } from "node:net";

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
 */
export async function sharedFreePort(name, env = process.env, draw = freePort) {
  const stored = env[name];
  if (stored) return Number(stored);
  const port = await draw();
  env[name] = String(port);
  return port;
}
