// Worst-case performance run: the `stress` fixture (12 Shooters firing
// around a player that cannot sink) for a 60 s match in the production
// build with ?perf=1. Writes docs/perf/stress.json.
// Run with `npm run perf:stress` (builds first).
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'docs/perf/stress.json')
const PORT = 4174
const BASE = `http://localhost:${PORT}`
const SESSION_SECONDS = 60
const SAMPLE_EVERY_MS = 5000
const VIEWPORT = { width: 1920, height: 1080 }
// Hardware rendering in headless mode (Windows: ANGLE on Direct3D 11).
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function startPreview() {
  return spawn(`npx vite preview --port ${PORT} --strictPort`, {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
  })
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      // Not up yet.
    }
    await sleep(500)
  }
  throw new Error(`Preview server did not start on ${BASE}`)
}

function stopPreview(server) {
  if (process.platform === 'win32' && server.pid) {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  } else {
    server.kill('SIGTERM')
  }
}

/** Installed Chrome if present (what players use), else Playwright's build. */
async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome', args: GPU_ARGS })
  } catch {
    return chromium.launch({ args: GPU_ARGS })
  }
}

async function main() {
  const server = startPreview()
  const browser = await launch()
  try {
    await waitForServer()
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    const consoleErrors = []
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    // A 60 s match at the default spawn interval (the fixture disables
    // spawning anyway); options are read when the match starts.
    await page.goto(`${BASE}/#/`)
    await page.evaluate((seconds) => {
      localStorage.setItem(
        'pirate-battle:options',
        JSON.stringify({
          version: 1,
          sessionSeconds: seconds,
          spawnSeconds: 3,
        }),
      )
    }, SESSION_SECONDS)
    const webglRenderer = await page.evaluate(() => {
      // Runs in the page: globalThis is its window.
      const gl = globalThis.document
        .createElement('canvas')
        .getContext('webgl2')
      if (!gl) return 'no WebGL2'
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      return String(
        info
          ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
      )
    })
    console.log('Renderer:', webglRenderer)

    await page.goto(`${BASE}/?test=1&perf=1&fixture=stress&seed=1#/play`)
    await page
      .locator('.game-host[data-status="ready"]')
      .waitFor({ timeout: 30_000 })

    // Real input all match long: the player circles without firing, so the
    // 12 Shooters stay alive and keep shooting at it.
    await page.keyboard.down('ArrowUp')
    await page.keyboard.down('ArrowLeft')
    const samples = []
    const started = Date.now()
    while (!page.url().endsWith('#/result')) {
      await sleep(SAMPLE_EVERY_MS)
      const sample = await page.evaluate(() => {
        // Runs in the page: globalThis is its window.
        const api = globalThis.__pirate
        if (!api) return null
        const { world } = api.getState()
        const alive = (list) => list.filter((item) => item.alive).length
        return {
          secondsLeft: Math.ceil(world.match.secondsLeft),
          status: world.match.status,
          enemiesAlive: alive(world.enemies),
          enemyProjectiles: world.projectiles.filter(
            (p) => p.alive && p.owner === 'enemy',
          ).length,
          projectiles: alive(world.projectiles),
          effects: alive(world.effects),
          entities:
            1 +
            alive(world.enemies) +
            alive(world.projectiles) +
            alive(world.effects),
          playerHp: world.player.hp,
        }
      })
      if (sample && sample.status === 'running') {
        samples.push({
          atSeconds: Math.round((Date.now() - started) / 1000),
          ...sample,
        })
        console.log(samples.at(-1))
      }
      if (Date.now() - started > (SESSION_SECONDS + 30) * 1000) {
        throw new Error('The match did not end in time')
      }
    }
    await page.keyboard.up('ArrowLeft')
    await page.keyboard.up('ArrowUp')

    const raw = await page.evaluate(() =>
      localStorage.getItem('pirate-battle:perf-report'),
    )
    if (!raw) throw new Error('No performance report was stored')
    const report = JSON.parse(raw)
    // The full frozen config is in the code; keep the summary only.
    delete report.config.full

    const minEnemiesAlive = Math.min(...samples.map((s) => s.enemiesAlive))
    const result = {
      recordedAt: new Date().toISOString(),
      browser: `${browser.browserType().name()} ${browser.version()} (headless, ${GPU_ARGS.join(' ')})`,
      webglRenderer,
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      fixture: 'stress',
      input: 'ArrowUp + ArrowLeft held (circling, not firing)',
      report,
      samples,
      minEnemiesAlive,
      consoleErrors,
    }
    await mkdir(dirname(OUT), { recursive: true })
    await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`)
    console.log('frameTimeMs', report.frameTimeMs)
    console.log('workTimeMs', report.workTimeMs)
    console.log('entities', report.entities, 'minEnemiesAlive', minEnemiesAlive)
    console.log(`Wrote ${OUT}`)

    if (minEnemiesAlive < 12 || consoleErrors.length > 0) {
      console.error('Invalid run:', { minEnemiesAlive, consoleErrors })
      process.exitCode = 1
    }
  } finally {
    await browser.close()
    stopPreview(server)
  }
}

await main()
