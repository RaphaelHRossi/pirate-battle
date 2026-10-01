import type { Intent, IntentTracker } from './intents'

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
 * Feeds gameplay keys into `intents` while the match is active. Every key
 * is tracked independently (by its code), so moving, turning and firing
 * combine freely. All listeners are removed when `signal` aborts.
 */
export function attachKeyboard(
  intents: IntentTracker,
  handlers: { onPause: () => void },
  signal: AbortSignal,
): void {
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
      intents.press(event.code, intent)
    },
    { signal },
  )

  window.addEventListener(
    'keyup',
    (event) => {
      // No modifier check: a key released while Ctrl is down must not stick.
      if (!KEY_BINDINGS[event.code]) return
      event.preventDefault()
      intents.release(event.code)
    },
    { signal },
  )
}
