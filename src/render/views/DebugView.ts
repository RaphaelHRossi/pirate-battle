import { Graphics } from 'pixi.js'
import { hullCircles } from '../../game/collision'
import type { World } from '../../game/types'

const COLLIDER_COLOR = 0xff3b30
const HULL_COLOR = 0xffd60a
const PROJECTILE_COLOR = 0xff00ff
const LINE_WIDTH = 2

/** `?debug=1`: draws island colliders and ship hull circles over the game. */
export class DebugView {
  readonly graphics = new Graphics({ label: 'debug' })

  sync(world: Readonly<World>): void {
    const g = this.graphics
    g.clear()
    for (const box of world.map.colliders) {
      g.rect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY)
    }
    g.stroke({ width: LINE_WIDTH, color: COLLIDER_COLOR })
    const ships = [world.player, ...world.enemies.filter((e) => e.alive)]
    for (const ship of ships) {
      for (const circle of hullCircles(ship)) {
        g.circle(circle.x, circle.y, circle.r)
      }
    }
    g.stroke({ width: LINE_WIDTH, color: HULL_COLOR })
    const { radius } = world.config.projectiles
    for (const projectile of world.projectiles) {
      if (projectile.alive) g.circle(projectile.x, projectile.y, radius)
    }
    g.stroke({ width: LINE_WIDTH, color: PROJECTILE_COLOR })
  }
}
