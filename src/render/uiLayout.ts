/**
 * Layout metadata from ui_sheet.json, shared by the Pixi health bars and
 * the React HUD so both clip their fill exactly where the art expects it.
 * The `ui` fields use logical (1×) pixels relative to the sprite's
 * top-left corner.
 */
import uiSheet from '../../public/assets/spritesheet/ui_sheet.json'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface BarLayout {
  /** Size of the frame image. */
  width: number
  height: number
  /** Area inside the frame the fill occupies at 100%; clipped from the left. */
  fill: Rect
}

const { frames } = uiSheet

/** HUD bar (health_frame + health_fill_*), 256×48. */
export const HUD_HEALTH_BAR: BarLayout = {
  width: frames.health_frame.frame.w,
  height: frames.health_frame.frame.h,
  fill: frames.health_frame.ui.layout.fill_rect,
}

/** Bar over ships (enemy_health_frame + enemy_health_fill_*), 160×40. */
export const SHIP_HEALTH_BAR: BarLayout = {
  width: frames.enemy_health_frame.frame.w,
  height: frames.enemy_health_frame.frame.h,
  fill: frames.enemy_health_frame.ui.layout.fill_rect,
}
