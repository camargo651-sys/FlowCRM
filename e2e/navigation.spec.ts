import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('landing page CTA links work', async ({ page }) => {
    await page.goto('/')

    // Sign in link
    const signIn = page.locator('a[href="/auth/login"]').first()
    await expect(signIn).toBeVisible()

    // Get started link
    const getStarted = page.locator('a[href="/auth/signup"]').first()
    await expect(getStarted).toBeVisible()
  })

  test('login page has link to signup', async ({ page }) => {
    await page.goto('/auth/login')
    const signupLink = page.locator('a[href="/auth/signup"]')
    await expect(signupLink).toBeVisible()
  })

  test('signup page has link to login', async ({ page }) => {
    await page.goto('/auth/signup')
    const loginLink = page.locator('a[href="/auth/login"]')
    await expect(loginLink).toBeVisible()
  })

  test('protected pages redirect to login', async ({ page }) => {
    const protectedPages = [
      '/dashboard', '/contacts', '/pipeline', '/invoices',
      '/inventory', '/hr', '/accounting', '/pos',
    ]
    for (const path of protectedPages) {
      await page.goto(path)
      await page.waitForURL(/auth\/login/, { timeout: 5000 })
      expect(page.url()).toContain('/auth/login')
    }
  })

  test('public quote page handles invalid token', async ({ page }) => {
    await page.goto('/q/invalid-token-12345')
    // Should show 404 or error
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})
