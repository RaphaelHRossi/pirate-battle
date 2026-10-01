# Testing

All tests are Playwright end-to-end tests. They run against the production build (`vite build && vite preview`, MSW included) in two Chromium projects: **desktop-chromium** (Desktop Chrome) and **mobile-chromium** (Pixel 7, landscape, touch).

```sh
npm run test:e2e          # whole suite, both projects
npm run test:e2e:ui       # interactive runner
npm run test:e2e:report   # open the last HTML report (reports/playwright)
npm run test:visual       # screenshot comparisons only
npm run test:visual:update  # rewrite the screenshot baselines
```

## Reproducibility

- **State:** every test gets a fresh browser context, so localStorage, the mock DB, the outbox and the Service Worker all start empty.
- **Test parameters** (honoured only with `?test=1`):
  - `?seed=` fixes the random number generator
  - `?clock=manual` stops real time; tests advance the simulation with `window.__pirate.advance(ms)`, which runs the same `step` and render as the real loop
  - `?spawn=off` disables spawning
  - `?fixture=` sets a named start state
- **Network:** `?scenario=` (with `?netSeed=` for jitter) selects the simulated network.
- **Real controls:** combat tests press real keys (or real touch points through the DevTools Protocol) and check the effects on the game state.
- **Console guard:** a test fails on any console error or uncaught exception (`tests/helpers/test.ts`). The only exception is the browser's own "Failed to load resource" line, which is allowed in tests that simulate failed requests.

## Coverage of the required groups (CHALLENGE.md §8)

| #   | Requirement                                                           | Specs                                                                    |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Options: navigation, validation, persistence                          | `options.spec.ts`, `a11y.spec.ts` (keyboard)                             |
| 2   | Asset loading, failure and retry                                      | `loading.spec.ts`                                                        |
| 3   | Start, movement, rotation, arena bounds, islands                      | `smoke.spec.ts`, `movement.spec.ts`, `island.spec.ts`                    |
| 4   | Front and side fire, damage, cooldown, score without duplicates       | `weapons.spec.ts`, `enemies.spec.ts` (one point per kill), `hud.spec.ts` |
| 5   | Chaser and Shooter behaviour, spawn interval                          | `enemies.spec.ts`                                                        |
| 6   | End by time and by death, frozen simulation, clean restart            | `match.spec.ts`                                                          |
| 7   | Pause, focus loss, resume without the timer jumping                   | `pause.spec.ts`                                                          |
| 8   | Result shown and persisted after refresh                              | `result.spec.ts`                                                         |
| 9   | Abandoning a match, repeated navigation, touch controls               | `result.spec.ts`, `navigation.spec.ts`, `touch.spec.ts`                  |
| 10  | Ranking and history: queries, pagination, loading, empty, error       | `log.spec.ts`                                                            |
| 11  | Registration, both tabs updated, pending save recovered after refresh | `registration.spec.ts`, `network.spec.ts` (Reset)                        |
| 12  | Resend after timeout without duplicates; late responses never win     | `registration.spec.ts`, `log.spec.ts` (out-of-order)                     |
| —   | Visual regression: menu, arena, result                                | `tests/visual/screens.spec.ts`                                           |
| —   | Accessibility (axe, keyboard, focus, HUD semantics)                   | `a11y.spec.ts`                                                           |
| —   | Game keys captured only during gameplay                               | `navigation.spec.ts`                                                     |

## Visual regression baselines

Baselines live in `tests/visual/__screenshots__/`, one per screen, project and OS, e.g. `menu-desktop-chromium-win32.png`.

- **Why per OS:** fonts and anti-aliasing differ between operating systems, so a run only compares against its own platform's baselines.
- **Missing baselines:** if a platform has none, the visual tests are **skipped** with a note instead of failing.
- **Tolerance:** `maxDiffPixelRatio: 0.01` (up to 1 % of pixels may differ). CSS animations are disabled and the caret is hidden.

The committed baselines are for **Windows** (`-win32`). To create or update the **Linux** ones, use the official Playwright image. Its version must match `@playwright/test` in `package.json`:

```sh
docker run --rm -it -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c "npm ci && npm run test:visual:update"
```

After an intended UI change, run `npm run test:visual:update` on each platform and review the image diffs before committing them.

## Reports and traces

- **HTML report:** written to `reports/playwright/` and committed with the repository.
- **Traces:** kept only for failed tests (`trace: 'retain-on-failure'`) and embedded in the report.
- **Raw output:** per-test output goes to `reports/test-results/`, which is git-ignored.
