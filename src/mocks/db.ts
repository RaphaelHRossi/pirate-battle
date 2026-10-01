import { z } from 'zod'
import { matchRecordSchema, type MatchRecord } from '../api/contracts'
import { readStored, removeStored, writeStored } from '../storage/local'

/**
 * The mock server's database: every record it has confirmed (answered
 * 201/200 for, or committed before timing out). Kept in localStorage, so
 * confirmed matches survive a refresh exactly like a real backend would.
 */
const KEY = 'mock-db'

const dbSchema = z.object({
  version: z.literal(1),
  matches: z.array(matchRecordSchema),
})

function load(): MatchRecord[] {
  return readStored(KEY, dbSchema)?.matches ?? []
}

export const mockDb = {
  all(): MatchRecord[] {
    return load()
  },
  get(matchId: string): MatchRecord | undefined {
    return load().find((record) => record.matchId === matchId)
  },
  insert(record: MatchRecord): void {
    writeStored(KEY, { version: 1, matches: [...load(), record] })
  },
  clear(): void {
    removeStored(KEY)
  },
}
