import { Container, Sprite, type Texture } from 'pixi.js'
import type { EnemyKind, World } from '../../game/types'

export type EnemyTextures = Readonly<Record<EnemyKind, Texture>>

/**
 * One sprite per enemy slot, created once. A slot is reused by Chasers and
 * Shooters alike, so its texture follows the kind of the enemy in it.
 */
export class EnemiesView {
  readonly container = new Container({ label: 'enemies' })
  private readonly sprites: Sprite[]
  private readonly textures: EnemyTextures
  private readonly rotationOffset: number

  constructor(
    textures: EnemyTextures,
    world: Readonly<World>,
    rotationOffset: number,
  ) {
    this.textures = textures
    this.rotationOffset = rotationOffset
    this.sprites = world.enemies.map(
      () => new Sprite({ anchor: 0.5, visible: false }),
    )
    this.container.addChild(...this.sprites)
  }

  sync(world: Readonly<World>): void {
    world.enemies.forEach((enemy, index) => {
      const sprite = this.sprites[index]
      if (!sprite) return
      sprite.visible = enemy.alive
      if (!enemy.alive) return
      sprite.texture = this.textures[enemy.kind]
      sprite.position.set(enemy.x, enemy.y)
      sprite.rotation = enemy.heading + this.rotationOffset
    })
  }
}
