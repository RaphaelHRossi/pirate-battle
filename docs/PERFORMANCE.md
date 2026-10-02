# Performance

The goal (CHALLENGE.md §9) is **60 FPS** in an optimised build on a documented reference machine. Over a three-minute match we record the frame rate, the 95th-percentile frame time and the entity count, and we check memory after five start → play → leave cycles.

> **Status:** all results below are measured. The three-minute run was played by hand on the machine below (`docs/perf/run-180s-3s.json`, recorded 2026-10-02 02:04 UTC); the memory results come from `npm run perf:memory`.

## Environment

Collected with PowerShell; raw values in [`perf/environment.json`](perf/environment.json).

|                         |                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CPU                     | AMD Ryzen 5 5600GT, 6 cores / 12 threads, 3.6 GHz                                                                          |
| GPU                     | NVIDIA GeForce RTX 5060 (driver 32.0.16.1714); integrated Radeon unused                                                    |
| RAM                     | 13.9 GB visible to Windows                                                                                                 |
| OS                      | Windows 11 IoT Enterprise LTSC 10.0.26100, 64-bit                                                                          |
| Display                 | 1920×1080 at **164 Hz** (primary); second 1920×1080 screen                                                                 |
| Browser (manual run)    | Google Chrome 154 (installed build 154.0.8037.93; the user agent reports `Chrome/154.0.0.0`), full screen 1920×1080, DPR 1 |
| Browser (memory script) | Chromium 153.0.8010.12, Playwright, headless, 1280×720, DPR 1                                                              |
| Build                   | `npm run build` (Vite production bundle, MSW enabled), served by `vite preview` or Vercel                                  |

## Method

### Frame rate and entities: `?perf=1`

Adding `?perf=1` to the URL enables a recorder in `GameSession` (`src/engine/perf.ts`). It works in production and needs no test mode.

- **Frame time** is the gap between two consecutive `requestAnimationFrame` timestamps. That is the real presented frame interval, simulation and render included.
- **Work time** is how long our own frame callback takes: the simulation steps, `renderer.sync` and submitting the draw (`app.render()`), timed with `performance.now()`. Unlike frame time it does not depend on the display's refresh rate. GPU execution is asynchronous and not included. Reports made before 2026-10-02 (the three-minute run) do not have it.
- **Only frames of a match being played count.** The recorder breaks the series on pause, on losing focus, on hiding the tab and when the match ends. Paused or hidden time is never counted as one huge frame.
- **Entities** are the player plus live enemies, projectiles and effects, sampled every rendered frame. The report has the maximum (and the breakdown at that moment) and the average.
- **When the match ends** the report is stored locally, and the result screen offers **Download performance report**. The JSON contains:
  - frames, average FPS, and p50/p95/p99/max frame time and work time
  - frames over 16.7 ms and 33.3 ms
  - entity max and average
  - the match config (session and spawn time, plus the full frozen config)
  - user agent, DPR, screen and viewport
- **Percentiles** are nearest-rank over all recorded frames.
- **The overlay** shows live FPS. It updates the DOM twice a second, so it costs nothing per frame and never makes React re-render.

### Worst case: `npm run perf:stress`

[`scripts/stress-perf.mjs`](../scripts/stress-perf.mjs) builds the app, serves it with `vite preview`, and runs one 60 s match in installed **Google Chrome**, headless with hardware rendering (`--use-angle=d3d11`). The WebGL renderer string is recorded to prove which GPU drew the frames.

- **The scene:** the test-only fixture `?fixture=stress` (`src/game/fixtures.ts`). It places the enemy cap, **12 Shooters**, on a ring around the player with staggered guns, so they keep firing. Spawning is off.
- **The player cannot sink:** it gets 1,000,000 hp. Twelve guns deal at most 60 hp/s, so no game rule is changed.
- **Input:** real keys for the whole match (↑ and ← held, so the player circles). The player does not fire, so all 12 Shooters stay alive.
- **Sampling:** every 5 s the script records enemies alive, projectiles, effects and player hp. The run is rejected if fewer than 12 enemies are alive at any sample or the console logs an error.
- **Output:** the `?perf=1` report plus those samples, written to [`perf/stress.json`](perf/stress.json).

### Memory: `npm run perf:memory`

[`scripts/memory-cycles.mjs`](../scripts/memory-cycles.mjs) builds the app, serves it with `vite preview`, and drives headless Chromium:

1. Open the menu (`?test=1`, real clock, spawns on). Force GC through CDP (`HeapProfiler.collectGarbage` ×2), then read `Performance.getMetrics` for the **baseline**.
2. Run **5 cycles**:
   - click **Play** and play **15 s with real keyboard input**: hold ↑, turn left and right, fire Space / Q / E
   - read the GPU texture count of the live renderer and the size of the Pixi texture cache
   - leave with **P → Main Menu**, which abandons the match
   - force GC and record `JSHeapUsedSize`, DOM nodes, JS event listeners and the `<canvas>` count
3. Write [`perf/memory.json`](perf/memory.json). Setting `MEMORY_CYCLES` and `MEMORY_PLAY_SECONDS` changes the run; [`perf/memory-12-cycles.json`](perf/memory-12-cycles.json) is 12 cycles × 5 s.

## Results

### Three-minute match (`?perf=1`, 180 s session, 3 s spawn)

Source: [`perf/run-180s-3s.json`](perf/run-180s-3s.json): 180 s session, 3 s spawn interval, played to time up without pausing.

| Metric                                                | Value                           |
| ----------------------------------------------------- | ------------------------------- |
| Frames recorded                                       | 29,700 over 180.0 s             |
| Average FPS                                           | 165 (display: 164 Hz)           |
| Frame time p50                                        | 6.10 ms                         |
| Frame time **p95**                                    | **6.20 ms**                     |
| Frame time p99 / max                                  | 6.20 / 9.07 ms                  |
| Frames > 16.7 ms / > 33.3 ms                          | 0 / 0                           |
| Entities max (enemies / projectiles / effects at max) | 17 (5 / 5 / 6, plus the player) |
| Entities average                                      | 8.8                             |
| Viewport / DPR                                        | 1920×1080 / 1                   |

### Worst case: 12 Shooters firing for 60 s (`npm run perf:stress`)

Source: [`perf/stress.json`](perf/stress.json), recorded 2026-10-02. Google Chrome 154.0.8037.93 ran headless at 1920×1080, DPR 1, rendering with `ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Direct3D11)`.

| Metric                                                | Value                                      |
| ----------------------------------------------------- | ------------------------------------------ |
| Enemies alive (every 5 s sample)                      | **12** in all 11 samples                   |
| Frames recorded                                       | 9,891 over 60.0 s                          |
| Average FPS                                           | 164.8 (display pace, as in the manual run) |
| Frame time p50 / **p95** / p99 / max                  | 6.10 / **6.20** / 6.20 / 54.5 ms           |
| Frames > 16.7 ms / > 33.3 ms                          | 1 / 1 (of 9,891)                           |
| **Work time** p50 / **p95** / p99 / max               | 0.2 / **0.5** / 0.6 / 7.0 ms (avg 0.26 ms) |
| Entities max (enemies / projectiles / effects at max) | 20 (12 / 6 / 1, plus the player)           |
| Entities average                                      | 18.0                                       |
| Enemy balls in flight (samples)                       | 4–5                                        |
| Player hp lost                                        | about 1,600 in 55 s (~30 hp/s)             |

### Memory after start → play → leave (5 cycles × 15 s)

Source: [`perf/memory.json`](perf/memory.json). Every value is taken after leaving the match and forcing GC.

|                                   | JS heap used | Canvases | DOM nodes | JS listeners | GPU textures (during play) | Cached textures |
| --------------------------------- | -----------: | -------: | --------: | -----------: | -------------------------: | --------------: |
| Baseline (menu, before any match) |      4.77 MB |        0 |       124 |          172 |                          — |               — |
| Cycle 1                           |      7.11 MB |        0 |       127 |          184 |                         38 |             180 |
| Cycle 2                           |      7.32 MB |        0 |       127 |          184 |                         36 |             180 |
| Cycle 3                           |      7.43 MB |        0 |       127 |          184 |                         38 |             180 |
| Cycle 4                           |      7.54 MB |        0 |       127 |          184 |                         36 |             180 |
| Cycle 5                           |      7.66 MB |        0 |       127 |          184 |                         37 |             180 |

- **Growth from the baseline:** 2.89 MB (4.77 → 7.66 MB). This is a one-off: the first match loads and caches every texture, the Pixi modules and the query client.
- **Growth from cycle 1 to cycle 5:** 0.55 MB, about 0.14 MB per cycle and shrinking. The 12-cycle run gives 7.01 → 8.21 MB: one 0.32 MB step at cycle 9, then steps of only 0.02–0.06 MB.

## Interpretation

- **Frame rate: the 60 FPS target is met with a wide margin.**
  - **p95 is 6.2 ms against the 16.7 ms budget of a 60 FPS frame.** Even p99 is 6.2 ms and the slowest frame of the 3 minutes is 9.07 ms, still below one 60 Hz frame. Not a single frame went over 16.7 ms (or 33.3 ms), so there was no visible stutter.
  - **The game kept up with the 164 Hz display.** The average of 6.06 ms per frame (165 FPS) is the monitor's refresh interval, and p50 = p95 = p99 ≈ 6.1–6.2 ms means frames arrived at an even pace. The real cost of a frame is therefore below 6.1 ms; it cannot be measured more finely from rAF intervals, which are paced by the display.
  - **Read as a 60 FPS budget**, each frame used at most about 37% (p95) to 54% (max) of the 16.7 ms available.
- **The worst case fits the budget with room to spare.** With the enemy cap reached and every Shooter firing, our frame work has a p95 of **0.5 ms**, about 3% of a 16.7 ms frame. Frame pacing stayed at the 6.1 ms display rate (p95 6.2 ms).
  - The single long frame (54.5 ms) is 1 in 9,891, about 0.01%. The longest work time was only 7 ms, so it was a browser-side pause (GC, compositing) rather than the game's own code.
  - **12 enemies sustain fewer entities than expected:** about 18–20, not the "40–50" estimated earlier. A Shooter fires only when aimed within 8°, and at most once every 2 s, so even 12 of them keep only 4–7 balls in the air.
  - **The 164 Hz monitor:** Chrome fires `requestAnimationFrame` at the display rate, so FPS is reported against **164 Hz** (6.1 ms frames), not 60. The game still simulates at a fixed 60 steps/s; extra frames only re-render.
  - **The 60 FPS target:** check it with **p95 ≤ 16.7 ms** and few frames over 33.3 ms. Average FPS alone hides stutter; p95 is what a player feels.
  - **On a 60 Hz display** the same run caps at ~60 FPS; the frame-time percentiles are the comparable figures.
- **Memory, no continuous growth of app resources:**
  - after every cycle there are **0 canvases**, 0 live `WebGL2RenderingContext`s and 0 `WebGLTexture`s (checked with CDP `Runtime.queryObjects`)
  - DOM nodes and JS listeners are identical from cycle 1 on
  - the texture cache stays at 180 Texture objects, since textures are loaded once and reused
  - the live renderer uploads the same ~36–38 GPU textures each match
- **What the remaining JS growth is.** A heap-snapshot diff between cycle 2 and cycle 6 shows:
  - **About 90% V8 compiled code** (`InstructionStream`, `FeedbackVector`, `Code`): JIT warm-up as more code paths get optimised. It levels off.
  - **About 13 small entries per match**: `PerformanceResourceTiming`, `MessagePort` and `ReadableStream`. They come from the HUD `<img>` requests that pass through MSW's Service Worker, plus DevTools' own network records, present because CDP is attached. The browser caps these buffers.
  - **About 5.5 KB per match in Pixi**: a new `graphics-vertex-N` shader source string kept in Pixi's global program cache. Each `Application` names its shaders with a new counter. This is Pixi-internal, small and bounded by the number of matches played.

## Limitations

- **Headless FPS is not meaningful.** Playwright's headless Chromium renders WebGL in software (SwiftShader), so no FPS figure is taken from it; FPS comes only from the manual run on real hardware.
- **`JSHeapUsedSize` is the JS heap only.** GPU memory is not included; GPU objects are checked by counting live contexts and textures instead.
- **One machine, one browser, one run:** no variance across runs or devices was measured, and mobile performance was not profiled on a real phone.
- **GC is forced** before each memory reading. Real sessions hold more garbage between collections.
- **The 15 s cycles are short.** Long matches are covered by the 3-minute run, not by the memory script.
- **The heaviest scene is measured, with caveats.** The 3-minute manual run peaked at 17 entities (5 enemies), so the cap was measured separately with the `stress` fixture: 12 Shooters firing for 60 s, p95 work time 0.5 ms (see Worst case). Its caveats:
  - **Headless browser:** it ran headless (Chrome with hardware D3D11), not in a visible window.
  - **The player does not fire:** player shots (up to about 3 front balls and 6 broadside balls in flight, plus muzzle flashes) would add some entities, but sinking enemies would then drop the enemy count below 12.
  - **GPU time is not included in work time:** frame time shows the GPU kept pace (p95 6.2 ms at the 164 Hz display rate).
- **A 164 Hz display caps what rAF can show.** Frame times measure presented frames, so they show the display pace (6.1 ms) and an upper bound on the work per frame, not its exact cost.
- **The `?perf=1` overlay** and the recorder's `number[]` (about 30k entries for 3 min at 164 Hz) add a small constant overhead.

## How to do the three-minute run (manual)

1. **Prepare the machine:** close other tabs and heavy apps, keep the laptop or PC on mains power, and use the primary 1920×1080 monitor.
2. **Open the production build in Chrome:** <https://pirate-battle-lake.vercel.app/?perf=1#/>. Locally, run `npm run build && npm run preview` and open <http://localhost:4173/?perf=1#/>.
3. **Set the options:** **Game session time = 180** and **Enemy spawn time = 3**. Go back to the main menu.
4. Press **F11** for full screen. Note the browser version from `chrome://version`.
5. **Play the whole 3 minutes:**
   - don't pause, switch tabs or click outside the window (paused time is excluded, but the run should be continuous)
   - keep moving and firing so enemies and projectiles build up
   - if the ship sinks before 3 minutes, start again: the run must last the full session
6. **On the result screen**, click **Download performance report**.
7. **Save the file** as `docs/perf/run-180s-3s.json`.
8. **Update the results above** from the JSON (the current figures come from the run of 2026-10-02):
   - `frames`, `avgFps`
   - `frameTimeMs.p50/p95/p99/max`
   - `longFrames`
   - `entities.max/avg/atMax`
   - `environment.viewport` and `devicePixelRatio`

   Then update the frame-rate interpretation.
