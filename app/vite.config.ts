import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Commit the bundle was built from, so the deployed build can be identified.
 *
 * GitHub Actions supplies GITHUB_SHA; a local build asks git. An unavailable
 * or non-repository build reports an empty string, and the footer then says
 * "local build" rather than inventing an identity.
 */
function resolveCommitSha(): string {
  const fromCi = process.env.GITHUB_SHA?.trim()
  if (fromCi) return fromCi
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

/**
 * Exposes the resolved commit as `virtual:build-info`, imported by App.tsx.
 *
 * A virtual module resolves through Vite's own module graph in both dev and
 * build, unlike the `define` config option, which this Vite version does not
 * substitute inside dev-server-transformed .tsx modules.
 */
function buildInfoPlugin(): Plugin {
  const moduleId = 'virtual:build-info'
  const resolvedId = `\0${moduleId}`
  return {
    name: 'build-info',
    resolveId(id) {
      if (id === moduleId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) {
        const commitSha = resolveCommitSha()
        return `export const commitSha = ${JSON.stringify(commitSha)};`
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/dodge-hell-training/',
  plugins: [react(), buildInfoPlugin()],
})
