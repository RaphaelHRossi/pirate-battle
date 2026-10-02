import { Container, TilingSprite } from 'pixi.js'
import type { World } from '../game/types'
import type { GameTextures } from './assets'
import type { RendererState } from './inspection'
import { DebugView } from './views/DebugView'
import { EffectsView } from './views/EffectsView'
import { EnemiesView } from './views/EnemiesView'
import { createIslandsView } from './views/IslandsView'
import { ProjectilesView } from './views/ProjectilesView'
import { ShipView, type ShipViewTextures } from './views/ShipView'

export interface RendererOptions {
  /** Draw colliders and hull circles (`?debug=1`). */
  debug: boolean
}

/** Reads the world and mirrors it into display objects. Never mutates it. */
export class GameRenderer {
  readonly root = new Container()
  private readonly arenaWidth: number
  private readonly arenaHeight: number
  private readonly player: ShipView
  private readonly enemies: EnemiesView
  private readonly projectiles: ProjectilesView
  private readonly effects: EffectsView
  private readonly debug: DebugView | null

  constructor(
    textures: GameTextures,
    world: Readonly<World>,
    options: RendererOptions,
  ) {
    const { width, height } = world.config.arena
    this.arenaWidth = width
    this.arenaHeight = height

    const shipTextures = (
      stages: ShipViewTextures['stages'],
      barFill: ShipViewTextures['barFill'],
    ): ShipViewTextures => ({
      stages,
      fire: textures.fire,
      barFrame: textures.healthFrame,
      barFill,
    })

    const water = new TilingSprite({ texture: textures.water, width, height })
    // Static: built once from the map, never updated per frame.
    const islands = createIslandsView(world.map, textures.tile)
    // Green bar for the player, red for enemies.
    this.player = new ShipView(
      shipTextures(textures.ships.player, textures.healthFillPlayer),
    )
    this.enemies = new EnemiesView(
      {
        chaser: shipTextures(textures.ships.chaser, textures.healthFillEnemy),
        shooter: shipTextures(textures.ships.shooter, textures.healthFillEnemy),
      },
      world,
    )
    this.projectiles = new ProjectilesView(textures.cannonBall, world)
    this.effects = new EffectsView(
      {
        muzzleFlash: textures.muzzleFlash,
        explosion: textures.explosion,
        ships: textures.ships,
      },
      world,
    )
    this.root.addChild(
      water,
      islands,
      this.effects.under,
      this.enemies.container,
      this.player.container,
      this.projectiles.container,
      this.effects.over,
    )

    this.debug = options.debug ? new DebugView() : null
    if (this.debug) this.root.addChild(this.debug.graphics)
    this.sync(world)
  }

  /** Letterboxes the fixed-size arena into a screen of the given size. */
  layout(screenWidth: number, screenHeight: number): void {
    const scale = Math.min(
      screenWidth / this.arenaWidth,
      screenHeight / this.arenaHeight,
    )
    this.root.scale.set(scale)
    this.root.position.set(
      (screenWidth - this.arenaWidth * scale) / 2,
      (screenHeight - this.arenaHeight * scale) / 2,
    )
  }

  /** Reads back the display objects; never called by the frame loop. */
  inspect(world: Readonly<World>): RendererState {
    const scale = this.root.scale.x
    return {
      layout: {
        scale,
        x: this.root.position.x,
        y: this.root.position.y,
        width: this.arenaWidth * scale,
        height: this.arenaHeight * scale,
      },
      ships: [
        { id: world.player.id, kind: 'player', ...this.player.inspect() },
        ...this.enemies.inspect(world),
      ],
    }
  }

  sync(world: Readonly<World>): void {
    this.player.sync(world.player, world)
    this.enemies.sync(world)
    this.projectiles.sync(world)
    this.effects.sync(world)
    this.debug?.sync(world)
  }

  /**
   * Destroys this renderer's display objects and the health-bar clip
   * textures it made. Loaded textures are shared and stay cached in
   * Assets, so a new match reuses them without reloading.
   */
  destroy(): void {
    this.player.destroy()
    this.enemies.destroy()
    this.root.destroy({ children: true })
  }
}
