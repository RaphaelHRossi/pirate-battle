import { Container } from 'pixi.js'
import type { EnemyKind, World } from '../../game/types'
import { ShipView, type ShipViewTextures } from './ShipView'

export type EnemyTextures = Readonly<Record<EnemyKind, ShipViewTextures>>

/**
 * One ShipView per enemy slot, created once. A slot is reused by Chasers
 * and Shooters alike, so its art follows the kind of the enemy in it.
 */
export class EnemiesView {
  readonly container = new Container({ label: 'enemies' })
  private readonly views: ShipView[]
  private readonly textures: EnemyTextures

  constructor(textures: EnemyTextures, world: Readonly<World>) {
    this.textures = textures
    this.views = world.enemies.map(() => {
      const view = new ShipView(textures.chaser)
      view.container.visible = false
      return view
    })
    this.container.addChild(...this.views.map((view) => view.container))
  }

  sync(world: Readonly<World>): void {
    world.enemies.forEach((enemy, index) => {
      const view = this.views[index]
      if (!view) return
      view.container.visible = enemy.alive
      if (!enemy.alive) return
      view.setTextures(this.textures[enemy.kind])
      view.sync(enemy, world)
    })
  }

  destroy(): void {
    for (const view of this.views) view.destroy()
  }
}
