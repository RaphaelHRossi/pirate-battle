import { Application } from 'pixi.js'
import { snapshotConfig } from '../game/config'
import { applyFixture } from '../game/fixtures'
import { TIME_EPSILON } from '../game/math'
import { step } from '../game/step'
import type { World } from '../game/types'
import { createWorld } from '../game/world'
import { clearInput, createInputState } from '../input/InputState'
import { attachKeyboard, type KeyboardControls } from '../input/keyboard'
import { loadGameAssets, type GameTextures } from '../render/assets'
import { MAX_RESOLUTION } from '../render/constants'
import { GameRenderer } from '../render/GameRenderer'
import { FixedStepLoop } from './loop'
import {
  INITIAL_SNAPSHOT,
  sameSnapshot,
  type GameSnapshot,
  type SessionStatus,
} from './snapshot'
import { installTestHooks, readTestParams, type TestParams } from './testHooks'

/** Everything that belongs to one match and is thrown away on restart. */
interface Match {
  world: World
  renderer: GameRenderer
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/**
 * Owns one Pixi Application, the match running in it, the frame loop and
 * every listener, and is the bridge to React: `subscribe` + `getSnapshot`
 * for useSyncExternalStore. A session is single-use: once destroyed it
 * cannot be started again; a new match within it is started with
 * `restart()`.
 */
export class GameSession {
  /** Aborting this removes every listener the session ever attached. */
  private readonly abort = new AbortController()
  private readonly host: HTMLElement
  private readonly params: TestParams
  private readonly input = createInputState()
  private readonly loop: FixedStepLoop
  private readonly listeners = new Set<() => void>()
  private snapshot: GameSnapshot = INITIAL_SNAPSHOT
  private app: Application | null = null
  private textures: GameTextures | null = null
  private match: Match | null = null
  private screen = { width: 1, height: 1 }
  private disposed = false
  private paused = false
  private loadPercent = 0
  private failure: { canRetry: boolean } | null = null
  /** Set by the test hook `pauseClock()`; independent of player pause. */
  private clockPaused = false
  private frameId: number | null = null
  /** Lives while gameplay listeners are attached; aborted on pause. */
  private gameplay: AbortController | null = null
  private keyboard: KeyboardControls | null = null
  private uninstallTestHooks: (() => void) | null = null

  constructor(host: HTMLElement, search: string = window.location.search) {
    this.host = host
    this.params = readTestParams(search)
    this.clockPaused = this.params.testMode && this.params.manualClock
    this.loop = new FixedStepLoop(
      (dt) => {
        if (!this.match) return
        step(this.match.world, this.input, dt)
        this.keyboard?.afterStep()
        this.publish()
      },
      () => {
        this.render()
      },
    )
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  // A method call (not a property read) so TypeScript does not narrow the flag
  // across `await`; destroy() can flip it while start() is suspended.
  private wasDisposed(): boolean {
    return this.disposed
  }

  // --- React bridge -------------------------------------------------------

  /** useSyncExternalStore: `listener` runs whenever the snapshot changes. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * useSyncExternalStore: must return the same object until something
   * changes, otherwise React would re-render (or loop) on every call.
   */
  readonly getSnapshot = (): GameSnapshot => this.snapshot

  /**
   * Recomputes the snapshot and, only if a value differs, replaces it and
   * notifies React. Called after every simulation step, but a step that
   * changes no hp, score, whole second or status costs one comparison and
   * allocates nothing.
   */
  private publish(): void {
    const world = this.match?.world
    const next: GameSnapshot = {
      status: this.currentStatus(),
      loadPercent: this.loadPercent,
      canRetry: this.failure?.canRetry ?? true,
      hp: world?.player.hp ?? 0,
      maxHp: world?.player.maxHp ?? 0,
      score: world?.match.score ?? 0,
      secondsLeft: world
        ? Math.ceil(world.match.secondsLeft - TIME_EPSILON)
        : 0,
      endReason: world?.match.endReason ?? null,
    }
    if (sameSnapshot(next, this.snapshot)) return
    this.snapshot = Object.freeze(next)
    for (const listener of this.listeners) listener()
  }

  private currentStatus(): SessionStatus {
    if (this.failure) return 'error'
    if (!this.match) return 'loading'
    if (this.match.world.match.status === 'ended') return 'ended'
    return this.paused ? 'paused' : 'running'
  }

  // --- Lifecycle ----------------------------------------------------------

  async start(): Promise<void> {
    const app = new Application()
    try {
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
    } catch (error) {
      // No WebGL/WebGPU: nothing to retry, but the UI can say so.
      if (this.wasDisposed()) return
      console.warn('Could not create the renderer', error)
      this.fail({ canRetry: false })
      return
    }

    // destroy() may have run while init was pending (React Strict Mode does
    // exactly this). Pixi cannot be destroyed mid-init, so we clean up here.
    if (this.wasDisposed()) {
      app.destroy({ removeView: true }, { children: true })
      return
    }
    this.app = app
    this.host.appendChild(app.canvas)
    await this.loadAndBegin(app)
  }

  /** After a failed load: tries again, requesting only what failed. */
  async retry(): Promise<void> {
    const { app } = this
    if (!app || !this.failure?.canRetry || this.disposed) return
    this.failure = null
    delete this.host.dataset.status
    this.publish()
    await this.loadAndBegin(app)
  }

  private async loadAndBegin(app: Application): Promise<void> {
    let textures: GameTextures
    try {
      textures = await loadGameAssets((progress) => {
        if (this.disposed) return
        this.loadPercent = Math.floor(progress * 100)
        this.publish()
      })
    } catch (error) {
      if (this.wasDisposed()) return
      // Handled: the loading screen shows the error and a Retry button.
      console.warn('Game assets failed to load', error)
      this.fail({ canRetry: true })
      return
    }
    // If destroyed during loading, destroy() already tore down the app.
    if (this.wasDisposed()) return
    this.textures = textures
    this.loadPercent = 100
    this.match = this.createMatch(app, textures, { initial: true })

    const fit = (): void => {
      const width = Math.max(1, this.host.clientWidth)
      const height = Math.max(1, this.host.clientHeight)
      this.screen = { width, height }
      app.renderer.resize(width, height)
      this.match?.renderer.layout(width, height)
      // Resizing clears the canvas; redraw even if the loop is not running.
      this.render()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(this.host)
    this.abort.signal.addEventListener('abort', () => {
      observer.disconnect()
    })
    fit()

    if (this.params.testMode) this.installTestHooks()

    this.beginGameplay()
    // Deterministic "rendered" signal for e2e tests and debugging.
    this.host.dataset.status = 'ready'
    this.publish()
  }

  private fail(failure: { canRetry: boolean }): void {
    this.failure = failure
    this.host.dataset.status = 'error'
    this.publish()
  }

  /**
   * A fresh world (full hp, score 0, full timer, no entities) drawn by a
   * fresh renderer. Each match runs on a frozen copy of the config taken
   * at its start. Fixtures only shape the first match of a test page.
   */
  private createMatch(
    app: Application,
    textures: GameTextures,
    { initial }: { initial: boolean },
  ): Match {
    const world = createWorld(
      snapshotConfig(),
      this.params.seed ?? randomSeed(),
    )
    if (this.params.testMode) {
      if (this.params.spawnOff) world.spawn.enabled = false
      if (initial && this.params.fixture) {
        applyFixture(world, this.params.fixture)
      }
    }
    const renderer = new GameRenderer(textures, world, {
      debug: this.params.debug,
    })
    renderer.layout(this.screen.width, this.screen.height)
    app.stage.addChild(renderer.root)
    return { world, renderer }
  }

  /**
   * Replaces the match with a new one. Only display objects are destroyed;
   * the loaded textures are reused, so restarting never reloads assets.
   */
  restart(): void {
    const { app, textures } = this
    if (!app || !textures || this.disposed) return
    this.match?.renderer.destroy()
    this.match = this.createMatch(app, textures, { initial: false })
    clearInput(this.input)
    this.loop.resetClock()
    if (this.paused) this.resume()
    else this.render()
    this.publish()
  }

  private render(): void {
    if (!this.app || !this.match) return
    this.match.renderer.sync(this.match.world)
    this.app.render()
  }

  private installTestHooks(): void {
    this.uninstallTestHooks = installTestHooks({
      getState: () => {
        if (!this.match) throw new Error('No match is running')
        return { paused: this.paused, world: structuredClone(this.match.world) }
      },
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
        if (this.paused) this.render()
        else this.loop.advance(ms)
      },
      restart: () => {
        this.restart()
      },
    })
  }

  // --- Gameplay and pause -------------------------------------------------

  /**
   * Attaches everything that only exists while the match is being played:
   * game keys, and the auto-pause on losing focus or hiding the tab.
   */
  private beginGameplay(): void {
    const gameplay = new AbortController()
    this.gameplay = gameplay
    const signal = AbortSignal.any([this.abort.signal, gameplay.signal])
    this.keyboard = attachKeyboard(
      this.input,
      {
        onPause: () => {
          this.pause()
        },
      },
      signal,
    )
    window.addEventListener(
      'blur',
      () => {
        this.pause()
      },
      { signal },
    )
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') this.pause()
      },
      { signal },
    )
    this.startClock()
  }

  /**
   * Stops the simulation and detaches the game keys. Resuming always needs
   * an explicit action (the pause dialog), never just regaining focus.
   */
  pause(): void {
    if (!this.match || this.paused || this.disposed) return
    if (this.match.world.match.status === 'ended') return
    this.paused = true
    this.stopClock()
    this.gameplay?.abort()
    this.gameplay = null
    this.keyboard = null
    clearInput(this.input)
    this.publish()
  }

  resume(): void {
    if (!this.match || !this.paused || this.disposed) return
    this.paused = false
    // Start from a fresh clock and no held keys: the paused time must not
    // be simulated, and nothing pressed before the pause carries over.
    clearInput(this.input)
    this.loop.resetClock()
    this.beginGameplay()
    this.publish()
  }

  private startClock(): void {
    if (
      !this.match ||
      this.paused ||
      this.clockPaused ||
      this.frameId !== null
    ) {
      return
    }
    const onFrame = (now: number): void => {
      this.loop.frame(now)
      this.frameId = requestAnimationFrame(onFrame)
    }
    this.frameId = requestAnimationFrame(onFrame)
  }

  private stopClock(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.loop.resetClock()
  }

  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopClock()
    this.abort.abort()
    this.listeners.clear()
    this.uninstallTestHooks?.()
    this.uninstallTestHooks = null
    this.match = null
    this.textures = null
    // Destroy display objects only; textures stay cached in Assets for reuse.
    this.app?.destroy({ removeView: true }, { children: true })
    this.app = null
  }
}
