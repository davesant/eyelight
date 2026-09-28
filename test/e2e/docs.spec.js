// D2: the documentation site and live demo work as served by GitHub Pages.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4174/minisearch/';
const PAGES = ['', 'configuration.html', 'search-data.html', 'accessibility.html', 'demo/', 'demo/getting-started.html', 'demo/bending.html', 'demo/tuning.html', 'demo/custom-theme.html'];

for (const p of PAGES) {
  test(`D2 ${p || 'index'} loads Minisearch without errors and links resolve`, async ({ page, request }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.goto(BASE + p);
    await page.waitForFunction(() => window.Minisearch && window.Minisearch.element);
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href).filter((h) => h.startsWith(location.origin)));
    for (const l of new Set(links.map((h) => h.split('#')[0]))) {
      expect((await request.get(l)).status(), l).toBe(200);
    }
    expect(errors).toEqual([]);
  });
}

test('D2 live demo: suggestions come from the docs index, highlights on the page', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.Minisearch && window.Minisearch.element);
  await page.keyboard.type('bend');
  const opts = page.locator('minisearch-ui .opt');
  await expect(opts.first()).toContainText('Bending notes');
  await expect.poll(() => page.evaluate(() => (CSS.highlights.get('minisearch') || { size: 0 }).size)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForURL(/demo\/bending\.html/);
});

test('D2 theme buttons theme the page and the component together', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.Minisearch && window.Minisearch.element);
  await page.click('[data-theme-btn=dark]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('minisearch-ui')).toHaveAttribute('data-theme', 'dark');
});
