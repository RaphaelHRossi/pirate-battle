import type { FrozenGameConfig } from '../game/config'
import type { World } from '../game/types'

export interface PerfReport {
  version: 1
  recordedAt: string
  /** Wall time covered by the recorded frames, in seconds. */
  durationSeconds: number
  frames: number
  avgFps: number
  frameTimeMs: {
    avg: number
    p50: number
    p95: number
    p99: number
    max: number
  }
  /** Frames slower than one 60 Hz frame, and than two. */
  longFrames: { over16_7ms: number; over33_3ms: number }
  entities: {
    max: number
    avg: number
    atMax: { enemies: number; projectiles: number; effects: number }
  }
  config: {
    sessionSeconds: number
    spawnSeconds: number
    full: FrozenGameConfig
  }
  environment: {
    userAgent: string
    devicePixelRatio: number
    screen: { width: number; height: number }
    viewport: { width: number; height: number }
  }
}

interface EntityCount {
  total: number
  enemies: number
  projectiles: number
  effects: number
}

function countEntities(world: World): EntityCount {
  const alive = (list: readonly { alive: boolean }[]): number =>
    list.reduce((count, item) => count + (item.alive ? 1 : 0), 0)
  const enemies = alive(world.enemies)
  const projectiles = alive(world.projectiles)
  const effects = alive(world.effects)
  // The player ship is always present.
  return {
    total: 1 + enemies + projectiles + effects,
    enemies,
    projectiles,
    effects,
  }
}

/** Nearest-rank percentile of an ascending array. */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))] ?? 0
}

const round = (value: number, digits = 2): number =>
  Math.round(value * 10 ** digits) / 10 ** digits

/**
 * Records real frame times (`?perf=1`). Each value is the gap between two
 * consecutive requestAnimationFrame timestamps while the match is played;
 * `gap()` marks a discontinuity (pause, resume, match end), so paused or
 * hidden time is never counted as a slow frame. Entity counts are sampled
 * on every rendered frame.
 */
export class PerfRecorder {
  private readonly frameTimes: number[] = []
  private lastFrameMs: number | null = null
  private entitySamples = 0
  private entitySum = 0
  private maxEntities: EntityCount = {
    total: 0,
    enemies: 0,
    projectiles: 0,
    effects: 0,
  }

  frame(nowMs: number): void {
    if (this.lastFrameMs !== null)
      this.frameTimes.push(nowMs - this.lastFrameMs)
    this.lastFrameMs = nowMs
  }

  gap(): void {
    this.lastFrameMs = null
  }

  sample(world: World): void {
    if (world.match.status !== 'running') return
    const count = countEntities(world)
    this.entitySamples += 1
    this.entitySum += count.total
    if (count.total > this.maxEntities.total) this.maxEntities = count
  }

  /** Live numbers for the overlay: FPS over the last ~60 frames. */
  live(): { fps: number; entities: number } {
    const recent = this.frameTimes.slice(-60)
    const total = recent.reduce((sum, ms) => sum + ms, 0)
    return {
      fps: total > 0 ? (recent.length * 1000) / total : 0,
      entities: this.maxEntities.total,
    }
  }

  report(config: FrozenGameConfig): PerfReport {
    const sorted = [...this.frameTimes].sort((a, b) => a - b)
    const totalMs = sorted.reduce((sum, ms) => sum + ms, 0)
    const frames = sorted.length
    const { enemies, projectiles, effects } = this.maxEntities
    return {
      version: 1,
      recordedAt: new Date().toISOString(),
      durationSeconds: round(totalMs / 1000),
      frames,
      avgFps: frames > 0 ? round((frames * 1000) / totalMs) : 0,
      frameTimeMs: {
        avg: frames > 0 ? round(totalMs / frames) : 0,
        p50: round(percentile(sorted, 50)),
        p95: round(percentile(sorted, 95)),
        p99: round(percentile(sorted, 99)),
        max: round(sorted.at(-1) ?? 0),
      },
      longFrames: {
        over16_7ms: sorted.filter((ms) => ms > 1000 / 60 + 0.5).length,
        over33_3ms: sorted.filter((ms) => ms > 1000 / 30 + 0.5).length,
      },
      entities: {
        max: this.maxEntities.total,
        avg:
          this.entitySamples > 0
            ? round(this.entitySum / this.entitySamples, 1)
            : 0,
        atMax: { enemies, projectiles, effects },
      },
      config: {
        sessionSeconds: config.match.durationSeconds,
        spawnSeconds: config.spawn.intervalSeconds,
        full: config,
      },
      environment: {
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        screen: { width: window.screen.width, height: window.screen.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
    }
  }
}
