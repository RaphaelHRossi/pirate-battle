import { MENU_PANEL_BORDERS } from '../render/uiLayout'
import { cssVars } from './uiAssets'

const { top, right, bottom, left } = MENU_PANEL_BORDERS

/**
 * The panel_menu frame's 9-slice borders from ui_sheet.json, as CSS
 * variables for `.panel` (border-image-slice and border widths).
 */
export const panelSliceVars = cssVars({
  '--slice-top': top,
  '--slice-right': right,
  '--slice-bottom': bottom,
  '--slice-left': left,
})
