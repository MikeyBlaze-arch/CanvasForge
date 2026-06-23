import { spawn } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = resolve(projectRoot, 'release')
const tempOutputDir = resolve(tmpdir(), 'CanvasForge-release-build')

function ensureInsideProject(path) {
  const normalizedRoot = projectRoot.endsWith(sep) ? projectRoot : `${projectRoot}${sep}`
  if (path !== projectRoot && !path.startsWith(normalizedRoot)) {
    throw new Error(`Refusing to modify path outside project: ${path}`)
  }
}

function runElectronBuilder() {
  return new Promise((resolvePromise, reject) => {
    const args = [
      'electron-builder',
      '--win',
      `--config.directories.output=${tempOutputDir}`,
    ]
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx', ...args], {
          cwd: projectRoot,
          stdio: 'inherit',
        })
      : spawn('npx', args, {
          cwd: projectRoot,
          stdio: 'inherit',
        })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        reject(new Error(`electron-builder exited with code ${code}`))
      }
    })
  })
}

ensureInsideProject(releaseDir)

await rm(tempOutputDir, { recursive: true, force: true })
await runElectronBuilder()

await rm(releaseDir, { recursive: true, force: true })
await mkdir(releaseDir, { recursive: true })
await cp(tempOutputDir, releaseDir, { recursive: true })

console.log(`Windows release artifacts copied to ${releaseDir}`)
