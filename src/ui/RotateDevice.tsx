/**
 * Mobile play is landscape-only. CSS shows this over everything on a
 * touch screen held in portrait (see PORTRAIT_TOUCH_QUERY); the match
 * pauses itself at the same time.
 */
export function RotateDevice() {
  return (
    <div className="rotate-device" role="status">
      <p className="rotate-device-icon" aria-hidden="true">
        ⟳
      </p>
      <p>
        <strong>Rotate your device</strong>
      </p>
      <p>Pirate Battle is played in landscape.</p>
    </div>
  )
}
