// F6 mobile / touch behaviour (runs on a touch-phone device profile).
import { test, expect } from '@playwright/test';
import { load, ui, focusedIsInput } from './helpers.js';

test('F6.1 a floating search button replaces the idle cursor', async ({ page }) => {
  await load(page);
  const u = ui(page);
  await expect(u.hint).toBeVisible();
  await expect(u.hint.locator('.caret')).toHaveCount(0);
  await expect(u.hint).toHaveAttribute('aria-label', 'Search this site');
  const b = await u.hint.boundingBox();
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
});

test('F6.2-F6.3 tap to open, search, step through matches, toggle and close', async ({ page }) => {
  await load(page);
  const u = ui(page);
  await u.hint.tap();
  await expect(u.panel).toBeVisible();
  expect(await focusedIsInput(page)).toBe(true);
  await page.keyboard.insertText('harmonica'); // what an on-screen keyboard does
  await expect(u.count).toHaveText('1 of 4');
  for (const b of [u.prev, u.next, u.mode, u.close, u.cap]) {
    const box = await b.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await u.next.tap();
  await expect(u.count).toHaveText('2 of 4');
  await u.next.tap();
  await expect(u.count).toHaveText('3 of 4');
  await expect(u.mode).toHaveAttribute('aria-pressed', 'true');
  await u.mode.tap();
  await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
  await expect(u.options.first()).toBeVisible(); // switching back to suggestions shows them
  await u.close.tap();
  await expect(u.panel).toBeHidden();
  expect(await page.evaluate(() => CSS.highlights.has('minimarker'))).toBe(false);
});

test('F3.4 tapping a suggestion opens it on touch devices', async ({ page }) => {
  await load(page);
  const u = ui(page);
  await u.hint.tap();
  await page.keyboard.insertText('flatten');
  await u.mode.tap(); // switch from page matches to site pages
  await expect(u.options.first()).toBeVisible();
  await u.options.first().tap();
  await page.waitForURL(/guide\/tuning\.html#flatten$/);
});

test('F6.4 the bar moves up with the on-screen keyboard', async ({ page }) => {
  await load(page);
  const u = ui(page);
  await u.hint.tap();
  // Simulate the visual viewport shrinking as a keyboard would.
  await page.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => innerHeight - 300 });
    vv.dispatchEvent(new Event('resize'));
  });
  await expect(u.host).toHaveAttribute('style', /--minimarker-kb:\s*300px/);
  const box = await u.panel.boundingBox();
  const vh = await page.evaluate(() => innerHeight);
  expect(box.y + box.height).toBeLessThanOrEqual(vh - 300);
});
