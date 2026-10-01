import { useId, useState } from 'react'
import { navigate } from '../app/router'
import {
  clampOption,
  isValidOption,
  MATCH_OPTION_LIMITS,
  type MatchOptionName,
  type MatchOptions,
} from '../game/config'
import { loadOptions, saveOptions } from '../storage/options'
import { MenuScreen } from './MenuScreen'
import { optionError } from './optionErrors'
import { RoundButton } from './RoundButton'

interface OptionFieldProps {
  name: MatchOptionName
  label: string
  value: number
  onChange: (value: number) => void
}

/**
 * One option: -/+ buttons that always produce a valid value, and a text
 * box for typing one. A typed value is applied only once it is valid;
 * until then the field shows why, and the saved value stays in force.
 */
function OptionField({ name, label, value, onChange }: OptionFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const { min, max, step } = MATCH_OPTION_LIMITS[name]
  const error = optionError(label, name, draft)
  const inputId = `${id}-input`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const set = (next: number): void => {
    setDraft(String(next))
    onChange(next)
  }
  // Step from what is typed if it is a number, else from the saved value.
  const typed = Number(draft)
  const base = draft.trim() !== '' && Number.isFinite(typed) ? typed : value
  const bump = (direction: 1 | -1): void => {
    set(clampOption(name, base + direction * step))
  }

  return (
    <div className="option-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="option-control">
        <RoundButton
          icon="controls/icon_minus"
          label={`Decrease ${label.toLowerCase()}`}
          disabled={base <= min}
          onClick={() => {
            bump(-1)
          }}
        />
        <span className="option-value">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            onChange={(event) => {
              const text = event.target.value
              setDraft(text)
              const parsed = Number(text)
              if (text.trim() !== '' && isValidOption(name, parsed)) {
                onChange(parsed)
              }
            }}
          />
          <span aria-hidden="true">s</span>
        </span>
        <RoundButton
          icon="controls/icon_plus"
          label={`Increase ${label.toLowerCase()}`}
          disabled={base >= max}
          onClick={() => {
            bump(1)
          }}
        />
      </div>
      <p id={hintId} className="option-hint">
        {min}–{max} seconds, in steps of {step}.
      </p>
      {/* Always present, so the polite live region exists before it changes. */}
      <p id={errorId} className="option-error" aria-live="polite">
        {error}
      </p>
    </div>
  )
}

type SaveStatus = 'idle' | 'saved' | 'failed'

export function OptionsScreen() {
  const [options, setOptions] = useState<MatchOptions>(loadOptions)
  const [status, setStatus] = useState<SaveStatus>('idle')

  const update = (name: MatchOptionName, value: number): void => {
    const next = { ...options, [name]: value }
    setOptions(next)
    setStatus(saveOptions(next) ? 'saved' : 'failed')
  }

  return (
    <MenuScreen title="Options" heading="Options">
      <form
        className="options-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <OptionField
          name="sessionSeconds"
          label="Game session time"
          value={options.sessionSeconds}
          onChange={(value) => {
            update('sessionSeconds', value)
          }}
        />
        <OptionField
          name="spawnSeconds"
          label="Enemy spawn time"
          value={options.spawnSeconds}
          onChange={(value) => {
            update('spawnSeconds', value)
          }}
        />
      </form>
      <p className="panel-note" role="status" data-testid="options-status">
        {status === 'saved' && 'Saved. Changes apply to your next match.'}
        {status === 'failed' &&
          'Could not save: this browser is blocking local storage.'}
      </p>
      <div className="menu-actions">
        <button
          type="button"
          className="menu-button"
          onClick={() => {
            navigate({ name: 'menu' })
          }}
        >
          Main Menu
        </button>
      </div>
    </MenuScreen>
  )
}
