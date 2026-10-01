import { test as base, expect } from '@playwright/test'

type Fixtures = {
  /** Console errors and uncaught exceptions collected during the test. */
  consoleErrors: string[]
}

type Options = {
  /**
   * Console errors a test expects, e.g. the browser's own "Failed to load
   * resource" line when the test deliberately aborts a request. Set with
   * `test.use({ allowedConsoleErrors: [/.../] })`; empty by default.
   */
  allowedConsoleErrors: RegExp[]
}

/**
 * Every spec importing `test` from here fails if the page logs a console
 * error or throws an uncaught exception, without having to opt in.
 */
export const test = base.extend<Fixtures & Options>({
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = message.text()
        if (allowedConsoleErrors.some((pattern) => pattern.test(text))) return
        errors.push(text)
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
