import type { CSSProperties } from 'react'

const base = import.meta.env.BASE_URL

/** URL of a UI PNG, e.g. uiImage('hud/icon_heart'). */
export function uiImage(path: string): string {
  return `${base}assets/png/default/ui/${path}.png`
}

/**
 * Inline CSS custom properties (`--name: value`), typed so a typo in the
 * `--` prefix is caught.
 */
export function cssVars(
  vars: Readonly<Record<`--${string}`, string | number>>,
): CSSProperties {
  return vars
}
