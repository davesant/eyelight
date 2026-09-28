// Desktop behaviour, one describe block per SPEC.md requirement group.
import { test, expect } from '@playwright/test';
import { load, ui, hlCount, currentText, focusedIsInput, waitEscWindow, expectClosed, HOME } from './helpers.js';

let errors;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('ms-test')) { localStorage.clear(); sessionStorage.setItem('ms-test', '1'); } } catch { /* */ } });
  errors = await load(page);
});
test.afterEach(() => { expect(errors, 'no uncaught page errors (NF4)').toEqual([]); });

test.describe('F1 type anywhere', () => {
  test('F1.1 typing on the page opens the box with the text', async ({ page }) => {
    const u = ui(page);
    await expect(u.panel).toBeHidden();
    await page.keyboard.type('ha');
    await expect(u.panel).toBeVisible();
    await expect(u.input).toHaveValue('ha');
    expect(await focusedIsInput(page)).toBe(true);
  });

  test('F1.2 idle hint shows the prompt and a cursor', async ({ page }) => {
    const u = ui(page);
    await expect(u.hint).toBeVisible();
    await expect(u.hint).toContainText('search');
    await expect(u.hint.locator('.caret')).toBeVisible();
    await expect(u.hint).toHaveAttribute('aria-label', /start typing/i);
  });

  test('F1.3 cursor blinks for at most 5 s, and not at all with reduced motion', async ({ page }) => {
    const caret = ui(page).hint.locator('.caret');
    const anim = () => caret.evaluate((c) => { const s = getComputedStyle(c); return [s.animationName, s.animationIterationCount, s.animationDuration]; });
    expect(await anim()).toEqual(['ms-blink', '5', '1s']);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect((await anim())[0]).toBe('none');
  });

  test('F1.4 the hint is a button that opens the search', async ({ page }) => {
    const u = ui(page);
    await u.hint.click();
    await expect(u.panel).toBeVisible();
    expect(await focusedIsInput(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expectClosed(page);
    await u.hint.focus();
    await page.keyboard.press('Enter');
    await expect(u.panel).toBeVisible();
  });

  for (const [name, sel] of [['input', '#field'], ['textarea', '#ta'], ['contenteditable', '#ce'], ['ARIA listbox', '#lb'], ['no-capture area', '#ncbtn']]) {
    test(`F1.5 keys are not captured in ${name}`, async ({ page }) => {
      await page.focus(sel);
      await page.keyboard.type('ab');
      await expect(ui(page).panel).toBeHidden();
    });
  }

  test('F1.5 keys are not captured while a modal dialog is open', async ({ page }) => {
    await page.evaluate(() => document.getElementById('dlg').showModal());
    await page.keyboard.type('ab');
    await expect(ui(page).panel).toBeHidden();
  });

  test('F1.5 keys are not captured in custom elements with closed shadow roots', async ({ page }) => {
    await page.focus('#cf');
    await page.keyboard.type('ab');
    await expect(ui(page).panel).toBeHidden();
  });

  test('F1.8 Space is never taken from page controls, even while the box is open', async ({ page }) => {
    await page.evaluate(() => { const b = document.getElementById('btn'); b.addEventListener('click', () => { b.dataset.clicked = '1'; }); });
    await page.keyboard.type('harmonica');
    await page.focus('#btn');
    await page.keyboard.press('Space');
    await expect(page.locator('#btn')).toHaveAttribute('data-clicked', '1');
    await expect(ui(page).input).toHaveValue('harmonica');
  });

  test('F1.6 modifier shortcuts are never captured', async ({ page }) => {
    await page.focus('#btn');
    for (const k of ['Control+b', 'Alt+b', 'Meta+b', 'Control+Shift+b']) await page.keyboard.press(k);
    await expect(ui(page).panel).toBeHidden();
  });

  test('F1.7 keys the host handled, and ignoreKeys, are not captured', async ({ page }) => {
    await page.keyboard.press('j');
    await page.keyboard.press('k');
    await expect(ui(page).panel).toBeHidden();
    expect(await page.evaluate(() => window.hostKeys)).toEqual(['j']);
  });

  test('F1.8 Space, / and \' never start a search', async ({ page }) => {
    const before = await page.evaluate(() => window.scrollY);
    for (const k of ['Space', 'Slash', 'Quote']) await page.keyboard.press(k);
    await expect(ui(page).panel).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before); // Space still scrolled the page
  });

  test('F1.1 typing while the idle hint has focus also opens search', async ({ page }) => {
    await ui(page).hint.focus();
    await page.keyboard.type('ha');
    await expect(ui(page).input).toHaveValue('ha');
  });

  test('NF6.3 IME composition keys are never captured', async ({ page }) => {
    await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', isComposing: true, bubbles: true, cancelable: true })));
    await expect(ui(page).panel).toBeHidden();
  });

  test('NF6.3 keys typed in the search box do not trigger host shortcuts', async ({ page }) => {
    await page.keyboard.type('a');
    await page.keyboard.type('jjj');
    await expect(ui(page).input).toHaveValue('ajjj');
    expect(await page.evaluate(() => window.hostKeys)).toEqual([]);
  });

  test('F1.9 once open, typing goes to a real input (spaces, backspace, select-all)', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('hello wx');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('orld');
    await expect(u.input).toHaveValue('hello world');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('cafe');
    await expect(u.input).toHaveValue('cafe');
  });
});

test.describe('F2 highlight search', () => {
  test('F2.1 highlights start at two characters', async ({ page }) => {
    await page.keyboard.type('h');
    expect(await hlCount(page)).toBe(0);
    await page.keyboard.type('armonica');
    await expect.poll(() => hlCount(page)).toBe(4);
  });

  test('F2.2 matching ignores case, accents and whitespace', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('CAFE');
    await expect(u.count).toHaveText('1 on page');
    await u.input.fill('hello world');
    await expect(u.count).toHaveText('1 on page');
  });

  test('F2.3 hidden, excluded and out-of-scope text is not searched', async ({ page }) => {
    const u = ui(page);
    for (const w of ['hiddenword', 'ignoredword', 'navonlyword', 'search']) {
      await u.hint.isVisible() ? await page.keyboard.type(w) : await u.input.fill(w);
      await expect(u.count).toHaveText('No matches');
    }
  });

  test('F2.4 matches span inline elements but not blocks', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('foobar');
    await expect(u.count).toHaveText('1 on page');
    await u.input.fill('blockone blocktwo');
    await expect(u.count).toHaveText('No matches');
  });

  test('F2.2 <br> counts as whitespace', async ({ page }) => {
    await page.keyboard.type('wombat quokka');
    await expect(ui(page).count).toHaveText('1 on page');
    await ui(page).input.fill('wombatquokka');
    await expect(ui(page).count).toHaveText('No matches');
  });

  test('F2.4 elements styled display:block are block boundaries', async ({ page }) => {
    await page.keyboard.type('alphawordbetaword');
    await expect(ui(page).count).toHaveText('No matches');
  });

  test('F2.5 highlights update when page content changes', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('zebra');
    await expect(u.count).toHaveText('No matches');
    await page.evaluate(() => { const p = document.createElement('p'); p.textContent = 'a zebra appears'; document.querySelector('main').prepend(p); });
    await expect(u.count).toHaveText('1 on page');
  });

  test('F2 page DOM is never modified by highlighting', async ({ page }) => {
    const before = await page.evaluate(() => document.querySelector('main').innerHTML);
    await page.keyboard.type('harmonica');
    await expect.poll(() => hlCount(page)).toBe(4);
    expect(await page.evaluate(() => document.querySelector('main').innerHTML)).toBe(before);
  });
});

test.describe('F3 predictive search', () => {
  test('F3.5 the index is not fetched until first use', async ({ page }) => {
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.reload();
    await page.waitForFunction(() => window.Minisearch && window.Minisearch.element);
    await page.waitForTimeout(300);
    expect(reqs.filter((u) => u.includes('minisearch-index'))).toEqual([]);
    await page.keyboard.type('tu');
    await expect.poll(() => reqs.filter((u) => u.includes('minisearch-index')).length).toBe(1);
  });

  test('F3.1/F3.2 suggestions appear and narrow as you type', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('gui');
    await expect(u.options.first()).toContainText('Guide');
    await page.keyboard.type('xyz');
    await expect(u.list).toBeHidden();
    await u.input.fill('tuning');
    await expect(u.options.first()).toContainText('Tuning your harmonica');
    await expect(u.options.first().locator('mark')).toHaveText('Tuning');
  });

  test('F3.3 headings with ids are suggested as sections', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('flatten');
    await expect(u.options.first()).toContainText('Flattening a reed');
    await expect(u.options.first().locator('.s')).toHaveText('Tuning your harmonica');
  });

  test('F3.4 pick a suggestion with the keyboard', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('flatten');
    await expect(u.options.first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(u.input).toHaveAttribute('aria-activedescendant', 'ms-o0');
    await expect(u.options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await page.waitForURL(/guide\/tuning\.html#flatten$/);
  });

  test('F3.4 pick a suggestion with the mouse', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('bending');
    await u.options.first().click();
    await page.waitForURL(/guide\/#basics$/);
  });

  test('F3.5 falls back to sitemap.xml (same-origin URLs only)', async ({ page }) => {
    await load(page, `${HOME}sitemap-only.html`);
    const u = ui(page);
    await page.keyboard.type('getting');
    await expect(u.options.first()).toContainText('Getting started');
    await u.input.fill('page');
    await expect(u.list).toBeHidden(); // elsewhere.example/page is ignored
  });

  test('F3.5/NF3 inline pages, window config, theme and labels', async ({ page }) => {
    await load(page, `${HOME}inline.html`);
    const u = ui(page);
    await expect(u.host).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.type('band');
    await expect(u.options.first()).toContainText('About the band');
    await expect(u.close).toHaveAttribute('aria-label', 'Shut');
  });
});

test.describe('F4 in-page navigation', () => {
  test('F4.1 Escape toggles between suggestions and in-page mode', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await expect(u.options.first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'true');
    await expect(u.list).toBeHidden();
    await waitEscWindow(page);
    await page.keyboard.press('Escape');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
    await expect(u.options.first()).toBeVisible();
  });

  test('F4.2/F4.3 count and all navigation keys, with wrap-around', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await expect(u.count).toHaveText('4 on page');
    await page.keyboard.press('Escape');
    await expect(u.count).toHaveText('1 of 4');
    const steps = [['ArrowDown', '2'], ['ArrowRight', '3'], ['Tab', '4'], ['Enter', '1'], ['Shift+Tab', '4'], ['ArrowUp', '3'], ['ArrowLeft', '2'], ['Shift+Enter', '1']];
    for (const [key, n] of steps) {
      await page.keyboard.press(key);
      await expect(u.count, key).toHaveText(`${n} of 4`);
    }
    expect(await focusedIsInput(page)).toBe(true);
  });

  test('F4.4/F4.5 the page scrolls the current match into view above the bar', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('farword');
    await page.keyboard.press('Escape');
    await expect(u.count).toHaveText('1 of 1');
    expect(await currentText(page)).toBe('farword');
    await expect.poll(async () => page.evaluate(() => {
      const r = [...CSS.highlights.get('minisearch-current')][0].getBoundingClientRect();
      const bar = document.querySelector('minisearch-ui').shadowRoot.querySelector('.panel').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= bar.top;
    })).toBe(true);
  });

  test('F4.4 matches inside scroll containers are scrolled into view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.type('deepword');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => {
      const s = document.getElementById('scroller');
      const r = [...CSS.highlights.get('minisearch-current')][0].getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return s.scrollTop > 0 && r.top >= sr.top && r.bottom <= sr.bottom && r.top >= 0 && r.bottom <= innerHeight;
    })).toBe(true);
  });

  test('F4.4 reduced motion scrolls instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.type('farword');
    await page.keyboard.press('Escape');
    const y1 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(700);
    const y2 = await page.evaluate(() => window.scrollY);
    expect(y1).toBeGreaterThan(0);
    expect(y2).toBe(y1);
  });

  test('F4.6 typing keeps updating results in in-page mode', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harm');
    await page.keyboard.press('Escape');
    await expect(u.count).toHaveText('1 of 4');
    await page.keyboard.type('onica players');
    await expect(u.count).toHaveText('1 of 1');
  });

  test('F4.7 entering in-page mode starts from the first match in view', async ({ page }) => {
    const u = ui(page);
    await page.evaluate(() => document.getElementById('far').scrollIntoView({ block: 'center' }));
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Escape');
    await expect(u.count).toHaveText('4 of 4');
  });

  test('F4 prev/next buttons work with the mouse and keep focus in the input', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await u.next.click();
    await expect(u.count).toHaveText('1 of 4');
    await u.next.click();
    await expect(u.count).toHaveText('2 of 4');
    await u.prev.click();
    await expect(u.count).toHaveText('1 of 4');
    expect(await focusedIsInput(page)).toBe(true);
  });
});

test.describe('F5 exit', () => {
  test('F5.1 a quick double Escape closes', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('F5.1 Escape on an empty box closes; so does the close button', async ({ page }) => {
    const u = ui(page);
    await u.hint.click();
    await page.keyboard.press('Escape');
    await expectClosed(page);
    await page.keyboard.type('ha');
    await u.close.click();
    await expectClosed(page);
  });

  test('F5.2 closing clears highlights, restores focus and leaves the DOM unchanged', async ({ page }) => {
    const u = ui(page);
    const before = await page.evaluate(() => document.querySelector('main').outerHTML);
    await page.focus('#btn');
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Escape');
    await expect(u.count).toHaveText(/of 4/);
    await page.keyboard.press('Escape');
    await expectClosed(page);
    expect(await hlCount(page)).toBe(0);
    expect(await page.evaluate(() => CSS.highlights.has('minisearch-current'))).toBe(false);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('btn');
    await expect(u.input).toHaveValue('');
    await expect(u.hint).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('main').outerHTML)).toBe(before);
  });

  test('F5 Escape from elsewhere on the page also toggles/closes', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.focus('#btn');
    await page.keyboard.press('Escape');
    await expect(ui(page).mode).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });
});

test.describe('NF accessibility and robustness', () => {
  test('NF6.2/NF7 capture can be turned off, and the choice is remembered', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('x');
    await expect(u.cap).toHaveAttribute('aria-pressed', 'true');
    await u.cap.click();
    await expect(u.cap).toHaveAttribute('aria-pressed', 'false');
    await expect(u.cap).toHaveText('Type-to-search: off');
    await u.close.click();
    await expect(u.hint).toHaveAttribute('aria-label', 'Search this site');
    await expect(u.hint.locator('.caret')).toHaveCount(0);
    await page.focus('#btn');
    await page.keyboard.type('ab');
    await expectClosed(page);
    // Remembered across reloads (don't clear storage this time)
    await page.goto('about:blank');
    await page.goto(HOME);
    await page.waitForFunction(() => window.Minisearch && window.Minisearch.element);
    await page.keyboard.type('ab');
    await expectClosed(page);
    // Clicking the hint still opens search; turning capture back on works
    await u.hint.click();
    await u.cap.click();
    await u.close.click();
    await page.keyboard.type('ab');
    await expect(u.panel).toBeVisible();
  });

  test('NF6.4 Tab moves focus normally unless navigating matches', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('zzqq');
    await page.keyboard.press('Tab');
    expect(await focusedIsInput(page)).toBe(false);
    await u.input.focus();
    await page.keyboard.press('Escape'); // page mode, but no matches
    await page.keyboard.press('Tab');
    expect(await focusedIsInput(page)).toBe(false);
    // Tabbing all the way through leaves the component
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).not.toBe('MINISEARCH-UI');
  });

  test('NF6.5 combobox, listbox and live region semantics', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('tuning');
    await expect(u.input).toHaveAttribute('role', 'combobox');
    await expect(u.input).toHaveAttribute('aria-expanded', 'true');
    await expect(u.list).toHaveAttribute('role', 'listbox');
    await expect(u.options.first()).toHaveAttribute('role', 'option');
    await expect(u.live).toHaveText(/on this page|No matches/);
    await expect(page.getByRole('search', { name: 'Search this site and page' })).toBeVisible();
    for (const b of [u.prev, u.next, u.close]) await expect(b).toHaveAttribute('aria-label', /.+/);
  });

  test('NF6.1 the idle hint hides rather than covering the focused element (2.4.11)', async ({ page }) => {
    const u = ui(page);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'under'; b.textContent = 'under the hint';
      b.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%)';
      document.body.append(b);
    });
    await page.focus('#under');
    await expect(u.hint).toHaveClass(/obscuring/);
    await page.focus('#btn');
    await expect(u.hint).not.toHaveClass(/obscuring/);
  });

  test('NF6.1 label in name: the hint accessible name contains its visible prompt', async ({ page }) => {
    await load(page, `${HOME}inline.html`); // no prompt
    await page.evaluate(() => { window.Minisearch.destroy(); window.Minisearch.init({ prompt: 'type to search', index: false, sitemap: false }); });
    await expect(ui(page).hint).toHaveAttribute('aria-label', /^type to search - /);
  });

  for (const width of [320, 412]) {
    test(`NF6.1 at ${width} px every bar control is visible and clickable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.keyboard.type('harmonica');
      const u = ui(page);
      for (const b of [u.prev, u.next, u.mode, u.close, u.cap]) {
        const hit = await b.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const panel = el.getRootNode().querySelector('.panel').getBoundingClientRect();
          const at = el.getRootNode().elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return r.left >= panel.left && r.right <= panel.right && (at === el || el.contains(at));
        });
        expect(hit).toBe(true);
      }
    });
  }

  test('NF4 an invalid selector in the config is ignored', async ({ page }) => {
    await page.evaluate(() => { window.Minisearch.destroy(); window.Minisearch.init({ exclude: '[[bad', noCapture: '::nope(', index: false, sitemap: false }); });
    await page.keyboard.type('harmonica');
    await expect(ui(page).count).toHaveText('4 on page');
  });

  test('NF4 re-attaches if the host page replaces <body>', async ({ page }) => {
    await page.evaluate(() => { const b = document.createElement('body'); b.innerHTML = '<main><p>fresh harmonica page</p></main>'; document.body.replaceWith(b); });
    await expect(page.locator('minisearch-ui')).toHaveCount(1);
    await page.keyboard.type('harmonica');
    await expect(ui(page).count).toHaveText('1 on page');
  });

  test('NF6.1 reflows at 320 px wide without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.keyboard.type('harmonica');
    const box = await ui(page).panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test('NF4 loading the script twice creates one component', async ({ page }) => {
    await load(page, `${HOME}double.html`);
    expect(await page.locator('minisearch-ui').count()).toBe(1);
    await page.keyboard.type('harmonica');
    await expect(ui(page).count).toHaveText('1 on page');
  });

  test('NF4 if the script fails to load, the page still works', async ({ page }) => {
    await page.goto(`${HOME}broken.html`);
    await page.click('#b');
    await expect(page.locator('#b')).toHaveText('clicked');
    await page.fill('#f', 'typing works');
    await expect(page.locator('#f')).toHaveValue('typing works');
    await page.keyboard.press('Escape');
  });

  test('NF5 no layout shift: the component sits outside the page flow', async ({ page }) => {
    const pos = await page.evaluate(() => getComputedStyle(document.querySelector('minisearch-ui')).position);
    expect(pos).toBe('fixed');
  });

  test('NF3 JS API: open with a query, setTheme, close', async ({ page }) => {
    const u = ui(page);
    await page.evaluate(() => window.Minisearch.open('harmonica'));
    await expect(u.count).toHaveText('4 on page');
    await page.evaluate(() => window.Minisearch.setTheme('dark'));
    await expect(u.host).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => window.Minisearch.close());
    await expectClosed(page);
  });
});
