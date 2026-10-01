import { z } from 'zod'
import {
  DEFAULT_MATCH_OPTIONS,
  isValidOption,
  type MatchOptionName,
  type MatchOptions,
} from '../game/config'
import { readStored, writeStored } from './local'

const KEY = 'options'

const optionValue = (name: MatchOptionName) =>
  z.number().refine((value) => isValidOption(name, value))

/** Versioned, so a future format change can drop or migrate old data. */
const storedOptionsSchema = z.object({
  version: z.literal(1),
  sessionSeconds: optionValue('sessionSeconds'),
  spawnSeconds: optionValue('spawnSeconds'),
})

/** The saved options, or the defaults if none (or only invalid ones) exist. */
export function loadOptions(): MatchOptions {
  const stored = readStored(KEY, storedOptionsSchema)
  if (!stored) return { ...DEFAULT_MATCH_OPTIONS }
  return {
    sessionSeconds: stored.sessionSeconds,
    spawnSeconds: stored.spawnSeconds,
  }
}

/** Saves valid options only; returns false if they were rejected or lost. */
export function saveOptions(options: MatchOptions): boolean {
  const stored = storedOptionsSchema.safeParse({ version: 1, ...options })
  if (!stored.success) return false
  return writeStored(KEY, stored.data)
}
