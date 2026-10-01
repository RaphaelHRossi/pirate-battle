import { Container, Sprite, type Texture } from 'pixi.js'
import type { EffectKind, World } from '../../game/types'

interface EffectStyle {
  /** Scale when the effect starts and when it expires. */
  startScale: number
  endScale: number
  /** Follow the shot direction (flashes) or keep upright (explosions). */
  rotate: boolean
}

const STYLES: Readonly<Record<EffectKind, EffectStyle>> = {
  muzzleFlash: { startScale: 0.9, endScale: 0.4, rotate: true },
  explosion: { startScale: 0.6, endScale: 1.4, rotate: false },
}

export type EffectTextures = Readonly<Record<EffectKind, Texture>>

/**
 * Muzzle flashes and explosions, one sprite per effect pool slot (same
 * pattern as projectiles). A slot's texture follows its effect kind.
 */
export class EffectsView {
  readonly container = new Container({ label: 'effects' })
  private readonly sprites: Sprite[]
  private readonly textures: EffectTextures

  constructor(textures: EffectTextures, world: Readonly<World>) {
    this.textures = textures
    this.sprites = world.effects.map(
      () => new Sprite({ anchor: 0.5, visible: false }),
    )
    this.container.addChild(...this.sprites)
  }

  sync(world: Readonly<World>): void {
    const { muzzleFlashSeconds, explosionSeconds } = world.config.effects
    world.effects.forEach((effect, index) => {
      const sprite = this.sprites[index]
      if (!sprite) return
      sprite.visible = effect.alive
      if (!effect.alive) return
      const style = STYLES[effect.kind]
      const lifetime =
        effect.kind === 'explosion' ? explosionSeconds : muzzleFlashSeconds
      // 1 when it starts, 0 when it expires.
      const life = Math.max(0, effect.ttl / lifetime)
      sprite.texture = this.textures[effect.kind]
      sprite.position.set(effect.x, effect.y)
      sprite.rotation = style.rotate ? effect.heading : 0
      sprite.scale.set(
        style.endScale + (style.startScale - style.endScale) * life,
      )
      sprite.alpha = life
    })
  }
}
