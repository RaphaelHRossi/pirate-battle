import { Graphics } from 'pixi.js'
import { hullCircles } from '../../game/collision'
import type { World } from '../../game/types'

const COLLIDER_COLOR = 0xff3b30
const HULL_COLOR = 0xffd60a
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
    for (const circle of hullCircles(world.player)) {
      g.circle(circle.x, circle.y, circle.r)
    }
    g.stroke({ width: LINE_WIDTH, color: HULL_COLOR })
  }
}
