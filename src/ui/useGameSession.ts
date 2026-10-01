import {
  useEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import { GameSession } from '../engine/GameSession'
import { INITIAL_SNAPSHOT, type GameSnapshot } from '../engine/snapshot'

/**
 * A stable store React can subscribe to for the component's whole life,
 * while the GameSession behind it is replaced on every effect run (React
 * Strict Mode mounts, unmounts and mounts again). Connecting a session
 * just notifies subscribers; nothing here calls setState in an effect.
 */
class SessionHandle {
  private session: GameSession | null = null
  private stopListening: (() => void) | null = null
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = (): GameSnapshot =>
    this.session?.getSnapshot() ?? INITIAL_SNAPSHOT

  connect(session: GameSession): void {
    this.stopListening?.()
    this.session = session
    this.stopListening = session.subscribe(() => {
      this.emit()
    })
    this.emit()
  }

  disconnect(session: GameSession): void {
    if (this.session !== session) return
    this.stopListening?.()
    this.stopListening = null
    this.session = null
    this.emit()
  }

  pause(): void {
    this.session?.pause()
  }

  resume(): void {
    this.session?.resume()
  }

  retry(): void {
    void this.session?.retry()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export interface GameSessionControls {
  pause(): void
  resume(): void
  retry(): void
}

/**
 * Mounts a GameSession into `hostRef` and returns its latest snapshot.
 * The component re-renders only when the snapshot object changes, which
 * the session does only when a displayed value changes, never per frame.
 */
export function useGameSession(hostRef: RefObject<HTMLDivElement | null>): {
  snapshot: GameSnapshot
  controls: GameSessionControls
} {
  const [handle] = useState(() => new SessionHandle())

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // One session per effect run: Strict Mode's second mount gets a fresh one.
    const session = new GameSession(host)
    handle.connect(session)
    session.start().catch((cause: unknown) => {
      // start() handles its expected failures itself (snapshot 'error').
      if (!session.isDisposed) console.error('Failed to start the game', cause)
    })
    return () => {
      handle.disconnect(session)
      session.destroy()
    }
  }, [handle, hostRef])

  const snapshot = useSyncExternalStore(handle.subscribe, handle.getSnapshot)
  return { snapshot, controls: handle }
}
