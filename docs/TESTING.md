# Testing

All tests are Playwright end-to-end tests. They run against the production build (`vite build && vite preview`, MSW included) in two Chromium projects: **desktop-chromium** (Desktop Chrome) and **mobile-chromium** (Pixel 7, landscape, touch).

A third project, **dev-strict-mode**, runs `tests/dev/` against the Vite dev server (port 5173). React Strict Mode only double-mounts in development, and that test checks the game survives it. Playwright starts both servers itself.

The requirement-by-requirement audit is in [COMPLIANCE.md](COMPLIANCE.md).

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

| #   | Requirement                                                           | Specs                                                                                                                                                                          |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Options: navigation, validation, persistence                          | `options.spec.ts`, `a11y.spec.ts` (keyboard)                                                                                                                                   |
| 2   | Asset loading, failure and retry                                      | `loading.spec.ts`                                                                                                                                                              |
| 3   | Start, movement, rotation, arena bounds, islands                      | `smoke.spec.ts`, `movement.spec.ts`, `island.spec.ts`                                                                                                                          |
| 4   | Front and side fire, damage, cooldown, score without duplicates       | `weapons.spec.ts` (incl. leaving the arena), `enemies.spec.ts` (one point per kill, Shooter cooldown), `hud.spec.ts`, `feedback.spec.ts` (effects, health bars, damage stages) |
| 5   | Chaser and Shooter behaviour, spawn interval                          | `enemies.spec.ts` (both types take damage and respect islands; destroyed enemies stop acting)                                                                                  |
| 6   | End by time and by death, frozen simulation, clean restart            | `match.spec.ts`                                                                                                                                                                |
| 7   | Pause, focus loss, resume without the timer jumping                   | `pause.spec.ts` (incl. keys pressed while paused)                                                                                                                              |
| 8   | Result shown and persisted after refresh                              | `result.spec.ts`                                                                                                                                                               |
| 9   | Abandoning a match, repeated navigation, touch controls               | `result.spec.ts`, `navigation.spec.ts`, `touch.spec.ts`                                                                                                                        |
| 10  | Ranking and history: queries, pagination, loading, empty, error       | `log.spec.ts` (incl. retries, cache, background refresh, timeout / offline / 4xx / 5xx)                                                                                        |
| 11  | Registration, both tabs updated, pending save recovered after refresh | `registration.spec.ts`, `network.spec.ts` (Reset)                                                                                                                              |
| 12  | Resend after timeout without duplicates; late responses never win     | `registration.spec.ts`, `log.spec.ts` (out-of-order)                                                                                                                           |
| —   | Visual regression: menu, arena, result                                | `tests/visual/screens.spec.ts`                                                                                                                                                 |
| —   | Accessibility (axe, keyboard, focus, HUD semantics)                   | `a11y.spec.ts`                                                                                                                                                                 |
| —   | Game keys captured only during gameplay                               | `navigation.spec.ts`                                                                                                                                                           |
| —   | Frame-rate independence                                               | `simulation.spec.ts`                                                                                                                                                           |
| —   | Canvas fit, pixel density, resizing, no clipping                      | `layout.spec.ts`                                                                                                                                                               |
| —   | React Strict Mode mount / unmount (dev server)                        | `tests/dev/strict-mode.spec.ts` (project `dev-strict-mode`)                                                                                                                    |
| —   | API failures never block options or play                              | `network.spec.ts`                                                                                                                                                              |
| —   | `?perf=1` recorder; the `stress` profiling fixture                    | `perf.spec.ts`                                                                                                                                                                 |

## Visual regression baselines

Baselines live in `tests/visual/__screenshots__/`, one per screen, project and OS, e.g. `menu-desktop-chromium-win32.png`.

- **Why per OS:** fonts and anti-aliasing differ between operating systems, so a run only compares against its own platform's baselines.
- **Missing baselines:** if a platform has none, the visual tests are **skipped** with a note instead of failing.
- **Tolerance:** `maxDiffPixelRatio: 0.01` (up to 1 % of pixels may differ). CSS animations are disabled and the caret is hidden.

The baselines are made on **Windows** (`-win32`) and on **Linux** (`-linux`). The Linux ones are generated by a GitHub Actions workflow, so nobody needs Docker locally.

### Generating the Linux baselines (GitHub Actions)

`.github/workflows/update-visual-baselines.yml` runs only when triggered by hand:

1. On GitHub, open **Actions** → **Update visual baselines**.
2. Click **Run workflow**, keep the branch on **main**, and confirm.
3. The job runs the visual tests with `--update-snapshots` in the official image `mcr.microsoft.com/playwright:v1.63.0-noble`. It then commits any new or changed `*-linux.png` files to `main` as `github-actions[bot]`, with the message `test: add Linux visual baselines`. If nothing changed, it commits nothing.
4. Pull `main` and review the new images.

Or from a terminal with the GitHub CLI: `gh workflow run update-visual-baselines.yml --ref main`.

The image tag must match the `@playwright/test` version in `package-lock.json`. When Playwright is upgraded, update the tag in the workflow too.

The same image works locally if Docker is available:

```sh
docker run --rm -it -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble   sh -c "npm ci && npm run test:visual:update"
```

After an intended UI change, update the baselines on every platform: run `npm run test:visual:update` locally for Windows, and the workflow for Linux. Review the image diffs before keeping them.

## Reports and traces

- **HTML report:** written to `reports/playwright/` and committed with the repository.
- **Traces:** kept only for failed tests (`trace: 'retain-on-failure'`) and embedded in the report.
- **Raw output:** per-test output goes to `reports/test-results/`, which is git-ignored.
