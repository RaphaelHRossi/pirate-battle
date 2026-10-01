import type { InputIntents } from '../game/types'
import { clearInput } from './InputState'

export type Intent = keyof InputIntents

/**
 * Turns presses from any number of sources (a key code, a touch pointer)
 * into the intents the simulation reads. An intent is on while any source
 * holding it is pressed, so a key and a touch button for the same action
 * never release each other.
 *
 * Taps are latched: a source pressed and released between two simulation
 * steps keeps its intent on until `afterStep()`, so the game sees it once.
 */
export interface IntentTracker {
  press(source: string, intent: Intent): void
  release(source: string): void
  /** Call after every simulation step, to release latched taps. */
  afterStep(): void
  releaseAll(): void
}

export function createIntentTracker(input: InputIntents): IntentTracker {
  const held = new Map<string, Intent>()
  /** Intents switched on since the last step; no step has seen them yet. */
  const unseen = new Set<Intent>()
  /** Released before any step saw them; cleared after the next step. */
  const deferredRelease = new Set<Intent>()

  const refresh = (intent: Intent): void => {
    input[intent] = [...held.values()].includes(intent)
  }

  return {
    press(source, intent) {
      if (held.get(source) === intent) return
      held.set(source, intent)
      if (!input[intent]) unseen.add(intent)
      input[intent] = true
    },
    release(source) {
      const intent = held.get(source)
      if (!intent) return
      held.delete(source)
      if (unseen.has(intent)) deferredRelease.add(intent)
      else refresh(intent)
    },
    afterStep() {
      unseen.clear()
      for (const intent of deferredRelease) refresh(intent)
      deferredRelease.clear()
    },
    releaseAll() {
      held.clear()
      unseen.clear()
      deferredRelease.clear()
      clearInput(input)
    },
  }
}
