import { Container, Sprite, type Texture } from 'pixi.js'
import type { World } from '../../game/types'

/** Size of the flash at the moment of firing, relative to the frame. */
const FLASH_START_SCALE = 0.9
const FLASH_END_SCALE = 0.4

/** Muzzle flashes, one sprite per pool slot (same pattern as projectiles). */
export class EffectsView {
  readonly container = new Container({ label: 'effects' })
  private readonly flashes: Sprite[]

  constructor(muzzleFlash: Texture, world: Readonly<World>) {
    this.flashes = world.muzzleFlashes.map(
      () => new Sprite({ texture: muzzleFlash, anchor: 0.5, visible: false }),
    )
    this.container.addChild(...this.flashes)
  }

  sync(world: Readonly<World>): void {
    const lifetime = world.config.effects.muzzleFlashSeconds
    world.muzzleFlashes.forEach((flash, index) => {
      const sprite = this.flashes[index]
      if (!sprite) return
      sprite.visible = flash.alive
      if (!flash.alive) return
      // 1 when fired, 0 when it expires: shrink and fade out.
      const life = Math.max(0, flash.ttl / lifetime)
      sprite.position.set(flash.x, flash.y)
      sprite.rotation = flash.heading
      sprite.scale.set(
        FLASH_END_SCALE + (FLASH_START_SCALE - FLASH_END_SCALE) * life,
      )
      sprite.alpha = life
    })
  }
}
