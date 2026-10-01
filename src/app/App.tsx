import { useEffect } from 'react'
import { CaptainsLog } from '../ui/CaptainsLog'
import { GameView } from '../ui/GameView'
import { MainMenu } from '../ui/MainMenu'
import { NetworkPanel } from '../ui/NetworkPanel'
import { OptionsScreen } from '../ui/OptionsScreen'
import { ResultScreen } from '../ui/ResultScreen'
import { RotateDevice } from '../ui/RotateDevice'
import { RegistrationSync } from './RegistrationSync'
import { navigate, parseRoute, useHash, type Route } from './router'

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'menu':
      return <MainMenu />
    case 'options':
      return <OptionsScreen />
    case 'play':
      // Mounted only while the hash is #/play: entering starts a new
      // match, leaving (or refreshing) destroys it unrecorded.
      return <GameView />
    case 'result':
      return <ResultScreen />
    case 'log':
      return <CaptainsLog tab={route.tab} />
    case 'network':
      return <NetworkPanel />
  }
}

export function App() {
  const hash = useHash()
  const route = parseRoute(hash)
  const unknown = route === null

  // Unknown or empty hash: show the menu and fix the URL to match.
  useEffect(() => {
    if (unknown) navigate({ name: 'menu' }, { replace: true })
  }, [unknown])

  return (
    <>
      <Screen route={route ?? { name: 'menu' }} />
      <RotateDevice />
      <RegistrationSync onMenu={(route?.name ?? 'menu') === 'menu'} />
    </>
  )
}
