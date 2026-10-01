import type { InputIntents } from '../game/types'

export function createInputState(): InputIntents {
  return {
    forward: false,
    turnLeft: false,
    turnRight: false,
    fireFront: false,
    fireLeft: false,
    fireRight: false,
  }
}

export function clearInput(input: InputIntents): void {
  input.forward = false
  input.turnLeft = false
  input.turnRight = false
  input.fireFront = false
  input.fireLeft = false
  input.fireRight = false
}
