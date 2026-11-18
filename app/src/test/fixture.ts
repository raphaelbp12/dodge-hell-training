/**
 * Casts a deliberately invalid or partial fixture to `T` so a validator test
 * can feed it the production entry point. The cast sits behind a function
 * call, not on an object literal, so a fixture that should be complete is
 * typed with `const x: T = {...}` (checked by `tsc`) and only a fixture meant
 * to break the type goes through here.
 */
export function unsafeFixture<T>(value: object): T {
  return value as T;
}
