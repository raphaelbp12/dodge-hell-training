import { expect, test } from '@playwright/test'

test('loads the starter, its images, and the working counter', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Get started', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Count is 0', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Count is 1', exact: true })).toBeVisible()
  await expect.poll(() => page.locator('img').evaluateAll((images) =>
    images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0),
  )).toBe(true)
  expect(pageErrors).toEqual([])
})