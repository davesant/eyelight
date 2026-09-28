import { expect } from '@playwright/test';

export const HOME = '/test/fixtures/site/';

export async function load(page, url = HOME) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto(url);
  await page.waitForFunction(() => window.Minimarker && window.Minimarker.element);
  return errors;
}

export const ui = (page) => {
  const host = page.locator('minimarker-ui');
  return {
    host,
    hint: host.locator('.hint'),
    panel: host.locator('.panel'),
    input: host.locator('input'),
    count: host.locator('.count'),
    list: host.locator('.list'),
    options: host.locator('.opt'),
    prev: host.locator('.prev'),
    next: host.locator('.next'),
    mode: host.locator('.mode'),
    close: host.locator('.close'),
    cap: host.locator('.cap'),
    live: host.locator('[role=status]'),
  };
};

export const hlCount = (page) => page.evaluate(() => (CSS.highlights.get('minimarker') || { size: 0 }).size);
export const currentText = (page) => page.evaluate(() => {
  const h = CSS.highlights.get('minimarker-current');
  return h ? [...h][0].toString() : null;
});
export const focusedIsInput = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return !!(a && a.tagName === 'MINIMARKER-UI' && a.shadowRoot.activeElement && a.shadowRoot.activeElement.tagName === 'INPUT');
});

export async function typeOnPage(page, text) {
  await page.keyboard.type(text);
}

/** Wait past the 500 ms double-Escape window so the next Esc toggles. */
export const waitEscWindow = (page) => page.waitForTimeout(600);

export async function expectClosed(page) {
  await expect(ui(page).panel).toBeHidden();
}

/** Restart Minimarker on the fixture page with extra config (e.g. the non-default options). */
export async function reinit(page, cfg) {
  await page.evaluate((c) => {
    window.Minimarker.destroy();
    window.Minimarker.init({ prompt: 'search', index: '/test/fixtures/site/minimarker-index.json', sitemap: false, ignoreKeys: 'k', ...c });
  }, cfg);
}

/** Marker strokes currently drawn in the overlay. */
export const strokes = (page) => page.evaluate(() => {
  const r = document.querySelector('minimarker-ui').shadowRoot;
  return [...r.querySelectorAll('.marks rect')].map((e) => ({ cur: e.getAttribute('class') === 'cur', box: e.getBoundingClientRect().toJSON() }));
});
