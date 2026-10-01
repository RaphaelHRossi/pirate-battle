import type { Aabb } from './map'
import { clamp, type Vec2 } from './math'
import type { Ship } from './types'

export interface Circle {
  x: number
  y: number
  r: number
}

/** +1 = bow circle, −1 = stern circle. */
export type HullSide = 1 | -1

export const HULL_SIDES: readonly HullSide[] = [1, -1]

/** One of the two circles the hull is modelled with. */
export function hullCircle(ship: Readonly<Ship>, side: HullSide): Circle {
  return {
    x: ship.x + Math.cos(ship.heading) * ship.hullOffset * side,
    y: ship.y + Math.sin(ship.heading) * ship.hullOffset * side,
    r: ship.hullRadius,
  }
}

/** Bow and stern circles. */
export function hullCircles(ship: Readonly<Ship>): [Circle, Circle] {
  return [hullCircle(ship, 1), hullCircle(ship, -1)]
}

/**
 * Smallest translation that moves `circle` out of `box`, or null if they do
 * not overlap.
 */
export function circleAabbPush(
  circle: Circle,
  box: Readonly<Aabb>,
): Vec2 | null {
  const closestX = clamp(circle.x, box.minX, box.maxX)
  const closestY = clamp(circle.y, box.minY, box.maxY)
  const dx = circle.x - closestX
  const dy = circle.y - closestY
  const distSq = dx * dx + dy * dy

  if (distSq > 0) {
    // Centre outside the box: push away from the closest point on its edge.
    // Near a corner this direction is diagonal, which rounds the corner off.
    if (distSq >= circle.r * circle.r) return null
    const dist = Math.sqrt(distSq)
    const depth = circle.r - dist
    return { x: (dx / dist) * depth, y: (dy / dist) * depth }
  }

  // Centre inside the box (deep overlap): leave through the nearest face.
  const left = circle.x - box.minX
  const right = box.maxX - circle.x
  const top = circle.y - box.minY
  const bottom = box.maxY - circle.y
  const nearest = Math.min(left, right, top, bottom)
  if (nearest === left) return { x: -(left + circle.r), y: 0 }
  if (nearest === right) return { x: right + circle.r, y: 0 }
  if (nearest === top) return { x: 0, y: -(top + circle.r) }
  return { x: 0, y: bottom + circle.r }
}

/** Translation that brings `circle` fully inside the arena, or null. */
export function circleArenaPush(
  circle: Circle,
  arena: Readonly<{ width: number; height: number }>,
): Vec2 | null {
  const x =
    circle.x < circle.r
      ? circle.r - circle.x
      : Math.min(0, arena.width - circle.r - circle.x)
  const y =
    circle.y < circle.r
      ? circle.r - circle.y
      : Math.min(0, arena.height - circle.r - circle.y)
  return x === 0 && y === 0 ? null : { x, y }
}
