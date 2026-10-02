import { z } from 'zod'
import type { PerfReport } from '../engine/perf'
import { readStored, writeStored } from './local'

const KEY = 'perf-report'

/**
 * The last `?perf=1` report, kept so it survives the move to the result
 * screen (and a refresh) until it is downloaded. Only the fields the
 * result screen needs are validated; the rest is passed through as is.
 */
const storedSchema = z.object({
  version: z.literal(1),
  recordedAt: z.string(),
  config: z.object({ sessionSeconds: z.number(), spawnSeconds: z.number() }),
})

export function savePerfReport(report: PerfReport): void {
  writeStored(KEY, report)
}

/** The stored report as JSON text, with the fields used to name the file. */
export function loadPerfReport(): {
  json: string
  sessionSeconds: number
  spawnSeconds: number
  recordedAt: string
} | null {
  const raw = readStored(KEY, z.unknown())
  if (raw === null) return null
  const parsed = storedSchema.safeParse(raw)
  if (!parsed.success) return null
  return {
    json: JSON.stringify(raw, null, 2),
    sessionSeconds: parsed.data.config.sessionSeconds,
    spawnSeconds: parsed.data.config.spawnSeconds,
    recordedAt: parsed.data.recordedAt,
  }
}
