/** Simulation step: the game always advances in slices of exactly 1/60 s. */
export const STEP_SECONDS = 1 / 60

/**
 * Longest frame we account for. After a long stall (tab switch, debugger,
 * GC pause) we drop the excess instead of fast-forwarding through it.
 */
export const MAX_FRAME_SECONDS = 0.25

/**
 * Tolerance for floating-point drift: subtracting 1/60 sixty times from 1.0
 * can leave 1/60 − 1e-17, which would otherwise skip the 60th step.
 */
const EPSILON = 1e-9

/**
 * Fixed-timestep accumulator. Real frame time is accumulated and consumed
 * in whole steps, so game rules only ever see `STEP_SECONDS`.
 */
export class FixedStepLoop {
  private readonly onStep: (dt: number) => void
  private readonly onRender: () => void
  private accumulator = 0
  private lastTimeMs: number | null = null

  constructor(onStep: (dt: number) => void, onRender: () => void) {
    this.onStep = onStep
    this.onRender = onRender
  }

  /** Called once per animation frame with its timestamp in ms. */
  frame(nowMs: number): void {
    if (this.lastTimeMs !== null) {
      const deltaSeconds = (nowMs - this.lastTimeMs) / 1000
      this.accumulator += Math.min(Math.max(0, deltaSeconds), MAX_FRAME_SECONDS)
      this.drain()
    }
    this.lastTimeMs = nowMs
    this.onRender()
  }

  /**
   * Simulates exactly `ms` of game time, then renders once. Not clamped:
   * tests ask for a precise amount of game time.
   */
  advance(ms: number): void {
    this.accumulator += ms / 1000
    this.drain()
    this.onRender()
  }

  /** Forgets the previous frame, so paused wall time is never simulated. */
  resetClock(): void {
    this.lastTimeMs = null
    this.accumulator = 0
  }

  private drain(): void {
    while (this.accumulator >= STEP_SECONDS - EPSILON) {
      this.onStep(STEP_SECONDS)
      this.accumulator -= STEP_SECONDS
    }
    this.accumulator = Math.max(0, this.accumulator)
  }
}
