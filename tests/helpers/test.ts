import { test as base, expect } from '@playwright/test'

type Fixtures = {
  /** Console errors and uncaught exceptions collected during the test. */
  consoleErrors: string[]
}

/**
 * Every spec importing `test` from here fails if the page logs a console
 * error or throws an uncaught exception, without having to opt in.
 */
export const test = base.extend<Fixtures>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => {
        errors.push(`Uncaught: ${error.message}`)
      })
      await use(errors)
      expect(errors, 'browser console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
