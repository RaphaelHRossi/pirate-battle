import { navigate } from '../app/router'
import { MenuScreen } from './MenuScreen'
import { uiImage } from './uiAssets'

interface Control {
  action: string
  keys: string
  touch: string
}

const CONTROLS: readonly Control[] = [
  { action: 'Sail forward', keys: 'W or ↑', touch: '↑ (left)' },
  { action: 'Turn', keys: 'A / D or ← / →', touch: '↶ / ↷ (left)' },
  { action: 'Bow cannon', keys: 'Space', touch: 'Centre (right)' },
  {
    action: 'Port / starboard broadside',
    keys: 'Q / E',
    touch: 'Sides (right)',
  },
  { action: 'Pause', keys: 'P or Esc', touch: 'Pause button' },
]

export function MainMenu() {
  return (
    <MenuScreen
      title="Main menu"
      className="panel--menu"
      heading={
        <img
          className="title-image"
          src={uiImage('menu/title_pirate_battle')}
          alt="Pirate Battle"
        />
      }
    >
      <p className="tagline">Set sail. Take command.</p>
      <nav className="menu-actions" aria-label="Main menu">
        <button
          type="button"
          className="menu-button"
          onClick={() => {
            navigate({ name: 'play' })
          }}
        >
          Play
        </button>
        <button
          type="button"
          className="menu-button"
          onClick={() => {
            navigate({ name: 'options' })
          }}
        >
          Options
        </button>
      </nav>

      <section className="controls-guide" aria-labelledby="controls-title">
        <h2 id="controls-title">Controls</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Keyboard</th>
              <th scope="col">Touch</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map(({ action, keys, touch }) => (
              <tr key={action}>
                <th scope="row">{action}</th>
                <td>{keys}</td>
                <td>{touch}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="panel-note">
          Sink enemy ships for points and survive until time runs out.
        </p>
      </section>

      <nav
        className="menu-actions menu-actions--row"
        aria-label="Captain's log"
      >
        <button
          type="button"
          className="menu-button menu-button--secondary"
          onClick={() => {
            navigate({ name: 'log', tab: 'ranking' })
          }}
        >
          Ranking
        </button>
        <button
          type="button"
          className="menu-button menu-button--secondary"
          onClick={() => {
            navigate({ name: 'log', tab: 'history' })
          }}
        >
          Match History
        </button>
      </nav>
    </MenuScreen>
  )
}
