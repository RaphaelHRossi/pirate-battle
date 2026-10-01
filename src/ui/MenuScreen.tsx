import { useEffect, useRef, type ReactNode } from 'react'
import { panelSliceVars } from './panel'

interface MenuScreenProps {
  /** Visible heading; also names the screen for assistive tech. */
  heading: ReactNode
  /** Browser tab title. */
  title: string
  className?: string
  children: ReactNode
}

/**
 * A menu screen: the scene background and a framed panel. On mount the
 * heading takes focus, so after every navigation keyboard and screen
 * reader users start at the top of the new screen, not on <body>.
 */
export function MenuScreen({
  heading,
  title,
  className,
  children,
}: MenuScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = `${title} · Pirate Battle`
    headingRef.current?.focus()
  }, [title])

  return (
    <main className="menu-screen">
      <div
        className={className ? `panel ${className}` : 'panel'}
        style={panelSliceVars}
      >
        <h1 ref={headingRef} className="panel-heading" tabIndex={-1}>
          {heading}
        </h1>
        {children}
      </div>
    </main>
  )
}
