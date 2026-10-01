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

const PAUSE_CODES: ReadonlySet<string> = new Set(['KeyP', 'Escape'])

/** Leave browser/OS shortcuts (Ctrl+R, Cmd+W, Alt+Tab...) alone. */
function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey
}

/**
 * Writes gameplay intents while the match is active. Every key is tracked
 * independently, so moving, turning and firing combine freely. All
 * listeners are removed when `signal` aborts.
 */
export function attachKeyboard(
  input: InputIntents,
  handlers: { onPause: () => void },
  signal: AbortSignal,
): void {
  const pressed = new Set<string>()

  // An intent stays on while any of its keys is held (e.g. W and ArrowUp).
  const refresh = (intent: Intent): void => {
    input[intent] = [...pressed].some((code) => KEY_BINDINGS[code] === intent)
  }

  const releaseAll = (): void => {
    pressed.clear()
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
      refresh(intent)
    },
    { signal },
  )

  // Keyup never arrives if focus leaves while a key is held.
  window.addEventListener('blur', releaseAll, { signal })
  signal.addEventListener('abort', releaseAll, { once: true })
}

/** While paused, only the pause keys are listened to, to resume. */
export function attachResumeKeys(
  onResume: () => void,
  signal: AbortSignal,
): void {
  window.addEventListener(
    'keydown',
    (event) => {
      if (hasModifier(event) || !PAUSE_CODES.has(event.code)) return
      event.preventDefault()
      if (!event.repeat) onResume()
    },
    { signal },
  )
}
