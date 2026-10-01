import { Container, Sprite, type Texture } from 'pixi.js'
import type { World } from '../../game/types'

/**
 * One sprite per projectile pool slot, created once. Syncing only toggles
 * visibility and moves sprites, so firing never allocates display objects.
 */
export class ProjectilesView {
  readonly container = new Container({ label: 'projectiles' })
  private readonly sprites: Sprite[]

  constructor(texture: Texture, world: Readonly<World>) {
    this.sprites = world.projectiles.map(
      () => new Sprite({ texture, anchor: 0.5, visible: false }),
    )
    this.container.addChild(...this.sprites)
  }

  sync(world: Readonly<World>): void {
    world.projectiles.forEach((projectile, index) => {
      const sprite = this.sprites[index]
      if (!sprite) return
      sprite.visible = projectile.alive
      if (projectile.alive) sprite.position.set(projectile.x, projectile.y)
    })
  }
}
