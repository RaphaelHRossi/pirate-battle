import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react'

interface PauseDialogProps {
  open: boolean
  onResume: () => void
}

/**
 * Native modal <dialog>: showModal() makes the page behind inert, traps
 * focus inside and gives Escape handling for free. Focus goes to Resume
 * when it opens; Escape resumes too, as the only other way out.
 */
export function PauseDialog({ open, onResume }: PauseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      resumeRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
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
      aria-labelledby="pause-title"
      onKeyDown={onKeyDown}
      onCancel={onCancel}
    >
      <h2 id="pause-title">Paused</h2>
      <p>The match is on hold. Nothing moves until you resume.</p>
      <div className="dialog-actions">
        <button
          ref={resumeRef}
          type="button"
          className="menu-button menu-button--primary"
          onClick={onResume}
        >
          Resume
        </button>
        {/* Placeholder until the main menu exists. */}
        <button
          type="button"
          className="menu-button"
          disabled
          aria-describedby="main-menu-soon"
        >
          Main Menu
        </button>
      </div>
      <p id="main-menu-soon" className="dialog-note">
        The main menu is coming soon.
      </p>
    </dialog>
  )
}
