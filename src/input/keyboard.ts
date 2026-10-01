import type { InputIntents } from '../game/types'
import { clearInput } from './InputState'

type Intent = keyof InputIntents

/**
 * Bound by `event.code` (physical key position), so the layout stays the
 * same on AZERTY/QWERTZ keyboards.
 */
const KEY_BINDINGS: Readonly<Record<string, Intent>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
}

export interface KeyboardControls {
  /** Call after every simulation step, to release latched taps. */
  afterStep(): void
}

const PAUSE_CODES: ReadonlySet<string> = new Set(['KeyP', 'Escape'])

/** Leave browser/OS shortcuts (Ctrl+R, Cmd+W, Alt+Tab...) alone. */
function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey
}

/**
 * Writes gameplay intents while the match is active. Every key is tracked
 * independently, so moving, turning and firing combine freely. All
 * listeners are removed when `signal` aborts.
 *
 * Taps are latched: a key pressed and released between two simulation
 * steps keeps its intent on until `afterStep()`, so the game sees it once.
 */
export function attachKeyboard(
  input: InputIntents,
  handlers: { onPause: () => void },
  signal: AbortSignal,
): KeyboardControls {
  const pressed = new Set<string>()
  /** Intents switched on since the last step; no step has seen them yet. */
  const unseen = new Set<Intent>()
  /** Released before any step saw them; cleared after the next step. */
  const deferredRelease = new Set<Intent>()

  // An intent stays on while any of its keys is held (e.g. W and ArrowUp).
  const refresh = (intent: Intent): void => {
    input[intent] = [...pressed].some((code) => KEY_BINDINGS[code] === intent)
  }

  const releaseAll = (): void => {
    pressed.clear()
    unseen.clear()
    deferredRelease.clear()
    clearInput(input)
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (hasModifier(event)) return
      if (PAUSE_CODES.has(event.code)) {
        event.preventDefault()
        if (!event.repeat) handlers.onPause()
        return
      }
      const intent = KEY_BINDINGS[event.code]
      if (!intent) return
      // Stops Space/arrows from scrolling the page.
      event.preventDefault()
      pressed.add(event.code)
      if (!input[intent]) unseen.add(intent)
      input[intent] = true
    },
    { signal },
  )

  window.addEventListener(
    'keyup',
    (event) => {
      // No modifier check: a key released while Ctrl is down must not stick.
      const intent = KEY_BINDINGS[event.code]
      if (!intent) return
      event.preventDefault()
      pressed.delete(event.code)
      if (unseen.has(intent)) deferredRelease.add(intent)
      else refresh(intent)
    },
    { signal },
  )

  // Keyup never arrives if focus leaves while a key is held.
  window.addEventListener('blur', releaseAll, { signal })
  signal.addEventListener('abort', releaseAll, { once: true })

  return {
    afterStep: () => {
      unseen.clear()
      for (const intent of deferredRelease) refresh(intent)
      deferredRelease.clear()
    },
  }
}
