import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test('landing page loads with Tracktio branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Tracktio/)
    await expect(page.locator('text=The ERP that runs')).toBeVisible()
    await expect(page.locator('text=your entire business')).toBeVisible()
    await expect(page.locator('text=Start free')).toBeVisible()
  })

  test('landing page shows competitor comparison', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Tracktio vs')).toBeVisible()
  })

  test('landing page shows 16 modules', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=27 modules. One platform.')).toBeVisible()
  })

  test('login page loads', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('signup page loads', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page).toHaveURL(/signup/)
  })

  test('unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/auth\/login/)
    expect(page.url()).toContain('/auth/login')
  })

  test('store page shows not found for invalid slug', async ({ page }) => {
    await page.goto('/store/nonexistent-store')
    await expect(page.locator('text=Store not found')).toBeVisible()
  })
})
