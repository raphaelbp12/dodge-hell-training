export function freePort(): Promise<number>;
export function sharedFreePort(
  name: string,
  env?: Record<string, string | undefined>,
  draw?: () => Promise<number>,
  avoid?: number[],
): Promise<number>;
export const TEST_PORT_ENV: string;
export const PREVIEW_PORT_ENV: string;
