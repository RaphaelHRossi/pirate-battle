import type { Ref } from 'react'
import { cssVars, uiImage } from './uiAssets'

const ROUND_BUTTON_VARS = cssVars({
  '--normal': `url(${uiImage('controls/button_round_normal')})`,
  '--hover': `url(${uiImage('controls/button_round_hover')})`,
  '--pressed': `url(${uiImage('controls/button_round_pressed')})`,
})

interface RoundButtonProps {
  /** UI image path, e.g. 'controls/icon_plus'. */
  icon: string
  /** Accessible name; the icon itself is decorative. */
  label: string
  disabled?: boolean
  onClick: () => void
  ref?: Ref<HTMLButtonElement>
}

/** The round control frame with an icon (pause, -/+). */
export function RoundButton({
  icon,
  label,
  disabled,
  onClick,
  ref,
}: RoundButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className="round-button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={ROUND_BUTTON_VARS}
    >
      <img src={uiImage(icon)} alt="" />
    </button>
  )
}
