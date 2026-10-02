import type { EnemyKind } from '../game/types'

/**
 * What the renderer currently draws, read back for test-mode inspection.
 * Plain types only: the e2e tests import them without pulling in Pixi.
 */
export interface ShipViewState {
  visible: boolean
  /** Index of the stage art on screen: 0 intact … 3 wreck; -1 if unknown. */
  damageStage: number
  barVisible: boolean
  /** Width of the bar fill as a fraction of the full bar. */
  barFillRatio: number
  burning: boolean
}

export interface RendererState {
  /** Where the arena is drawn on the canvas, in CSS pixels. */
  layout: { scale: number; x: number; y: number; width: number; height: number }
  ships: (ShipViewState & { id: number; kind: 'player' | EnemyKind })[]
}
