import type { GameSnapshot } from '../engine/snapshot'

const ANNOUNCED_SECONDS = [30, 10] as const
const LOW_HEALTH_RATIO = 1 / 3

/** The event between two snapshots worth announcing, if any. */
export function describeEvent(
  previous: GameSnapshot,
  next: GameSnapshot,
): string | null {
  if (previous.status !== 'ended' && next.status === 'ended') {
    const reason =
      next.endReason === 'playerDestroyed' ? 'your ship was sunk' : 'time is up'
    return `Match over: ${reason}. Score ${String(next.score)}.`
  }
  if (previous.status === 'running' && next.status === 'paused') {
    return 'Game paused.'
  }
  if (previous.status === 'paused' && next.status === 'running') {
    return 'Game resumed.'
  }
  if (next.status !== 'running') return null
  for (const mark of ANNOUNCED_SECONDS) {
    if (previous.secondsLeft > mark && next.secondsLeft <= mark) {
      return `${String(mark)} seconds left.`
    }
  }
  const wasLow = previous.hp < previous.maxHp * LOW_HEALTH_RATIO
  const isLow = next.hp > 0 && next.hp < next.maxHp * LOW_HEALTH_RATIO
  if (!wasLow && isLow) return 'Low health!'
  return null
}
