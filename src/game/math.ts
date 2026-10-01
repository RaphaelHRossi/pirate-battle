export interface Vec2 {
  x: number
  y: number
}

const TAU = Math.PI * 2

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Normalises an angle in radians to [-π, π). */
export function wrapAngle(angle: number): number {
  const shifted = (angle + Math.PI) % TAU
  return (shifted < 0 ? shifted + TAU : shifted) - Math.PI
}

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}
