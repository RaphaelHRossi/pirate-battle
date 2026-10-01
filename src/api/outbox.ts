import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { readStored, removeStored, writeStored } from '../storage/local'
import { matchRecordSchema, type MatchRecord } from './contracts'

/**
 * Completed matches not yet confirmed by the server. A record is written
 * here before any request is made and removed only after the server has
 * confirmed it, so a failed request, a closed tab or a refresh never loses
 * a match: whatever is still here is sent again later.
 */
const KEY = 'outbox'
const outboxSchema = z.object({
  version: z.literal(1),
  records: z.array(matchRecordSchema),
})

const listeners = new Set<() => void>()
let snapshot: readonly MatchRecord[] = read()

function read(): readonly MatchRecord[] {
  return readStored(KEY, outboxSchema)?.records ?? []
}

function write(records: readonly MatchRecord[]): void {
  writeStored(KEY, { version: 1, records })
  snapshot = records
  for (const listener of listeners) listener()
}

export const outbox = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Same array until the outbox changes (for useSyncExternalStore). */
  getSnapshot: (): readonly MatchRecord[] => snapshot,
  /** Adding the same match twice keeps one copy. */
  add: (record: MatchRecord): void => {
    if (snapshot.some((pending) => pending.matchId === record.matchId)) return
    write([...snapshot, record])
  },
  remove: (matchId: string): void => {
    if (!snapshot.some((pending) => pending.matchId === matchId)) return
    write(snapshot.filter((pending) => pending.matchId !== matchId))
  },
  clear: (): void => {
    removeStored(KEY)
    snapshot = []
    for (const listener of listeners) listener()
  },
}

export function useOutbox(): readonly MatchRecord[] {
  return useSyncExternalStore(outbox.subscribe, outbox.getSnapshot)
}
