import { hullCircles } from '../collision'
import type { Ship, World } from '../types'

/**
 * Pushes overlapping ships apart, half the overlap each, along the line
 * between the touching hull circles. Runs before island/arena resolution,
 * which has the last word, so separation can never push a ship ashore.
 */
export function separateShips(world: World): void {
  const ships: Ship[] = [
    world.player,
    ...world.enemies.filter((enemy) => enemy.alive),
  ]
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i]
      const b = ships[j]
      if (!a || !b) continue
      for (const ca of hullCircles(a)) {
        for (const cb of hullCircles(b)) {
          const dx = cb.x - ca.x
          const dy = cb.y - ca.y
          const distance = Math.hypot(dx, dy)
          const overlap = ca.r + cb.r - distance
          if (overlap <= 0) continue
          // Coincident centres have no direction: separate along x.
          const nx = distance > 0 ? dx / distance : 1
          const ny = distance > 0 ? dy / distance : 0
          const half = overlap / 2
          a.x -= nx * half
          a.y -= ny * half
          b.x += nx * half
          b.y += ny * half
        }
      }
    }
  }
}
