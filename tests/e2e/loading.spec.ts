import { expect, test } from '../helpers/test'

const GAME_URL = '/?test=1&clock=manual&spawn=off#/play'
const FAILING_ASSET = '**/assets/png/default/ships/ship_2.png'

// Routed on the context, not the page: the page is controlled by MSW's
// Service Worker, which refetches every request (bypassed ones included),
// and page.route() never sees Service Worker traffic.

test('shows real progress while the game assets load', async ({ page }) => {
  // Hold one asset back so the loading screen stays up mid-way.
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.context().route(FAILING_ASSET, async (route) => {
    await held
    await route.continue()
  })

  await page.goto(GAME_URL)
  const progress = page.getByRole('progressbar', { name: 'Loading the fleet…' })
  await expect(progress).toBeVisible()
  await expect
    .poll(() => progress.evaluate((el: HTMLProgressElement) => el.value))
    .toBeGreaterThan(0)
  expect(
    await progress.evaluate((el: HTMLProgressElement) => el.value),
  ).toBeLessThan(100)

  release()
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await expect(progress).toBeHidden()
})

test.describe('when an asset fails to load', () => {
  // The browser itself logs the aborted request; that one is expected.
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('shows the error, and Retry never refetches what already loaded', async ({
    page,
  }) => {
    let failing = true
    await page.context().route(FAILING_ASSET, async (route) => {
      if (failing) await route.abort()
      else await route.continue()
    })
    // Game (Pixi) assets only; the HUD's <img> tags are plain DOM images.
    const assetPath = (url: string): string | null => {
      const { pathname } = new URL(url)
      const isGameAsset =
        pathname.startsWith('/assets/') && !pathname.includes('/ui/')
      return isGameAsset ? pathname : null
    }
    const loaded = new Set<string>()
    // Only successful responses: the Service Worker turns the aborted fetch
    // into a finished (but failed) request.
    page.on('response', (response) => {
      const path = assetPath(response.url())
      if (path && response.ok()) loaded.add(path)
    })

    await page.goto(GAME_URL)
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Could not load the game')
    const retry = page.getByRole('button', { name: 'Retry' })
    await expect(retry).toBeFocused()
    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'error',
    )

    failing = false
    const loadedBeforeRetry = new Set(loaded)
    const refetched: string[] = []
    page.on('request', (request) => {
      const path = assetPath(request.url())
      if (path) refetched.push(path)
    })
    await retry.click()

    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'ready',
    )
    await expect(page.getByTestId('hud-health')).toHaveText('100 / 100')
    // The failed asset is fetched again; nothing that had loaded is. (Assets
    // still queued when the bundle failed are fetched now for the first time.)
    expect(refetched).toContain('/assets/png/default/ships/ship_2.png')
    expect(loadedBeforeRetry.size).toBeGreaterThan(0)
    expect(refetched.filter((path) => loadedBeforeRetry.has(path))).toEqual([])
  })
})
