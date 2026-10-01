import { expect, test } from '../helpers/test'

test('app boots, renders the game canvas and serves the mock API', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box?.width).toBeGreaterThan(0)
  expect(box?.height).toBeGreaterThan(0)

  const health: unknown = await page.evaluate(async () => {
    const response = await fetch('/api/health')
    return (await response.json()) as unknown
  })
  expect(health).toEqual({ status: 'ok' })
})
