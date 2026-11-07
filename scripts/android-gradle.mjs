// Runs the Gradle wrapper in android/ on any OS (npm on Windows cannot resolve a bare `gradlew`).
// Usage: node scripts/android-gradle.mjs assembleRelease
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const androidDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android')
const isWindows = process.platform === 'win32'
const wrapper = path.join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew')

const result = spawnSync(isWindows ? `"${wrapper}"` : wrapper, process.argv.slice(2), {
  cwd: androidDir,
  stdio: 'inherit',
  // .bat files need a shell on Windows; quote the path in case it has spaces.
  shell: isWindows,
})
process.exit(result.status ?? 1)
