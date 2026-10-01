import { Container, Rectangle, Sprite, Texture } from 'pixi.js'
import type { Ship, World } from '../../game/types'
import type { ShipStages } from '../assets'
import { SHIP_HEALTH_BAR } from '../uiLayout'

/**
 * The ship sprites are drawn with the bow pointing down (+y, heading π/2),
 * while heading 0 points right. Subtracting a quarter turn lines them up.
 */
export const SHIP_SPRITE_ROTATION_OFFSET = -Math.PI / 2

/** Above this hp ratio a ship is intact; the art has four stages. */
const INTACT_ABOVE = 2 / 3
/** Below this hp ratio it is heavily damaged and burning. */
const HEAVY_BELOW = 1 / 3

/** 0 intact (>66%), 1 damaged (33–66%), 2 heavily damaged (<33%), 3 wreck. */
export function damageStage(hp: number, maxHp: number): 0 | 1 | 2 | 3 {
  if (hp <= 0) return 3
  const ratio = hp / maxHp
  if (ratio > INTACT_ABOVE) return 0
  if (ratio >= HEAVY_BELOW) return 1
  return 2
}

const HIT_TINT = 0xff7070
const NO_TINT = 0xffffff
/** The bar sits this far above the ship's centre, whatever its heading. */
const BAR_OFFSET_Y = 70
const BAR_SCALE = 0.45
/** Flame positions in the ship's own frame (x along the hull, y across). */
const FIRE_SPOTS = [
  { along: 18, across: -8 },
  { along: -16, across: 9 },
] as const
const FIRE_FRAMES_PER_SECOND = 8

/**
 * A fill sprite clipped from the left to the hp ratio, by giving it its
 * own texture over the fill region of the shared atlas source. A new clip
 * is made only when the ratio changes, and the old one is released (the
 * atlas source itself is never destroyed).
 */
class HealthBar {
  readonly container = new Container()
  private readonly fill = new Sprite()
  private readonly fillSource: Texture
  private clipped: Texture | null = null
  private ratio = -1

  constructor(frame: Texture, fill: Texture) {
    this.fillSource = fill
    const { width, height, fill: rect } = SHIP_HEALTH_BAR
    this.fill.position.set(rect.x, rect.y)
    this.container.addChild(new Sprite({ texture: frame }), this.fill)
    // Centre the bar on its position, so it can sit over the ship.
    this.container.pivot.set(width / 2, height / 2)
    this.container.scale.set(BAR_SCALE)
  }

  setRatio(ratio: number): void {
    const clamped = Math.min(1, Math.max(0, ratio))
    if (clamped === this.ratio) return
    this.ratio = clamped
    const { fill: rect } = SHIP_HEALTH_BAR
    const width = Math.round(rect.w * clamped)
    this.fill.visible = width > 0
    if (width <= 0) return
    const previous = this.clipped
    this.clipped = new Texture({
      source: this.fillSource.source,
      frame: new Rectangle(
        this.fillSource.frame.x + rect.x,
        this.fillSource.frame.y + rect.y,
        width,
        rect.h,
      ),
    })
    this.fill.texture = this.clipped
    previous?.destroy()
  }

  destroy(): void {
    this.clipped?.destroy()
    this.clipped = null
  }
}

export interface ShipViewTextures {
  stages: ShipStages
  fire: readonly [Texture, Texture]
  barFrame: Texture
  barFill: Texture
}

/**
 * Draws one ship: a rotating hull with its damage-stage texture and hit
 * flash, upright flames when heavily damaged, and a health bar that
 * follows the ship without rotating.
 */
export class ShipView {
  readonly container = new Container()
  private readonly hull: Sprite
  private readonly fires: Sprite[]
  private readonly bar: HealthBar
  private textures: ShipViewTextures

  constructor(textures: ShipViewTextures) {
    this.textures = textures
    this.hull = new Sprite({ texture: textures.stages[0], anchor: 0.5 })
    this.fires = FIRE_SPOTS.map(
      () => new Sprite({ anchor: { x: 0.5, y: 0.9 }, visible: false }),
    )
    this.bar = new HealthBar(textures.barFrame, textures.barFill)
    this.container.addChild(this.hull, ...this.fires, this.bar.container)
  }

  /** Switches art, e.g. when a pooled enemy slot changes kind. */
  setTextures(textures: ShipViewTextures): void {
    this.textures = textures
  }

  sync(ship: Readonly<Ship>, world: Readonly<World>): void {
    const stage = damageStage(ship.hp, ship.maxHp)
    const sunk = stage === 3

    this.hull.texture = this.textures.stages[stage]
    this.hull.position.set(ship.x, ship.y)
    this.hull.rotation = ship.heading + SHIP_SPRITE_ROTATION_OFFSET
    const sinceHit =
      ship.lastHitAt === null ? Infinity : world.elapsedSeconds - ship.lastHitAt
    this.hull.tint =
      !sunk && sinceHit < world.config.effects.hitFlashSeconds
        ? HIT_TINT
        : NO_TINT

    // Flames stay upright (fire rises) but ride along the rotating hull.
    const burning = stage === 2
    const frame = Math.floor(world.elapsedSeconds * FIRE_FRAMES_PER_SECOND)
    const cos = Math.cos(ship.heading)
    const sin = Math.sin(ship.heading)
    this.fires.forEach((fire, index) => {
      fire.visible = burning
      if (!burning) return
      const spot = FIRE_SPOTS[index] ?? FIRE_SPOTS[0]
      fire.texture =
        this.textures.fire[(frame + index) % 2] ?? this.textures.fire[0]
      fire.position.set(
        ship.x + cos * spot.along - sin * spot.across,
        ship.y + sin * spot.along + cos * spot.across,
      )
    })

    this.bar.container.visible = !sunk
    this.bar.container.position.set(ship.x, ship.y - BAR_OFFSET_Y)
    this.bar.setRatio(ship.hp / ship.maxHp)
  }

  destroy(): void {
    this.bar.destroy()
  }
}
