import { useState, type PointerEvent } from 'react'
import { cssVars, uiImage } from '../ui/uiAssets'
import type { Intent } from './intents'

export interface TouchInput {
  press(pointerId: number, intent: Intent): void
  release(pointerId: number): void
}

interface ButtonSpec {
  intent: Intent
  label: string
  icon: string
  /** Grid cell inside its cluster, laid out like assets/sample.png. */
  area: 'top' | 'left' | 'right'
}

const STEERING: readonly ButtonSpec[] = [
  {
    intent: 'forward',
    label: 'Sail forward',
    icon: 'icon_forward',
    area: 'top',
  },
  {
    intent: 'turnLeft',
    label: 'Turn left',
    icon: 'icon_turn_left',
    area: 'left',
  },
  {
    intent: 'turnRight',
    label: 'Turn right',
    icon: 'icon_turn_right',
    area: 'right',
  },
]

const GUNS: readonly ButtonSpec[] = [
  {
    intent: 'fireFront',
    label: 'Fire bow cannon',
    icon: 'icon_fire_front',
    area: 'top',
  },
  {
    intent: 'fireLeft',
    label: 'Fire port broadside',
    icon: 'icon_fire_left',
    area: 'left',
  },
  {
    intent: 'fireRight',
    label: 'Fire starboard broadside',
    icon: 'icon_fire_right',
    area: 'right',
  },
]

const FRAME_VARS = cssVars({
  '--normal': `url(${uiImage('controls/button_round_normal')})`,
  '--pressed': `url(${uiImage('controls/button_round_pressed')})`,
})

/**
 * One hold-to-act button. Pointer Events cover touch, pen and mouse alike,
 * and each pointer has its own id, so several fingers on several buttons
 * (sail + turn + fire) work at once. Pointer capture keeps the release on
 * this button even if the finger slides off; `pointercancel` (the browser
 * took over the gesture) and lost capture release it too, so a button can
 * never stay stuck down.
 */
function TouchButton({ spec, input }: { spec: ButtonSpec; input: TouchInput }) {
  const [pointers, setPointers] = useState<ReadonlySet<number>>(new Set())

  const down = (event: PointerEvent<HTMLButtonElement>): void => {
    // No focus, text selection or emulated mouse events from a touch.
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    input.press(event.pointerId, spec.intent)
    const { pointerId } = event
    setPointers((current) => new Set(current).add(pointerId))
  }

  const up = (event: PointerEvent<HTMLButtonElement>): void => {
    const { pointerId } = event
    input.release(pointerId)
    setPointers((current) => {
      if (!current.has(pointerId)) return current
      const next = new Set(current)
      next.delete(pointerId)
      return next
    })
  }

  return (
    <button
      type="button"
      className={`touch-button touch-button--${spec.area}`}
      aria-label={spec.label}
      // Keyboard players have their own keys; keeping these out of the Tab
      // order also stops Space on a focused button from "clicking" it.
      tabIndex={-1}
      data-intent={spec.intent}
      data-pressed={pointers.size > 0 ? 'true' : undefined}
      style={FRAME_VARS}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(event) => {
        // A long press must not open the context menu.
        event.preventDefault()
      }}
    >
      <img src={uiImage(`controls/${spec.icon}`)} alt="" draggable={false} />
    </button>
  )
}

/**
 * On-screen controls for touch screens (shown by CSS on coarse pointers
 * only). They write the same intents as the keyboard, through the session.
 */
export function TouchControls({ input }: { input: TouchInput }) {
  return (
    <div className="touch-controls" role="group" aria-label="Ship controls">
      <div className="touch-cluster touch-cluster--steer">
        {STEERING.map((spec) => (
          <TouchButton key={spec.intent} spec={spec} input={input} />
        ))}
      </div>
      <div className="touch-cluster touch-cluster--guns">
        {GUNS.map((spec) => (
          <TouchButton key={spec.intent} spec={spec} input={input} />
        ))}
      </div>
    </div>
  )
}
