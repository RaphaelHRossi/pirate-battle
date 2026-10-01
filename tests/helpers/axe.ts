import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect } from './test'

/**
 * Runs axe-core (WCAG 2.0/2.1 A and AA rules) on the current page and
 * fails on any serious or critical violation, listing rule and elements.
 * Minor/moderate findings and "needs review" items (e.g. text over an
 * image, whose contrast axe cannot measure) do not fail the test.
 */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations
    .filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    )
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(', ')}`,
    )
  expect(serious, 'serious/critical axe violations').toEqual([])
}
