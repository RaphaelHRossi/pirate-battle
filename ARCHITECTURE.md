# Architecture

This document explains how Pirate Battle is put together and why: the React/PixiJS split, the simulation loop, collisions, AI, resource lifecycle, local persistence, the ranking/history integration, the mock backend and the tests. It ends with the key decisions and the balancing values that the challenge did not fix.

```
            ┌───────────────── React (src/app, src/ui) ─────────────────┐
  URL hash ─►  router → screens (menu, options, play, result, log, network)│
            │                 │ useSyncExternalStore(snapshot)            │
            │                 ▼                                           │
            │   GameView ── useGameSession ── SessionHandle               │
            └─────────────────┬────────────────────────────────────────────┘
                              │ owns
            ┌─────────────────▼──────── src/engine/GameSession ──────────┐
            │ rAF loop → FixedStepLoop → step(world, input, 1/60)        │
            │          → renderer.sync(world) → app.render()             │
            │ lifecycle, pause, listeners (AbortController), test hooks  │
            └───────┬───────────────────────┬────────────────────────────┘
          input     │                       │ reads
   src/input ──► InputIntents   src/game (pure TS)   src/render (Pixi views)
                                World + systems
   src/api (Axios, TanStack Query, outbox) ⇄ src/mocks (MSW, in the browser)
```

## React and PixiJS

- **Pixi is used imperatively**, not through `@pixi/react`. React owns the screens, the HUD and the dialogs. Pixi owns one `<canvas>` inside a host `<div>` that React never renders children into.
- **`src/game/`** is the simulation: plain TypeScript with **no imports from Pixi, React or the DOM**. A test greps for it. Every piece of match state lives in one `World` object: config, map, RNG, player, enemies, projectiles, effects, match and spawn state.
- **`src/render/`** reads the world and draws it. `GameRenderer.sync(world)` updates the display objects; it never changes game state.
- **`src/engine/GameSession.ts`** connects the two:
  - it creates the Pixi `Application`, loads the textures and builds a `Match` (`World` + `GameRenderer`)
  - it runs the loop and owns every listener
  - it is the **bridge to React**
- **`src/ui/useGameSession.ts`** mounts a session into the host `<div>` when `GameView` mounts and destroys it on unmount.

## Simulation loop

- **Fixed timestep.** `FixedStepLoop` (`src/engine/loop.ts`) adds up real frame time and runs `step(world, input, 1/60)` in whole steps. Game rules never see the frame delta.
  - The frame delta is clamped to **250 ms**, so a stall (tab switch, debugger, GC) drops time instead of fast-forwarding.
  - An `EPSILON` absorbs floating-point drift, so 60 steps always fit in one second.
- **Our own `requestAnimationFrame`, not Pixi's ticker.**
  - The app is created with `autoStart: false`. The session drives each frame: `loop.frame(now)` → steps → `renderer.sync` → `app.render()`.
  - Pixi's ticker caps its delta at 100 ms, which would silently override our 250 ms clamp.
  - Owning the frame also makes pausing exact (cancel the rAF and reset the clock) and lets tests step the very same path.
- **Step order** (`src/game/step.ts`):
  1. match clock
  2. spawning
  3. player movement
  4. enemy movement
  5. Chaser contacts
  6. ship–ship separation
  7. island and arena resolution, last so that obstacles always win
  8. player weapons, then Shooter weapons, fired from the resolved positions
  9. projectiles (move, expire, hit)
  10. effects
  11. the player-destroyed check

  Once the match has ended, `step` only advances visual effects. That single gate freezes movement, firing, damage, spawning and score.

- **Pause** stops stepping, cancels the rAF, resets the loop clock and clears input. Resuming starts from a fresh clock, so paused time is never simulated. The session pauses itself on `blur`, on `visibilitychange` (hidden), and on a touch device turned to portrait. **Resuming always needs a user action.**
- **Test hooks** (only with `?test=1`) expose `window.__pirate`. `advance(ms)` runs the same `step` and render as the real loop. `?clock=manual` keeps real time out entirely.

## Collisions

- **Hulls are two circles.** Each ship is two circles of radius 24, centred 24 px ahead of and behind its position. Together they approximate a 96×48 hull far better than one circle, and they still rotate for free (no oriented boxes).
- **Islands are axis-aligned boxes** on the 64 px tile grid, pulled in by 8 px (`ISLAND_COLLIDER_INSET`) to match the visible sand edge.
- **Ship vs island and arena** (`systems/shipCollision.ts`):
  - circle-vs-AABB push-out for both hull circles, up to **4 passes** per step
  - pushing one circle out can push the other into a neighbouring box, and the extra passes settle that; nearly every step exits after the first
  - the arena edge clamps the circles last
  - result: a ship slides along a coast instead of sticking, and never ends up inside an island
- **Ship vs ship** (`systems/separation.ts`): overlapping hull circles are pushed apart by half the overlap each. This runs _before_ obstacle resolution, so separation can never push a ship ashore.
- **Projectiles** are circles of radius 5 tested against hull circles and island boxes.
  - Tunnelling is impossible: a ball moves at most 10 px per step, while hulls are 48 px wide and islands at least 176 px.
  - Owner filtering means no ship can hit itself.
  - `applyHit` subtracts the damage and kills the projectile in one place, so a ball deals its damage exactly once.

## Enemy AI

`systems/enemies.ts` uses seek-with-avoidance steering under each ship's capped turn rate.

**Steering**

- **Seek:** turn towards the player, at most `turnSpeed × dt` per step.
- **Avoid:** three feelers (straight ahead and ±30°, 140 px long) probe for islands.
  - When one is blocked, the ship turns away at full rate.
  - The chosen direction is **kept (`avoidTurn` hysteresis)** until every feeler is clear. Without that, a ship facing a coast flips left and right every step.
  - Close to the player the feelers are ignored, so a Chaser still rams.

**Behaviour per kind**

- **Chaser:** never stops. Touching the player's hull deals 25 damage and destroys the Chaser **without scoring**; only the player's guns score.
- **Shooter:**
  - approaches until 300 px, then holds position while still turning to aim
  - fires its bow gun when the player is within 450 px, the bow points at the player within 8°, and the 2 s cooldown is ready

**Spawning** (`systems/spawning.ts`)

- **Interval:** every _spawn interval_, using the seeded RNG: 60% Chaser / 40% Shooter, and at least one Shooter in the first two spawns.
- **Cap:** max 12 alive.
- **Placement:** up to 16 seeded candidate points along the arena edges, each at least 500 px from the player and clear of islands and other ships. If none is clear, that spawn is skipped.

## Resource management and React Strict Mode

- **Textures are loaded once** per page by `loadGameAssets` (`src/render/assets.ts`) and cached in Pixi `Assets`.
  - Each asset is loaded on its own, not as a bundle, so a Retry after a failure refetches only what failed. Progress is reported per asset.
  - **Textures are never destroyed** on restart or when leaving a match.
- **Display objects are per match.** Restarting destroys the `GameRenderer` (and its children) and builds a fresh `World` and renderer; leaving destroys the whole `Application` with its children.
- **Pools** are pre-allocated per match (96 projectiles, 48 effects, 12 enemies), with one sprite per slot, so a match allocates nothing per frame. Dead slots are reused, closest to expiry first when full.
- **One `AbortController` per session** is the signal for every listener (keyboard, blur, visibility, orientation, resize). A nested one exists only while gameplay is active. `destroy()` aborts it, cancels the rAF, uninstalls the test hooks and destroys the app.
- **Strict Mode:** React mounts, unmounts and mounts effects again in development. Each effect run creates its own `GameSession`.
  - `start()` is async (`app.init`, asset loading) and checks a `disposed` flag after every `await`.
  - A session destroyed during `init` destroys its app as soon as `init` returns, because Pixi cannot be destroyed mid-init.
  - A stable `SessionHandle` (created in a `useState` initializer) re-points React at whichever session is current.
- **Evidence:** the memory profile (docs/PERFORMANCE.md) shows 0 canvases, 0 WebGL contexts and a constant texture cache after five start → play → leave cycles.

## The snapshot bridge (React never renders per frame)

- **The snapshot.** `GameSession` publishes a frozen `GameSnapshot` with only what React shows: status, load %, hp, maxHp, score, whole seconds left, end reason and `resultReady`.
- **Publishing.** After every step, `publish()` builds the candidate values. It **replaces the snapshot only if a field changed** (`sameSnapshot`), then notifies the subscribers.
- **Reading.** React reads it with `useSyncExternalStore(subscribe, getSnapshot)`, which compares by reference. A step that changes nothing allocates nothing and renders nothing.
- **Result:** about one React render per second (the timer) plus one per hit or kill. A test counts the renders over 5 s of play.
- **Announcements.** The live region (`Announcer`) derives _events_ from snapshot changes (pause, resume, 30 s / 10 s left, low health, match over) and never announces the ticking clock. The `?perf=1` overlay writes to the DOM on a timer for the same reason.

## Routing and abandonment

`src/app/router.ts` is a tiny hash router: `useSyncExternalStore` on `hashchange`, with the raw hash string as the snapshot, so it compares by value.

**Routes:** `#/`, `#/options`, `#/play`, `#/result`, `#/log`, `#/log/history`, `#/network`. Unknown hashes are replaced by `#/`.

- **A refresh keeps the screen.** Back and Forward work, and the static host needs no rewrites.
- **`#/play` mounts `GameView`**, which creates a session; leaving the route unmounts it and destroys the session. A refresh on `#/play` therefore starts a **new** match.
- **Only a completed match produces a result.** On the step the match ends, the session builds a `MatchResult` once (client UUID, score, duration, end reason, the options used) and calls `onMatchEnd`. That saves it and queues it in the outbox.
- **Abandoning leaves no trace.** A session destroyed mid-match (Main Menu in the pause dialog, Back, a refresh) never reaches that code.
- **Moving on to the result.** After `resultDelaySeconds` (2.5 s of game time, so the final explosion is visible), `resultReady` flips. `GameView` then **replaces** `#/play` with `#/result`, so Back cannot start another match.

## Local persistence

Every localStorage key starts with `pirate-battle:` and holds versioned JSON.

- **Reads:** everything is validated with **Zod** on read. Missing, corrupt, out-of-range or old-version data counts as absent, so the caller falls back to its default.
- **Errors:** storage exceptions (private mode, quota) are caught.

| Key           | Module                  | Content                                                               |
| ------------- | ----------------------- | --------------------------------------------------------------------- |
| `options`     | `storage/options.ts`    | session and spawn time, validated against `MATCH_OPTION_LIMITS`       |
| `last-result` | `storage/lastResult.ts` | the last completed `MatchResult`, shown by `#/result` after a refresh |
| `player`      | `storage/player.ts`     | player UUID and generated captain name                                |
| `outbox`      | `api/outbox.ts`         | match records not yet confirmed by the server                         |
| `mock-db`     | `mocks/db.ts`           | the mock server's confirmed records                                   |
| `scenario`    | `mocks/scenarios.ts`    | selected network scenario and jitter seed                             |
| `perf-report` | `storage/perfReport.ts` | last `?perf=1` report                                                 |

## Ranking and match history

### Contracts

`src/api/contracts.ts` holds the Zod schemas and inferred types. **The app and the MSW handlers share the same definitions**: the app validates every response, and the handlers validate every request.

| Type           | Fields                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| `MatchRecord`  | `matchId`, `playerId`, `playerName`, `playedAt`, `score`, `durationMs`, `endReason`, `config` |
| `MatchConfig`  | `sessionSeconds`, `spawnSeconds`                                                              |
| `RankingEntry` | the ranked record plus its `rank`                                                             |
| `Page<T>`      | `items`, `page`, `pageSize`, `totalItems`, `totalPages`                                       |

`configKey(config)` gives `120s-3s`: the ranking only compares matches with the same options.

| Endpoint                                           | Behaviour                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/ranking?configKey&page&pageSize`         | One entry per match of that config, ordered **score desc → durationMs desc → playedAt asc → matchId asc** (`compareRanking`, shared) |
| `GET /api/players/:playerId/matches?page&pageSize` | The player's matches, newest first                                                                                                   |
| `PUT /api/matches/:matchId`                        | **Idempotent upsert**: 201 created; 200 if the same record already exists; 409 if that id holds different data                       |

### HTTP and errors

`src/api/http.ts` is an Axios instance (`baseURL: /api`, **5 s timeout**). Its interceptor turns every failure into `ApiError { kind: 'timeout' | 'network' | 'http', status? }`. Cancellations pass through untouched.

### Queries (TanStack Query v5)

- **Keys:** `['ranking', configKey, page]` and `['history', playerId, page]`. TanStack's `signal` is passed to Axios.
- **Caching and refresh:** `staleTime` is 30 s. `refetchOnMount: 'always'` refreshes a tab in the background every time it is shown, and the window-focus refetch is on.
- **`placeholderData: keepPreviousData`** keeps the previous page on screen (dimmed, `aria-busy`) while the next one loads.
- **Retries:** only for timeout, network and 5xx; at most 2, with backoff of 0.5 s, 1 s, … capped at 4 s. A 4xx is never retried.

### Registration and the outbox

1. **Write first.** When a match ends, `recordCompletedMatch` writes the result and appends the record to the **outbox**, synchronously and before any request exists. A crash, a refresh or a closed tab right after the end loses nothing.
2. **Send.** The save mutation is defined once with `queryClient.setMutationDefaults(['saveMatch'], …)`, so it keeps running when the screen that started it unmounts (the player can start another match). Its `onSuccess` **removes the record from the outbox** and **invalidates both `ranking` and `history`**.
3. **Retry.** `<RegistrationSync>` is always mounted. It sends every outbox record on app start, whenever a record is added, and each time the player returns to the main menu. `useSendMatch` skips a record that already has a save in flight. The result screen shows Saving / Saved / Not saved, with a Retry.
4. **Never duplicated.** The `matchId` is created on the client once, and the PUT is an idempotent upsert. A retry after a timeout, a double click or a re-flush after a refresh all converge on one record. Mutations retry automatically for exactly that reason.

### Stale responses

- **A late answer can only land in its own slot.** Every page has its own cache key, so a slow answer for page 2 is stored under page 2 and can never replace what page 3 shows.
- **Unwanted requests are cancelled.** A query left behind loses its observer and TanStack aborts its request through the signal.
- **Saves refresh what is on screen.** `invalidateQueries` cancels any refetch in flight and starts a new one, so a response requested before a save never overwrites data fetched after it.

## Mock backend (MSW v2)

- **It runs in every build, production included.** `src/main.tsx` starts the worker before React renders, with `onUnhandledRequest: 'bypass'`.
- **Handlers** (`src/mocks/handlers.ts`) read the confirmed records from the mock DB in localStorage, plus code **fixtures**: 14 rival captains generated from a fixed seed, across 4 configs, with 4 pages of 5 for the default one.
- **Scenarios** (`src/mocks/scenarios.ts`) are applied at the start of every handler and are read per request, so a change in the Network panel takes effect immediately.
  - Delays and failures are deterministic. `out-of-order` counts requests per endpoint; `jitter` uses the seeded RNG with `?netSeed=`.
  - `save-timeout-after-commit` is special: it **inserts first** and then never answers, which models a lost response.
- **Reset** clears the mock DB, outbox, last result and scenario, then reloads.

## Testing strategy

All tests are Playwright end-to-end tests against the **production build**, in desktop and mobile Chromium. The coverage table is in [docs/TESTING.md](docs/TESTING.md).

- **Deterministic games:** `?test=1` with `?seed=`, `?clock=manual`, `?spawn=off` and `?fixture=`. Tests step game time with `advance(ms)` through the real step and render.
- **Real input:** combat is driven by real key presses and CDP multi-touch. The test API only observes state and controls the clock.
- **Isolation:** a fresh browser context per test (empty storage and Service Worker), a console-error guard on every test, and scenarios selected by URL.
- **Other checks:** axe-core accessibility checks; screenshot baselines per OS; mutation checks during development to prove the key tests fail when the protected code is removed.

## Key decisions

| Decision                                            | Why                                                                                                                                                                                                                                                          | Alternatives considered                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **One fixed map**                                   | The ranking compares like with like (same islands for everyone), and tests can place ships next to known coasts                                                                                                                                              | Random or procedural islands (unfair ranking, harder tests); several maps (would need the map in `configKey`) |
| **Only the 1× ship art is loaded**                  | The "retina" files are **not 2×**: `png/retina/ships/ship_1.png` is 66×113, like the default one, and both ship sheets are 1024×512. Loading them would double downloads for no extra detail. `resolution = min(devicePixelRatio, 2)` keeps the canvas sharp | Pixi `@2x` resolution switching (would claim a density the art does not have)                                 |
| **The pause dialog has no Options**                 | Options is its own screen; going there leaves `#/play`, which by definition abandons the match. A Resume / Main Menu dialog is honest about that ("Leaving ends this match without recording it")                                                            | An Options overlay inside the match (options apply to the next match anyway)                                  |
| **MSW v2 in production**                            | The challenge requires the deployed site to run the mocks; MSW intercepts at the network layer, so Axios, TanStack Query and the error handling run exactly as against a real API                                                                            | A fake client layer (would skip HTTP, timeouts and retries); a hosted mock server (a private service)         |
| **Playwright `workers: 2`**                         | Each worker is a Chromium with a WebGL context; six in parallel ran out of memory on the development machine. Override with `--workers`                                                                                                                      | Default workers (flaky), serial (slow)                                                                        |
| **Ranking tie-break: score → duration → date → id** | More points first; at equal points, the longer survival; then whoever got there first; the match id makes the order total and deterministic                                                                                                                  | Score only (unstable order), date first (rewards nothing)                                                     |
| **Own rAF loop**                                    | Exact pause and a 250 ms clamp; the Pixi ticker caps at 100 ms                                                                                                                                                                                               | Pixi `Ticker`                                                                                                 |
| **Imperative Pixi**                                 | Full control of creation, pooling and destruction; React never touches per-frame objects                                                                                                                                                                     | `@pixi/react` (reconciles the scene graph through React)                                                      |
| **Hash router, no library**                         | Five routes, refresh-safe on any static host, about 80 lines                                                                                                                                                                                                 | React Router (more than needed)                                                                               |
| **Outbox + idempotent PUT**                         | No lost or duplicated match under any failure                                                                                                                                                                                                                | Fire-and-forget POST (loses or duplicates on timeouts)                                                        |
| **Two-circle hulls + AABB islands**                 | Cheap, rotation-free and good enough for a 96×48 hull on a tile grid                                                                                                                                                                                         | Oriented boxes / SAT (more code for little visible gain)                                                      |

## Balancing

- **Where the numbers come from:** the challenge sets most of them. They are kept exactly as given; see the README table.
- **Intent:** the player is faster and turns faster than either enemy, so positioning and broadsides are the skill. Chasers punish standing still; Shooters punish staying at range in their line of fire.
- **Session and spawn options** are limited to 60–180 s and 1–10 s. At 1 s the 12-ship cap fills in 12 s; above 10 s a short match has almost no enemies.

Every value **not given by the challenge**, all in `src/game/config.ts` unless noted:

| Value                         | Setting                               | Rationale                                                                                                           |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Hull circles                  | radius 24, offset ±24 (all ships)     | Covers the 66×113 sprite's visible hull without a gap at the waist (22/30 left one)                                 |
| Broadside spacing             | 24 px between the 3 balls             | Spread along the hull side, within the ship's length                                                                |
| Projectile radius             | 5 px                                  | Matches the 10 px cannonball sprite                                                                                 |
| Projectile pool               | 96                                    | Worst case is about 25 alive (player + 12 Shooters); never runs out                                                 |
| Effect pool                   | 48                                    | Flashes, explosions and wrecks of a busy fight                                                                      |
| Muzzle flash                  | 0.12 s                                | Readable, not distracting                                                                                           |
| Explosion                     | 0.6 s                                 | Three frames, readable at speed                                                                                     |
| Wreck fade                    | 1.5 s                                 | Sinking is visible but does not clutter                                                                             |
| Hit flash                     | 0.15 s                                | Clear damage feedback                                                                                               |
| Shooter gun                   | 400 px/s, 1.25 s ttl (reaches 500 px) | A little beyond its 450 px firing range, and slower than the player's balls, so it can be dodged                    |
| Shooter aim tolerance         | 8°                                    | About a hull's width at firing range                                                                                |
| AI feelers                    | 140 px, ±30°                          | Ships turn away from a coast in time at their speed and turn rate                                                   |
| Spawn edge margin             | 70 px                                 | A 96 px hull fits inside the arena at spawn                                                                         |
| Spawn attempts                | 16 per spawn                          | Almost always finds a clear point; if not, that spawn is skipped rather than placed badly                           |
| Island collider inset         | 8 px (`map.ts`)                       | Matches the visible sand edge and rounded corners                                                                   |
| Player spawn clearance        | 300 px from any coast (`map.ts`)      | The player never starts beside an island                                                                            |
| Collision passes              | 4 (`shipCollision.ts`)                | Settles a hull between two boxes                                                                                    |
| Result delay                  | 2.5 s of game time                    | The final explosion plays out before the result screen                                                              |
| Damage stages / health colour | above 2/3, 1/3 to 2/3, below 1/3      | Ship art has three damaged stages; the same thresholds colour the HUD bar and trigger the "Low health" announcement |
| Score                         | 1 per enemy sunk by the player's guns | Chaser rams and other causes score nothing                                                                          |
