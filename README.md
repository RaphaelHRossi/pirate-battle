# Pirate Battle

A top-down 2D naval shooter built with **React + TypeScript + PixiJS v8**. Sail between islands, sink Chasers and Shooters with your bow cannon and broadsides, and survive until the timer runs out. Every completed match is registered in a mock ranking and history served by **MSW**, through **TanStack Query** and **Axios**.

**Play it:** <https://pirate-battle-lake.vercel.app>

|                      |                                            |
| -------------------- | ------------------------------------------ |
| Architecture         | [ARCHITECTURE.md](ARCHITECTURE.md)         |
| Tests                | [docs/TESTING.md](docs/TESTING.md)         |
| Performance          | [docs/PERFORMANCE.md](docs/PERFORMANCE.md) |
| Credits and licences | [CREDITS.md](CREDITS.md)                   |
| Challenge spec       | [docs/CHALLENGE.md](docs/CHALLENGE.md)     |

## Features

**Combat**

- **Simulation:** a fixed-timestep simulation (60 steps/s), independent of the frame rate.
- **The player's ship:** movement, rotation, a bow cannon, two broadsides with their own cooldowns, and damage stages with health bars.
- **The arena:** islands with two-circle hull collision against the arena edge and the islands.
- **Enemies:** Chasers ram you and explode. Shooters keep their distance and fire when aimed. Enemies spawn on an interval, away from you and the islands.
- **Match end:** by time or by sinking. The simulation freezes, the final explosion plays out, and then the result screen opens.
- **Pause:** P, Esc or the HUD button. The game also pauses itself when the window loses focus, the tab is hidden, or a phone is turned to portrait.

**Interface and accessibility**

- **Screens:** main menu, Options, the Captain's Log (Ranking and Match History tabs), the result screen and a Network panel. All are hash-routed, so a refresh keeps the screen.
- **Accessibility:** keyboard-only navigation and visible focus; the pause dialog manages focus; error messages are announced; the HUD exposes health, score and time as text, with events read out by a polite live region.
- **Touch:** controls on touch screens. Mobile is landscape-only.

**Data**

- **Saved locally:** options, the last result, the player id and pending match records, all validated with Zod.
- **Ranking and history:** an idempotent `PUT` per match, a persistent outbox that survives failures and refreshes, and retries without duplicates.

## Setup (from a clean checkout)

Requirements: **Node.js 22 LTS or newer** (developed with Node 24.21) and npm.

```sh
git clone https://github.com/RaphaelHRossi/pirate-battle.git
cd pirate-battle
npm ci
npm run dev                         # http://localhost:5173
```

Production build and local preview (this is what is deployed and tested):

```sh
npm run build
npm run preview                     # http://localhost:4173
```

For the end-to-end tests, install Playwright's Chromium once:

```sh
npx playwright install chromium     # add --with-deps on a fresh Linux machine
npm run test:e2e
```

### Environment variables

**None are required, and there are no optional ones**, so there is no `.env.example`.

- The mock API (MSW) runs in the browser in every build, including production, so no backend or private service is involved.
- The only build-time value is Vite's base path. It defaults to `/`, which suits the Vercel deployment.

### Deployment

The site is a static build (`dist/`) on Vercel: build command `npm run build`, output directory `dist`.

- **No rewrites:** routing uses the URL hash (`#/options`), so reloading any screen works without server rules.
- **The MSW Service Worker** (`public/mockServiceWorker.js`) is served from the site root.

## Controls

| Action                     | Keyboard                                     | Touch (bottom of the screen)         |
| -------------------------- | -------------------------------------------- | ------------------------------------ |
| Sail forward               | **W** or **↑**                               | ↑ (left cluster, top)                |
| Turn left / right          | **A** / **D** or **←** / **→**               | ↶ / ↷ (left cluster)                 |
| Bow cannon                 | **Space**                                    | centre button (right cluster, top)   |
| Port / starboard broadside | **Q** / **E**                                | left / right buttons (right cluster) |
| Pause / resume             | **P** or **Esc** (Esc or Resume to continue) | ⏸ button, top right                  |

Notes:

- **Keys combine freely.** Holding a fire key keeps firing at the cooldown rate.
- **Game keys are only captured while a match is being played.** They are released on menus, while paused and after the match.
- **Touch controls** appear on touch (coarse-pointer) screens and support several fingers at once. In portrait, a "Rotate your device" overlay appears and the match pauses.
- **Menus** are fully keyboard-operable. Tab moves between controls; the arrow keys and Home / End move within the Ranking / Match History tabs.

## Gameplay configuration

Every balancing value lives in one typed object, `DEFAULT_GAME_CONFIG` in [`src/game/config.ts`](src/game/config.ts). Changing balance needs no change to game logic. Each match runs on a frozen copy of the config taken when it starts.

The **Options** screen exposes two values, saved in localStorage and applied to the **next** match:

| Option            | Default | Allowed values           |
| ----------------- | ------- | ------------------------ |
| Game session time | 120 s   | 60–180 s, in steps of 10 |
| Enemy spawn time  | 3 s     | 1–10 s, in steps of 0.5  |

**Invalid values are refused:** typed values are checked as you type, and the −/+ buttons always produce a valid one. Saved values are re-validated on load, so a tampered value falls back to the default.

Main defaults (from the challenge):

|            |                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Player     | 100 hp, 180 px/s, 150 °/s turn                                                                        |
| Bow cannon | 20 dmg, 600 px/s, 1.0 s range, 0.4 s cooldown                                                         |
| Broadsides | 3 balls × 15 dmg, 520 px/s, 0.8 s range, 1.5 s cooldown per side                                      |
| Chaser     | 40 hp, 150 px/s, 120 °/s, 25 contact damage (explodes, no score)                                      |
| Shooter    | 60 hp, 110 px/s, 90 °/s, fires within 450 px, stops at 300 px, 10 dmg every 2 s                       |
| Spawning   | 60% Chaser / 40% Shooter, a Shooter within the first 2 spawns, max 12 alive, ≥ 500 px from the player |
| Score      | 1 point per enemy sunk by your guns                                                                   |

Values that the challenge does not specify, and why they were chosen, are listed in [ARCHITECTURE.md → Balancing](ARCHITECTURE.md#balancing).

## Ranking, history and network scenarios

- **Players:** each browser is one player, with a random id and a generated captain name.
- **Saving matches:** a completed match is written to a local outbox first, then sent with `PUT /api/matches/:matchId`. The result screen shows **Saving… / Saved / Not saved + Retry**.
- **The ranking** compares matches with the same options ("120 second battles · 3 second spawn interval").

### Choosing a scenario

The mock server can simulate network conditions. Pick a scenario in either of two ways:

- **In the URL:** `?scenario=<name>` (for example <https://pirate-battle-lake.vercel.app/?scenario=slow#/log>). The choice is saved, so it survives reloads.
- **In the Network panel:** main menu → **Network settings** (`#/network`). The change applies to the next request.

`jitter` is seeded: add `&netSeed=<number>` for a reproducible sequence of delays.

| Scenario                    | What happens                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `success`                   | Everything works, with ~150 ms latency (default)                                        |
| `empty`                     | Ranking and history return empty lists                                                  |
| `slow`                      | Every response takes 2 s                                                                |
| `jitter`                    | Latency varies between 0.1 and 1.5 s (seeded by `?netSeed=`)                            |
| `out-of-order`              | Each list response takes longer than the next one requested (1.8 s, 1.2 s, 0.6 s, …)    |
| `timeout`                   | Requests never answer; the client gives up after 5 s                                    |
| `offline`                   | Connection failure, no response                                                         |
| `server-error`              | Every request fails with 500                                                            |
| `bad-request`               | Every request fails with 400 (never retried)                                            |
| `ranking-fail`              | Only the ranking fails (500)                                                            |
| `history-fail`              | Only the match history fails (500)                                                      |
| `save-timeout-after-commit` | A save is recorded, but its first answer is lost; the retry gets 200, with no duplicate |
| `save-unavailable`          | Saving fails with 503 and records nothing                                               |

### Resetting

**Network panel → Reset** clears four things:

- the mock database (your recorded matches)
- the outbox (pending saves)
- the last result
- the selected scenario

It then reloads on the menu without `?scenario=`. Options and your player id are kept. The rivals in the ranking are fixtures in code, so they always remain.

### Reproducing each failure

Unless stated otherwise, finish a match by playing it out. Setting the session time to 60 s in Options makes this quicker.

| To see                          | Do                                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading state                   | Open `/?scenario=slow#/log`                                                                                                                                                                                            |
| Empty lists                     | Open `/?scenario=empty#/log`, then switch tabs                                                                                                                                                                         |
| Query error + Retry             | Open `/?scenario=ranking-fail#/log` (after the automatic retries, about 2 s); pick `success` in the Network panel; press **Retry**                                                                                     |
| History error only              | Open `/?scenario=history-fail#/log/history`; the Ranking tab still works                                                                                                                                               |
| Timeout                         | Open `/?scenario=timeout#/log`; the error appears after 3 × 5 s plus backoff                                                                                                                                           |
| Late answers never win          | Open `/?scenario=out-of-order#/log`, then click **Next page** twice quickly; page 3 stays on screen                                                                                                                    |
| Save timeout without duplicates | Play with `?scenario=save-timeout-after-commit`. The result shows **Saving…** for about 5 s, then **Saved**; Match History has exactly one row                                                                         |
| Save unavailable, then recovery | Play with `?scenario=save-unavailable`. The result shows **Not saved**. Reload: the match is still pending. Choose `success` in the Network panel and go back to the menu (or press **Retry**); the match is sent once |
| Playing while a save is pending | With `save-unavailable`, press **Play Again** on the result screen: nothing blocks the game                                                                                                                            |
| Repeated PUT                    | In the browser console after a saved match, `PUT` the same record again → 200; with a different score → 409                                                                                                            |

## npm scripts

| Script                            | What it does                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server with hot reload                                               |
| `npm run build`                   | Type-check (`tsc -b`) and production build to `dist/`                         |
| `npm run preview`                 | Serve the production build on port 4173                                       |
| `npm run typecheck`               | TypeScript in strict mode, no emit                                            |
| `npm run lint`                    | ESLint (type-checked rules, React Hooks), zero warnings allowed               |
| `npm run format` / `format:check` | Prettier write / check                                                        |
| `npm run test:e2e`                | All Playwright tests (desktop + mobile Chromium) against the production build |
| `npm run test:e2e:ui`             | Playwright's interactive runner                                               |
| `npm run test:e2e:report`         | Open the last HTML report (`reports/playwright`)                              |
| `npm run test:visual`             | Screenshot comparisons only                                                   |
| `npm run test:visual:update`      | Rewrite the screenshot baselines for this OS                                  |
| `npm run perf:memory`             | Build, then run the 5-cycle memory profile → `docs/perf/memory.json`          |
| `npm run atlas`                   | Regenerate the Pixi JSON atlas from the Starling XML spritesheet              |

## Test and debug parameters

URL parameters, read when the page loads:

| Parameter                  | Effect                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?test=1`                  | Test mode: exposes `window.__pirate` (`getState`, `pauseClock`, `resumeClock`, `advance(ms)`, `restart`, `getRenderStats`). The parameters below marked _test_ only work with it |
| `?seed=<n or text>`        | Fixed random seed (spawns, AI choices)                                                                                                                                           |
| `?spawn=off`               | _test_ — no enemies spawn on their own                                                                                                                                           |
| `?fixture=<name>`          | _test_ — named start state: `island-ahead`, `island-glancing`, `incoming-shot`, `chaser-ahead`, `chaser-behind-island`, `shooter-far`                                            |
| `?clock=manual`            | _test_ — real time does not move the game; only `__pirate.advance(ms)` does, through the real step and render                                                                    |
| `?debug=1`                 | Draw island colliders, hull circles and projectile circles                                                                                                                       |
| `?perf=1`                  | Record frame times and offer a JSON performance report on the result screen (see [PERFORMANCE.md](docs/PERFORMANCE.md))                                                          |
| `?scenario=` / `?netSeed=` | Mock network scenario, see above                                                                                                                                                 |

Examples:

- `/?test=1&seed=7&clock=manual&spawn=off#/play` starts a frozen, empty arena.
- `/?debug=1#/play` shows the colliders.

Playwright options:

- `npx playwright test --workers=4` overrides the default of 2 workers. Each worker runs its own Chromium with a WebGL context, so more than a couple can exhaust memory on modest machines.
- `--project=desktop-chromium` (or `mobile-chromium`) runs one project.
- `--headed` shows the browser.

## Test reports and visual baselines

- **HTML report:** each run writes it to `reports/playwright/`, and it is committed. Traces of failed tests are embedded; open it with `npm run test:e2e:report`.
- **Visual baselines:** they live in `tests/visual/__screenshots__/`, one per screen, project and OS. **Windows** baselines are committed.
- **Linux baselines:** they come from the manual GitHub Actions workflow **Update visual baselines** (`.github/workflows/update-visual-baselines.yml`). Go to Actions → _Update visual baselines_ → _Run workflow_ on `main`, or run `gh workflow run update-visual-baselines.yml --ref main`. It commits the `*-linux.png` files back to `main`. Until then, the visual tests are skipped on Linux with a note.

See [docs/TESTING.md](docs/TESTING.md) for the coverage table.

## Project layout

```
src/
  app/      App, hash router, outbox sync
  game/     pure simulation: config, world, rng, math, map, collision, systems/, step.ts
  engine/   GameSession (loop, lifecycle, React bridge), fixed-step loop, test hooks, perf recorder
  render/   Pixi renderer, asset loading, views/
  input/    intent tracker, keyboard, touch controls
  ui/       React screens and components
  api/      contracts (Zod), Axios client, endpoints, TanStack Query, outbox
  mocks/    MSW worker, handlers, mock DB, fixtures, scenarios
  storage/  localStorage modules (Zod-validated)
tests/      e2e/, visual/, helpers/
scripts/    atlas converter, memory profiling
docs/       CHALLENGE.md, TESTING.md, PERFORMANCE.md, perf/
```

## Known limitations

- **No sound.** The WAV effects are in `public/assets/sounds` but are not played.
- **One fixed map.** It keeps the ranking fair and the tests deterministic.
- **Mobile is landscape-only**, and touch controls only appear on coarse-pointer devices.
- **No player name entry:** each browser gets a generated captain name.
- **The mock backend runs in the browser.** The "server" data is per browser (localStorage), not shared between players; rivals are fixtures.
- **Linux visual baselines** have to be generated by the workflow above. Until then, the visual tests are skipped on Linux.
- **Tested in Chromium only** (desktop and mobile emulation), as the challenge requires; other browsers were not tested.
- **The three-minute FPS figures** in PERFORMANCE.md are a manual measurement.
