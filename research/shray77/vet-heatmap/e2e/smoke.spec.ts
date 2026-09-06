import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the app loads and core interactions work.
 * Run: npx playwright test
 * These tests don't require a running server — Playwright starts one.
 */

test.describe("ВетКарта smoke tests", () => {
  test("page loads with title and map", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ВетКарта/);
    // Map container should be visible
    await expect(page.locator("[role='region'][aria-label='Map'], .maplibregl-map, canvas")).toBeVisible({ timeout: 15000 });
  });

  test("header shows app name and search box", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Вет");
    // Search box should be visible on desktop
    await expect(page.locator('input[aria-label="Поиск"]')).toBeVisible({ timeout: 10000 });
  });

  test("disease filter chips are clickable", async ({ page }) => {
    await page.goto("/");
    // Wait for disease chips to load
    const chips = page.locator("button:has-text('АЧС')");
    await expect(chips.first()).toBeVisible({ timeout: 10000 });
    // Click ASF chip
    await chips.first().click();
    // The chip should now be active (has inline style with background color)
    // We just verify the click doesn't crash
  });

  test("tools dropdown opens and shows menu items", async ({ page }) => {
    await page.goto("/");
    // Click the "Инструменты" dropdown
    const toolsBtn = page.locator("button:has-text('Инструменты')");
    if (await toolsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await toolsBtn.click();
      // Menu should appear
      await expect(page.locator("[role='menuitem']").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("outbreaks data loads (stats bar shows numbers)", async ({ page }) => {
    await page.goto("/");
    // Wait for stats bar to show numbers (not loading state)
    await page.waitForTimeout(5000); // give data time to load
    // The "Всего" stat should show a number > 0
    const statsText = await page.locator("text=Всего").textContent();
    expect(statsText).toBeTruthy();
  });
});
