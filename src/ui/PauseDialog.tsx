import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react'
import { panelSliceVars } from './panel'

interface PauseDialogProps {
  open: boolean
  onResume: () => void
  /** Leaves the match: it is abandoned and never recorded. */
  onMainMenu: () => void
}

/**
 * Native modal <dialog>: showModal() makes the page behind inert, traps
 * focus inside and gives Escape handling for free. Focus goes to Resume
 * when it opens; Escape resumes too, as the only other way out.
 */
export function PauseDialog({ open, onResume, onMainMenu }: PauseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)
  /** Where focus was when the dialog opened (e.g. the HUD Pause button). */
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      const active = document.activeElement
      returnFocusRef.current = active instanceof HTMLElement ? active : null
      dialog.showModal()
      resumeRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      // Back to where the player was, if that control still exists.
      const target = returnFocusRef.current
      returnFocusRef.current = null
      if (target?.isConnected) target.focus()
    }
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key !== 'Escape') return
    // Handle Escape ourselves (no 'cancel' close), and stop it here: once
    // resumed, the game's window listener is back and would otherwise see
    // this same key press and pause again at once.
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) onResume()
  }

  // Fallback for platforms that cancel a dialog without a key event.
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault()
    onResume()
  }

  return (
    <dialog
      ref={dialogRef}
      className="pause-dialog"
      style={panelSliceVars}
      aria-labelledby="pause-title"
      onKeyDown={onKeyDown}
      onCancel={onCancel}
    >
      <h2 id="pause-title">Paused</h2>
      <p>Ready when you are. Nothing moves until you resume.</p>
      <div className="dialog-actions">
        <button
          ref={resumeRef}
          type="button"
          className="menu-button menu-button--primary"
          onClick={onResume}
        >
          Resume
        </button>
        <button
          type="button"
          className="menu-button"
          aria-describedby="main-menu-note"
          onClick={onMainMenu}
        >
          Main Menu
        </button>
      </div>
      <p id="main-menu-note" className="dialog-note">
        Leaving ends this match without recording it.
      </p>
    </dialog>
  )
}
