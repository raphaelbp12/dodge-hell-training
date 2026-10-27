/// <reference types="vite/client" />

declare module "virtual:build-info" {
  /** Full commit SHA the bundle was built from; empty for an unidentified build. */
  export const commitSha: string;
}
