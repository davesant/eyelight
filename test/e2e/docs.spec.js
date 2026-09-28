// D2: the documentation site and live demo work as served by GitHub Pages.
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4174/eyelight/';
const PAGES = ['', 'configuration.html', 'search-data.html', 'accessibility.html', 'demo/', 'demo/getting-started.html', 'demo/bending.html', 'demo/tuning.html', 'demo/custom-theme.html'];

for (const p of PAGES) {
  test(`D2 ${p || 'index'} loads Eyelight without errors and links resolve`, async ({ page, request }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.goto(BASE + p);
    await page.waitForFunction(() => window.Eyelight && window.Eyelight.element);
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href).filter((h) => h.startsWith(location.origin)));
    for (const l of new Set(links.map((h) => h.split('#')[0]))) {
      expect((await request.get(l)).status(), l).toBe(200);
    }
    expect(errors).toEqual([]);
  });
}

test('D2 live demo: suggestions come from the docs index, highlights on the page', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.Eyelight && window.Eyelight.element);
  await page.keyboard.type('bend');
  await page.keyboard.press('Enter');
  const opts = page.locator('eyelight-ui .opt');
  await expect(opts.first()).toContainText('Bending notes');
  await expect.poll(() => page.evaluate(() => (CSS.highlights.get('eyelight') || { size: 0 }).size)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForURL(/demo\/bending\.html/);
});

test('D2 theme buttons theme the page and the component together', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.Eyelight && window.Eyelight.element);
  await page.click('[data-theme-btn=dark]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('eyelight-ui')).toHaveAttribute('data-theme', 'dark');
});

test('D2/NF3 the custom theme demo switches every default with data attributes', async ({ page }) => {
  await page.goto(`${BASE}demo/custom-theme.html`);
  await page.waitForFunction(() => window.Eyelight && window.Eyelight.element);
  const c = await page.evaluate(() => { const k = window.Eyelight.config; return [k.position, k.startMode, k.caret, k.highlight]; });
  expect(c).toEqual(['center', 'suggest', 'bar', 'solid']);
  await page.keyboard.type('reed');
  await expect(page.locator('eyelight-ui .opt').first()).toBeVisible(); // suggestions while typing
});
