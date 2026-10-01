import type { GameSnapshot } from '../engine/snapshot'
import { HUD_HEALTH_BAR } from '../render/uiLayout'
import { formatTime } from './format'
import { RoundButton } from './RoundButton'
import { cssVars, uiImage } from './uiAssets'

/** Same thresholds as the ship damage stages. */
function fillImage(ratio: number): string {
  if (ratio > 2 / 3) return uiImage('hud/health_fill_green')
  if (ratio >= 1 / 3) return uiImage('hud/health_fill_amber')
  return uiImage('hud/health_fill_red')
}

interface HudProps {
  snapshot: GameSnapshot
  onPause: () => void
}

/**
 * Health, score and time over the arena, styled after assets/sample.png.
 * Plain text in the DOM, so it is readable by assistive tech on demand;
 * it is deliberately not a live region (the Announcer reports events).
 */
export function Hud({ snapshot, onPause }: HudProps) {
  const { hp, maxHp, score, secondsLeft, status } = snapshot
  const ratio = maxHp > 0 ? hp / maxHp : 0
  const { width, height, fill } = HUD_HEALTH_BAR

  return (
    <section className="hud" aria-label="Match status">
      <div className="hud-health">
        <img className="hud-heart" src={uiImage('hud/icon_heart')} alt="" />
        <div
          className="hud-bar"
          style={cssVars({ '--bar-w': width, '--bar-h': height })}
        >
          <img
            className="hud-bar-frame"
            src={uiImage('hud/health_frame')}
            alt=""
          />
          {/* The fill image is clipped from the left to the hp ratio. */}
          <div
            className="hud-bar-fill"
            style={cssVars({
              '--fill-x': fill.x,
              '--fill-y': fill.y,
              '--fill-w': Math.round(fill.w * ratio),
              '--fill-h': fill.h,
            })}
          >
            <img src={fillImage(ratio)} alt="" />
          </div>
          <p className="hud-bar-text">
            <span className="visually-hidden">Health: </span>
            <span data-testid="hud-health">
              {hp} / {maxHp}
            </span>
          </p>
        </div>
      </div>

      <div className="hud-right">
        <p className="hud-counter">
          <img
            className="hud-counter-icon"
            src={uiImage('hud/icon_score')}
            alt=""
          />
          <span className="visually-hidden">Score: </span>
          <span data-testid="hud-score">{score}</span>
        </p>
        <p className="hud-counter">
          <img
            className="hud-counter-icon"
            src={uiImage('hud/icon_time')}
            alt=""
          />
          <span className="visually-hidden">Time left: </span>
          <time data-testid="hud-time" dateTime={`PT${String(secondsLeft)}S`}>
            {formatTime(secondsLeft)}
          </time>
        </p>
        <RoundButton
          icon="controls/icon_pause"
          label="Pause"
          disabled={status !== 'running'}
          onClick={onPause}
        />
      </div>
    </section>
  )
}
