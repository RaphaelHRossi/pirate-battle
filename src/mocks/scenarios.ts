import { delay, HttpResponse } from 'msw'
import { z } from 'zod'
import { createRng, nextRange, type Rng } from '../game/rng'
import { readStored, removeStored, writeStored } from '../storage/local'

/**
 * Network conditions the mock server can simulate. One is active at a
 * time; it is chosen with `?scenario=` (and `?netSeed=` for jitter) or in
 * the Network panel, and kept in localStorage so it survives a refresh.
 */
export const SCENARIOS = {
  success: 'Everything works, with a short realistic latency.',
  empty: 'The ranking and history are empty.',
  slow: 'Every response takes 2 seconds.',
  jitter: 'Latency varies between 0.1 and 1.5 s (seeded by ?netSeed=).',
  'out-of-order':
    'Each list response takes longer than the one requested after it.',
  timeout: 'The server never answers; requests time out after 5 s.',
  offline: 'The connection fails: no response at all.',
  'server-error': 'Every request fails with 500.',
  'bad-request': 'Every request fails with 400 (not retried).',
  'ranking-fail': 'Only the ranking fails (500).',
  'history-fail': 'Only the match history fails (500).',
  'save-timeout-after-commit':
    'Saving a match is recorded, but the first answer never arrives.',
  'save-unavailable': 'Saving a match fails with 503 and records nothing.',
} as const

export type ScenarioName = keyof typeof SCENARIOS
export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[]

const scenarioNameSchema = z.enum(
  SCENARIO_NAMES as [ScenarioName, ...ScenarioName[]],
)

const KEY = 'scenario'
const storedSchema = z.object({
  name: scenarioNameSchema,
  netSeed: z.int().nonnegative(),
})

export function isScenarioName(value: string): value is ScenarioName {
  return scenarioNameSchema.safeParse(value).success
}

export function currentScenario(): ScenarioName {
  return readStored(KEY, storedSchema)?.name ?? 'success'
}

function currentNetSeed(): number {
  return readStored(KEY, storedSchema)?.netSeed ?? 1
}

/** The jitter generator restarts whenever the seed or scenario is set. */
let jitterRng: Rng = createRng(currentNetSeed())
/** Requests answered per endpoint, for the out-of-order delays. */
const requestCounts = new Map<string, number>()

export function setScenario(
  name: ScenarioName,
  netSeed = currentNetSeed(),
): void {
  writeStored(KEY, { name, netSeed })
  jitterRng = createRng(netSeed)
  requestCounts.clear()
}

export function clearScenario(): void {
  removeStored(KEY)
  jitterRng = createRng(1)
  requestCounts.clear()
}

/** Applies `?scenario=` / `?netSeed=` from the page URL (on app start). */
export function initScenarioFromUrl(search: string): void {
  const params = new URLSearchParams(search)
  const name = params.get('scenario')
  const seed = params.get('netSeed')
  const netSeed = seed && /^\d+$/.test(seed) ? Number(seed) : undefined
  if (name && isScenarioName(name)) setScenario(name, netSeed)
  else if (netSeed !== undefined) setScenario(currentScenario(), netSeed)
}

export type Endpoint = 'ranking' | 'history' | 'save'

const LATENCY_MS = 150
const SLOW_MS = 2000

function failure(status: number): Response {
  return HttpResponse.json({ error: `Simulated ${String(status)}` }, { status })
}

/**
 * Runs the active scenario for one request: waits its latency, then
 * returns a response to send instead (a failure), or null to let the
 * handler answer normally. `save-timeout-after-commit` is handled by the
 * PUT handler itself, since it must commit first.
 */
export async function applyScenario(
  endpoint: Endpoint,
): Promise<Response | null> {
  const scenario = currentScenario()
  const index = requestCounts.get(endpoint) ?? 0
  requestCounts.set(endpoint, index + 1)

  switch (scenario) {
    case 'slow':
      await delay(SLOW_MS)
      return null
    case 'jitter':
      await delay(Math.round(nextRange(jitterRng, 100, 1500)))
      return null
    case 'out-of-order':
      // 1800, 1200, 600, 1800, ... ms: a request answers before the one
      // sent just before it. Saves are not delayed.
      await delay(endpoint === 'save' ? LATENCY_MS : (3 - (index % 3)) * 600)
      return null
    case 'timeout':
      await delay('infinite')
      return null
    case 'offline':
      return HttpResponse.error()
    case 'server-error':
      await delay(LATENCY_MS)
      return failure(500)
    case 'bad-request':
      await delay(LATENCY_MS)
      return failure(400)
    case 'ranking-fail':
      await delay(LATENCY_MS)
      return endpoint === 'ranking' ? failure(500) : null
    case 'history-fail':
      await delay(LATENCY_MS)
      return endpoint === 'history' ? failure(500) : null
    case 'save-unavailable':
      await delay(LATENCY_MS)
      return endpoint === 'save' ? failure(503) : null
    case 'success':
    case 'empty':
    case 'save-timeout-after-commit':
      await delay(LATENCY_MS)
      return null
  }
}
