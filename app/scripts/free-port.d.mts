export function freePort(): Promise<number>;
export function sharedFreePort(
  name: string,
  env?: Record<string, string | undefined>,
  draw?: () => Promise<number>,
): Promise<number>;
