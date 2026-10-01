import { degToRad, wrapAngle } from '../math'
import type { InputIntents, World } from '../types'

/** Turns and moves the player; collisions are resolved afterwards. */
export function updatePlayerMovement(
  world: World,
  input: Readonly<InputIntents>,
  dt: number,
): void {
  const { player } = world
  const { speed, turnSpeedDegPerSec } = world.config.player

  const turn = Number(input.turnRight) - Number(input.turnLeft)
  player.heading = wrapAngle(
    player.heading + turn * degToRad(turnSpeedDegPerSec) * dt,
  )

  if (input.forward) {
    player.x += Math.cos(player.heading) * speed * dt
    player.y += Math.sin(player.heading) * speed * dt
  }
}
