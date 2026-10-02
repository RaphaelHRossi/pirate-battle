import type { Locator, Page } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../helpers/axe'
import { advance, finishMatchByTime, getState, openGame } from '../helpers/game'
import { expect, test } from '../helpers/test'

/** The element has a clearly visible focus indicator. */
async function expectFocusRing(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused()
  const ring = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
  })
  expect(ring.style).toBe('solid')
  expect(ring.width).toBeGreaterThanOrEqual(2)
}

const focused = (page: Page) => page.locator(':focus')

test.describe('axe finds no serious or critical violations', () => {
  test('main menu', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Pirate Battle' }),
    ).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })

  test('options, including a field in error', async ({ page }) => {
    await page.goto('/#/options')
    await page.getByRole('textbox', { name: 'Game session time' }).fill('65')
    await expect(page.getByText('must go in steps of 10')).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })

  test('captain’s log, both tabs', async ({ page }) => {
    await page.goto('/#/log')
    await expect(page.locator('.log-table tbody tr')).toHaveCount(5)
    await expectNoSeriousA11yViolations(page)
    await page.getByRole('tab', { name: 'Match History' }).click()
    await expect(page.getByText('No battles yet.')).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })

  test('result', async ({ page }) => {
    await openGame(page)
    await finishMatchByTime(page)
    await expect(page.getByTestId('result-registration')).toHaveText('Saved')
    await expectNoSeriousA11yViolations(page)
  })

  test('pause dialog', async ({ page }) => {
    await openGame(page)
    await page.keyboard.press('KeyP')
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })

  test('network panel', async ({ page }) => {
    await page.goto('/#/network')
    await expect(
      page.getByRole('radio', { name: 'success', exact: true }),
    ).toBeChecked()
    await expectNoSeriousA11yViolations(page)
  })
})

test('menus, options, log tabs and pagination work with the keyboard alone', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Keyboard navigation is a desktop concern')
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Pirate Battle' }),
  ).toBeFocused()

  // Menu → Options.
  await page.keyboard.press('Tab')
  await expectFocusRing(page.getByRole('button', { name: 'Play' }))
  await page.keyboard.press('Tab')
  await expectFocusRing(page.getByRole('button', { name: 'Options' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Options' })).toBeFocused()

  // Every control has a name; stepping at a limit keeps focus on a button.
  await page.keyboard.press('Tab')
  await expectFocusRing(
    page.getByRole('button', { name: 'Decrease game session time' }),
  )
  await page.keyboard.press('Tab')
  await expectFocusRing(
    page.getByRole('textbox', { name: 'Game session time' }),
  )
  await page.keyboard.press('Tab')
  const increase = page.getByRole('button', {
    name: 'Increase game session time',
  })
  await expectFocusRing(increase)
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
  const session = page.getByRole('textbox', { name: 'Game session time' })
  await expect(session).toHaveValue('180')
  await expect(increase).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Decrease game session time' }),
  ).toBeFocused()

  // An invalid value is described by its error, announced politely.
  await session.fill('61')
  await expect(session).toHaveAccessibleDescription(/steps of 10 seconds/)
  await expect(page.locator('.option-error').first()).toHaveAttribute(
    'aria-live',
    'polite',
  )

  // Restore the default, so the ranking below shows the fixtures' config.
  await session.fill('120')

  // Back to the menu, then the log.
  await page.getByRole('button', { name: 'Main Menu' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Ranking' }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: "Captain's Log" }),
  ).toBeFocused()

  // Tablist: Tab reaches the selected tab only; arrows, Home, End move.
  await page.keyboard.press('Tab')
  const ranking = page.getByRole('tab', { name: 'Ranking' })
  const history = page.getByRole('tab', { name: 'Match History' })
  await expectFocusRing(ranking)
  await page.keyboard.press('ArrowRight')
  await expect(history).toBeFocused()
  await expect(history).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(ranking).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(history).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(ranking).toBeFocused()

  // Pagination: Previous is disabled on page 1, so Tab lands on Next.
  await expect(page.locator('.log-table tbody tr')).toHaveCount(5)
  await page.keyboard.press('Tab')
  const next = page.getByRole('button', { name: 'Next page' })
  await expectFocusRing(next)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('pager-label')).toHaveText('Page 2 of 4')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('pager-label')).toHaveText('Page 4 of 4')
  // Next is now disabled; focus moved to Previous instead of <body>.
  await expect(next).toBeDisabled()
  await expectFocusRing(page.getByRole('button', { name: 'Previous page' }))
})

test('the pause dialog takes focus and gives it back to its trigger', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Keyboard navigation is a desktop concern')
  await openGame(page)
  await page.keyboard.press('Tab')
  const pause = page.getByRole('button', { name: 'Pause' })
  await expectFocusRing(pause)
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Paused' })
  await expect(dialog).toBeVisible()
  await expectFocusRing(dialog.getByRole('button', { name: 'Resume' }))
  // Focus stays inside the modal dialog.
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Main Menu' })).toBeFocused()
  await expect(
    dialog.getByRole('button', { name: 'Main Menu' }),
  ).toHaveAccessibleDescription('Leaving ends this match without recording it.')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(pause).toBeFocused()
  expect(await focused(page).count()).toBe(1)
})

test('the HUD exposes health, score and time as text, not a live region', async ({
  page,
}) => {
  await openGame(page)
  const hud = page.getByRole('region', { name: 'Match status' })
  await expect(hud).toContainText('Health: 100 / 100')
  await expect(hud).toContainText('Score: 0')
  await expect(hud).toContainText('Time left: 02:00')
  await expect(hud).not.toHaveAttribute('aria-live')

  // The match state is there too, kept up to date but never announced
  // from the HUD itself.
  const status = page.getByTestId('hud-status')
  await expect(status).toHaveText('Status: Playing')
  await page.keyboard.press('KeyP')
  await expect(status).toHaveText('Status: Paused')
  await page.keyboard.press('Escape')
  await expect(status).toHaveText('Status: Playing')
  const { durationSeconds } = (await getState(page)).world.config.match
  await advance(page, durationSeconds * 1000)
  await expect(status).toHaveText('Status: Over')
  // Events are spoken by a separate polite live region (see hud.spec).
  await expect(page.getByTestId('announcer')).toHaveAttribute(
    'aria-live',
    'polite',
  )
})

test('the main menu shows the controls for keyboard and touch', async ({
  page,
}) => {
  await page.goto('/')
  const guide = page.getByRole('region', { name: 'Controls' })
  const table = guide.getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveText([
    'Action',
    'Keyboard',
    'Touch',
  ])
  const rows: readonly (readonly [string, string])[] = [
    ['Sail forward', 'W or ↑'],
    ['Turn', 'A / D or ← / →'],
    ['Bow cannon', 'Space'],
    ['Port / starboard broadside', 'Q / E'],
    ['Pause', 'P or Esc'],
  ]
  for (const [action, key] of rows) {
    await expect(
      table.getByRole('row', { name: new RegExp(`^${action}`) }),
    ).toContainText(key)
  }
})
