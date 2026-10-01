import { Application } from 'pixi.js'
import { snapshotConfig } from '../game/config'
import { applyFixture } from '../game/fixtures'
import { step } from '../game/step'
import type { InputIntents, World } from '../game/types'
import { createWorld } from '../game/world'
import { clearInput, createInputState } from '../input/InputState'
import {
  attachKeyboard,
  attachResumeKeys,
  type KeyboardControls,
} from '../input/keyboard'
import { loadGameAssets } from '../render/assets'
import { MAX_RESOLUTION } from '../render/constants'
import { GameRenderer } from '../render/GameRenderer'
import { FixedStepLoop } from './loop'
import { installTestHooks, readTestParams, type TestParams } from './testHooks'

interface Match {
  world: World
  input: InputIntents
  loop: FixedStepLoop
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/**
 * Owns one Pixi Application, the match running in it, the frame loop and
 * every listener. A session is single-use: once destroyed it cannot be
 * started again.
 */
export class GameSession {
  /** Aborting this removes every listener the session ever attached. */
  private readonly abort = new AbortController()
  private readonly host: HTMLElement
  private readonly params: TestParams
  private app: Application | null = null
  private match: Match | null = null
  private disposed = false
  private paused = false
  /** Set by the test hook `pauseClock()`; independent of player pause. */
  private clockPaused = false
  private frameId: number | null = null
  /** Lives while gameplay keys are attached; aborted on pause. */
  private gameplay: AbortController | null = null
  private keyboard: KeyboardControls | null = null
  /** Lives while paused; aborted on resume. */
  private pauseScope: AbortController | null = null
  private uninstallTestHooks: (() => void) | null = null

  constructor(host: HTMLElement, search: string = window.location.search) {
    this.host = host
    this.params = readTestParams(search)
    this.clockPaused = this.params.testMode && this.params.manualClock
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  // A method call (not a property read) so TypeScript does not narrow the flag
  // across `await`; destroy() can flip it while start() is suspended.
  private wasDisposed(): boolean {
    return this.disposed
  }

  async start(): Promise<void> {
    const app = new Application()
    await app.init({
      background: '#0a1f2e',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, MAX_RESOLUTION),
      width: Math.max(1, this.host.clientWidth),
      height: Math.max(1, this.host.clientHeight),
      // We drive frames ourselves (see startClock): Pixi's ticker caps its
      // delta at 100 ms, which would override our own 250 ms clamp.
      autoStart: false,
    })

    // destroy() may have run while init was pending (React Strict Mode does
    // exactly this). Pixi cannot be destroyed mid-init, so we clean up here.
    if (this.wasDisposed()) {
      app.destroy({ removeView: true }, { children: true })
      return
    }
    this.app = app
    this.host.appendChild(app.canvas)

    const textures = await loadGameAssets()
    // If destroyed during loading, destroy() already tore down the app.
    if (this.wasDisposed()) return

    // Each match runs on a frozen copy of the config taken at its start.
    const world = createWorld(
      snapshotConfig(),
      this.params.seed ?? randomSeed(),
    )
    if (this.params.testMode && this.params.spawnOff) {
      world.spawn.enabled = false
    }
    if (this.params.testMode && this.params.fixture) {
      applyFixture(world, this.params.fixture)
    }
    const renderer = new GameRenderer(textures, world, {
      debug: this.params.debug,
    })
    app.stage.addChild(renderer.root)

    const input = createInputState()
    const render = (): void => {
      renderer.sync(world)
      app.render()
    }
    const loop = new FixedStepLoop((dt) => {
      step(world, input, dt)
      this.keyboard?.afterStep()
    }, render)
    this.match = { world, input, loop }

    const fit = (): void => {
      const width = Math.max(1, this.host.clientWidth)
      const height = Math.max(1, this.host.clientHeight)
      app.renderer.resize(width, height)
      renderer.layout(width, height)
      // Resizing clears the canvas; redraw even if the loop is not running.
      render()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(this.host)
    this.abort.signal.addEventListener('abort', () => {
      observer.disconnect()
    })
    fit()

    if (this.params.testMode) {
      this.uninstallTestHooks = installTestHooks({
        getState: () => ({
          paused: this.paused,
          world: structuredClone(world),
        }),
        pauseClock: () => {
          this.clockPaused = true
          this.stopClock()
        },
        resumeClock: () => {
          this.clockPaused = false
          this.startClock()
        },
        advance: (ms) => {
          if (!Number.isFinite(ms) || ms < 0) {
            throw new RangeError(
              `advance(ms) needs a finite ms >= 0, got ${String(ms)}`,
            )
          }
          // A paused match must not move, whoever asks.
          if (this.paused) render()
          else loop.advance(ms)
        },
      })
    }

    this.beginGameplay(this.match)
    // Deterministic "rendered" signal for e2e tests and debugging.
    this.host.dataset.status = 'ready'
  }

  private beginGameplay(match: Match): void {
    const gameplay = new AbortController()
    this.gameplay = gameplay
    this.keyboard = attachKeyboard(
      match.input,
      {
        onPause: () => {
          this.pause()
        },
      },
      AbortSignal.any([this.abort.signal, gameplay.signal]),
    )
    this.startClock()
  }

  /** Temporary minimal pause: P/Escape again resumes (PauseDialog later). */
  pause(): void {
    const { match } = this
    if (!match || this.paused || this.disposed) return
    this.paused = true
    this.stopClock()
    this.gameplay?.abort()
    this.gameplay = null
    this.keyboard = null
    clearInput(match.input)

    const pauseScope = new AbortController()
    this.pauseScope = pauseScope
    attachResumeKeys(
      () => {
        this.resume()
      },
      AbortSignal.any([this.abort.signal, pauseScope.signal]),
    )
  }

  resume(): void {
    const { match } = this
    if (!match || !this.paused || this.disposed) return
    this.paused = false
    this.pauseScope?.abort()
    this.pauseScope = null
    // Start from a fresh clock: the paused time must not be simulated.
    match.loop.resetClock()
    this.beginGameplay(match)
  }

  private startClock(): void {
    const { match } = this
    if (!match || this.paused || this.clockPaused || this.frameId !== null) {
      return
    }
    const onFrame = (now: number): void => {
      match.loop.frame(now)
      this.frameId = requestAnimationFrame(onFrame)
    }
    this.frameId = requestAnimationFrame(onFrame)
  }

  private stopClock(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.match?.loop.resetClock()
  }

  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopClock()
    this.abort.abort()
    this.uninstallTestHooks?.()
    this.uninstallTestHooks = null
    this.match = null
    // Destroy display objects only; textures stay cached in Assets for reuse.
    this.app?.destroy({ removeView: true }, { children: true })
    this.app = null
  }
}
