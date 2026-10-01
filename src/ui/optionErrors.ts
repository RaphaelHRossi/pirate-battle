import {
  isValidOption,
  MATCH_OPTION_LIMITS,
  type MatchOptionName,
} from '../game/config'

/** Why `text` is not a valid value for the option, or null if it is. */
export function optionError(
  label: string,
  name: MatchOptionName,
  text: string,
): string | null {
  const { min, max, step } = MATCH_OPTION_LIMITS[name]
  if (text.trim() === '') return `Enter the ${label.toLowerCase()} in seconds.`
  const value = Number(text)
  if (!Number.isFinite(value)) return `${label} must be a number of seconds.`
  if (value < min || value > max) {
    return `${label} must be between ${String(min)} and ${String(max)} seconds.`
  }
  if (!isValidOption(name, value)) {
    return `${label} must go in steps of ${String(step)} seconds.`
  }
  return null
}
