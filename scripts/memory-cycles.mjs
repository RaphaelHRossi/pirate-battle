// Memory profiling: 5 cycles of start -> play (real input) -> leave against
// the production build, with a forced GC after each cycle. Writes
// docs/perf/memory.json. Run with `npm run perf:memory` (builds first).
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'docs/perf/memory.json')
const PORT = 4174
const BASE = `http://localhost:${PORT}`
const CYCLES = Number(process.env.MEMORY_CYCLES ?? 5)
const PLAY_SECONDS = Number(process.env.MEMORY_PLAY_SECONDS ?? 15)
const VIEWPORT = { width: 1280, height: 720 }

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const round2 = (value) => Math.round(value * 100) / 100
const mb = (bytes) => round2(bytes / 1024 / 1024)

function startPreview() {
  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, shell: true, stdio: 'ignore' },
  )
  return server
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(BASE)
      if (response.ok) return
    } catch {
      // Not up yet.
    }
    await sleep(500)
  }
  throw new Error(`Preview server did not start on ${BASE}`)
}

function stopPreview(server) {
  if (process.platform === 'win32' && server.pid) {
    // npx spawns a process tree on Windows; kill all of it.
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  } else {
    server.kill('SIGTERM')
  }
}

/** Forces a full GC, then reads the JS heap and the DOM canvases. */
async function measure(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage')
  await sleep(200)
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  const metric = (name) => metrics.find((m) => m.name === name)?.value ?? 0
  return {
    heapUsedMB: mb(metric('JSHeapUsedSize')),
    heapTotalMB: mb(metric('JSHeapTotalSize')),
    domNodes: metric('Nodes'),
    jsEventListeners: metric('JSEventListeners'),
    canvases: await page.locator('canvas').count(),
  }
}

/** Real keyboard input: sail, turn both ways and fire every gun. */
async function play(page, seconds) {
  const end = Date.now() + seconds * 1000
  await page.keyboard.down('ArrowUp')
  let step = 0
  while (Date.now() < end) {
    const turn = step % 4 < 2 ? 'ArrowLeft' : 'ArrowRight'
    await page.keyboard.down(turn)
    await page.keyboard.press('Space')
    await page.keyboard.press(step % 2 === 0 ? 'KeyQ' : 'KeyE')
    await sleep(400)
    await page.keyboard.up(turn)
    await sleep(100)
    step += 1
  }
  await page.keyboard.up('ArrowUp')
}

async function main() {
  const server = startPreview()
  const browser = await chromium.launch()
  try {
    await waitForServer()
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')

    // Test mode only exposes getState/getRenderStats; the clock is real.
    await page.goto(`${BASE}/?test=1#/`)
    await page.getByRole('button', { name: 'Play' }).waitFor()
    const baseline = await measure(page, cdp)
    console.log('baseline', baseline)

    const cycles = []
    for (let cycle = 1; cycle <= CYCLES; cycle++) {
      await page.getByRole('button', { name: 'Play' }).click()
      await page.locator('.game-host[data-status="ready"]').waitFor()
      await play(page, PLAY_SECONDS)
      const during = await page.evaluate(() => {
        // Runs in the page: globalThis is its window.
        const api = globalThis.__pirate
        if (!api) throw new Error('Test hooks are not installed')
        const { world } = api.getState()
        const alive = (list) => list.filter((item) => item.alive).length
        return {
          ...api.getRenderStats(),
          entities:
            1 +
            alive(world.enemies) +
            alive(world.projectiles) +
            alive(world.effects),
          status: world.match.status,
        }
      })
      // Leave the match: pause, then Main Menu (the match is abandoned).
      if (during.status === 'running') {
        await page.keyboard.press('KeyP')
        await page.getByRole('button', { name: 'Main Menu' }).click()
      } else {
        // Sunk before the end of the cycle: leave from the result screen.
        await page.waitForURL(/#\/result$/)
        await page.getByRole('button', { name: 'Main Menu' }).click()
      }
      await page.getByRole('button', { name: 'Play' }).waitFor()
      const after = await measure(page, cdp)
      const row = {
        cycle,
        ...after,
        gpuTexturesDuringPlay: during.gpuTextures,
        cachedTextures: during.cachedTextures,
        entitiesAtLeave: during.entities,
        matchStatusAtLeave: during.status,
      }
      cycles.push(row)
      console.log(row)
    }

    const last = cycles.at(-1)
    const first = cycles[0]
    const result = {
      recordedAt: new Date().toISOString(),
      browser: `Chromium ${browser.version()} (Playwright, headless)`,
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      cycles: CYCLES,
      playSecondsPerCycle: PLAY_SECONDS,
      baseline,
      results: cycles,
      summary: {
        heapGrowthFromBaselineMB: round2(last.heapUsedMB - baseline.heapUsedMB),
        heapGrowthFromCycle1MB: round2(last.heapUsedMB - first.heapUsedMB),
        canvasesAfterEachCycle: cycles.map((c) => c.canvases),
        cachedTexturesPerCycle: cycles.map((c) => c.cachedTextures),
      },
      consoleErrors: errors,
    }
    await mkdir(dirname(OUT), { recursive: true })
    await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`)
    console.table(
      cycles.map(
        ({
          cycle,
          heapUsedMB,
          canvases,
          gpuTexturesDuringPlay,
          cachedTextures,
        }) => ({
          cycle,
          heapUsedMB,
          canvases,
          gpuTexturesDuringPlay,
          cachedTextures,
        }),
      ),
    )
    console.log(`Wrote ${OUT}`)
    if (errors.length > 0) {
      console.error('Console errors during the run:', errors)
      process.exitCode = 1
    }
  } finally {
    await browser.close()
    stopPreview(server)
  }
}

await main()
