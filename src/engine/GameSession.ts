import { Application, Container, Sprite, TilingSprite } from 'pixi.js'
import { loadGameAssets } from '../render/assets'
import { MAX_RESOLUTION, WORLD_HEIGHT, WORLD_WIDTH } from '../render/constants'

/**
 * Owns one Pixi Application and everything attached to it.
 * A session is single-use: once destroyed it cannot be started again.
 */
export class GameSession {
  private readonly abort = new AbortController()
  private readonly host: HTMLElement
  private app: Application | null = null
  private disposed = false

  constructor(host: HTMLElement) {
    this.host = host
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

    const world = new Container()
    const water = new TilingSprite({
      texture: textures.water,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    })
    const ship = new Sprite({
      texture: textures.shipPlayer,
      anchor: 0.5,
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
    })
    world.addChild(water, ship)
    app.stage.addChild(world)
    // Deterministic "rendered" signal for e2e tests and debugging.
    this.host.dataset.status = 'ready'

    const fit = (): void => {
      const width = Math.max(1, this.host.clientWidth)
      const height = Math.max(1, this.host.clientHeight)
      app.renderer.resize(width, height)
      const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT)
      world.scale.set(scale)
      world.position.set(
        (width - WORLD_WIDTH * scale) / 2,
        (height - WORLD_HEIGHT * scale) / 2,
      )
    }
    const observer = new ResizeObserver(fit)
    observer.observe(this.host)
    this.abort.signal.addEventListener('abort', () => {
      observer.disconnect()
    })
    fit()
  }

  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    this.abort.abort()
    // Destroy display objects only; textures stay cached in Assets for reuse.
    this.app?.destroy({ removeView: true }, { children: true })
    this.app = null
  }
}
