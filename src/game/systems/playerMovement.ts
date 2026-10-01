import { clamp, degToRad, wrapAngle } from '../math'
import type { InputIntents, World } from '../types'

export function updatePlayerMovement(
  world: World,
  input: Readonly<InputIntents>,
  dt: number,
): void {
  const { player } = world
  const { speed, turnSpeedDegPerSec } = world.config.player
  const { width, height } = world.config.arena

  const turn = Number(input.turnRight) - Number(input.turnLeft)
  player.heading = wrapAngle(
    player.heading + turn * degToRad(turnSpeedDegPerSec) * dt,
  )

  if (input.forward) {
    player.x += Math.cos(player.heading) * speed * dt
    player.y += Math.sin(player.heading) * speed * dt
  }

  // Keep the whole hull inside the visible arena.
  player.x = clamp(player.x, player.radius, width - player.radius)
  player.y = clamp(player.y, player.radius, height - player.radius)
}
