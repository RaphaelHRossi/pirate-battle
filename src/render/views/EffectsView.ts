import { Container, Sprite, type Texture } from 'pixi.js'
import { effectLifetime } from '../../game/entities'
import type { Effect, ShipSkin, World } from '../../game/types'
import type { ShipStages } from '../assets'
import { SHIP_SPRITE_ROTATION_OFFSET } from './ShipView'

const FLASH_START_SCALE = 0.9
const FLASH_END_SCALE = 0.4
const EXPLOSION_START_SCALE = 0.8
const EXPLOSION_END_SCALE = 1.3
/** A wreck stays fully visible for this share of its life, then fades. */
const WRECK_SOLID_SHARE = 0.5

export interface EffectTextures {
  muzzleFlash: Texture
  /** Played in order over the explosion's lifetime. */
  explosion: readonly [Texture, Texture, Texture]
  ships: Readonly<Record<ShipSkin, ShipStages>>
}

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * t

/**
 * Muzzle flashes, explosions and wrecks, one sprite per effect pool slot
 * (same pattern as projectiles). Everything is driven by the effect's ttl
 * in game time, so it freezes on pause and replays identically.
 * Wrecks are drawn under the ships, flashes and explosions over them.
 */
export class EffectsView {
  /** Wrecks: goes below the ships. */
  readonly under = new Container({ label: 'wrecks' })
  /** Flashes and explosions: goes above the ships. */
  readonly over = new Container({ label: 'effects' })
  private readonly sprites: Sprite[]
  private readonly textures: EffectTextures

  constructor(textures: EffectTextures, world: Readonly<World>) {
    this.textures = textures
    this.sprites = world.effects.map(
      () => new Sprite({ anchor: 0.5, visible: false }),
    )
    this.over.addChild(...this.sprites)
  }

  sync(world: Readonly<World>): void {
    world.effects.forEach((effect, index) => {
      const sprite = this.sprites[index]
      if (!sprite) return
      sprite.visible = effect.alive
      if (!effect.alive) return
      // 1 when it starts, 0 when it expires.
      const life = Math.max(0, effect.ttl / effectLifetime(world, effect.kind))
      const layer = effect.kind === 'wreck' ? this.under : this.over
      if (sprite.parent !== layer) layer.addChild(sprite)
      sprite.position.set(effect.x, effect.y)
      this.style(sprite, effect, life)
    })
  }

  private style(sprite: Sprite, effect: Readonly<Effect>, life: number): void {
    const progress = 1 - life
    if (effect.kind === 'muzzleFlash') {
      sprite.texture = this.textures.muzzleFlash
      sprite.rotation = effect.heading
      sprite.scale.set(lerp(FLASH_START_SCALE, FLASH_END_SCALE, progress))
      sprite.alpha = life
    } else if (effect.kind === 'explosion') {
      // explosion_3 → explosion_2 → explosion_1, a third of the time each.
      const frames = this.textures.explosion
      const frame = Math.min(
        frames.length - 1,
        Math.floor(progress * frames.length),
      )
      sprite.texture = frames[frame] ?? frames[0]
      sprite.rotation = 0
      sprite.scale.set(
        lerp(EXPLOSION_START_SCALE, EXPLOSION_END_SCALE, progress),
      )
      sprite.alpha = Math.min(1, life * 3)
    } else {
      const skin = effect.skin ?? 'chaser'
      sprite.texture = this.textures.ships[skin][3]
      sprite.rotation = effect.heading + SHIP_SPRITE_ROTATION_OFFSET
      sprite.scale.set(1)
      sprite.alpha = Math.min(1, life / (1 - WRECK_SOLID_SHARE))
    }
  }
}
