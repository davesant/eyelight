// Desktop behaviour, one describe block per SPEC.md requirement group.
import { test, expect } from '@playwright/test';
import { load, ui, hlCount, currentText, focusedIsInput, waitEscWindow, expectClosed, HOME, reinit, strokes } from './helpers.js';
import { decodePng } from './png.js';

let errors;
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('el-test')) { localStorage.clear(); sessionStorage.setItem('el-test', '1'); } } catch { /* */ } });
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
    expect(await anim()).toEqual(['el-blink', '5', '1s']);
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
    await expect(u.count).toHaveText('1 of 1');
    await u.input.fill('hello world');
    await expect(u.count).toHaveText('1 of 1');
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
    await expect(u.count).toHaveText('1 of 1');
    await u.input.fill('blockone blocktwo');
    await expect(u.count).toHaveText('No matches');
  });

  test('F2.2 <br> counts as whitespace', async ({ page }) => {
    await page.keyboard.type('wombat quokka');
    await expect(ui(page).count).toHaveText('1 of 1');
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
    await expect(u.count).toHaveText('1 of 1');
  });

  test('F2 page DOM is never modified by highlighting', async ({ page }) => {
    const before = await page.evaluate(() => document.querySelector('main').innerHTML);
    await page.keyboard.type('harmonica');
    await expect.poll(() => hlCount(page)).toBe(4);
    expect(await page.evaluate(() => document.querySelector('main').innerHTML)).toBe(before);
  });
});

test.describe('F3 predictive search', () => {
  test('F3.5 the index is not fetched until the first Enter', async ({ page }) => {
    const reqs = [];
    page.on('request', (r) => reqs.push(r.url()));
    await page.reload();
    await page.waitForFunction(() => window.Minimarker && window.Minimarker.element);
    await page.keyboard.type('tu');
    await page.waitForTimeout(300);
    expect(reqs.filter((u) => u.includes('minimarker-index'))).toEqual([]);
    await expect(ui(page).list).toBeHidden(); // F3.0 no site pages while typing
    await page.keyboard.press('Enter');
    await expect.poll(() => reqs.filter((u) => u.includes('minimarker-index')).length).toBe(1);
  });

  test('F3.0/F3.1/F3.2 Enter shows site pages, which narrow as you type', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('gui');
    await expect(u.list).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(u.options.first()).toContainText('Guide');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.type('xyz');
    await expect(u.list).toBeHidden();
    await u.input.fill('tuning');
    await expect(u.options.first()).toContainText('Tuning your harmonica');
    await expect(u.options.first().locator('mark')).toHaveText('Tuning');
  });

  test('F3.6 Enter with no matching pages says so', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('zzqq');
    await page.keyboard.press('Enter');
    await expect(u.host.locator('.empty')).toHaveText('No matching pages');
    await u.input.fill('tuning');
    await expect(u.host.locator('.empty')).toBeHidden();
    await expect(u.options.first()).toBeVisible();
  });

  test('F3.3 headings with ids are suggested as sections', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('flatten');
    await page.keyboard.press('Enter');
    await expect(u.options.first()).toContainText('Flattening a reed');
    await expect(u.options.first().locator('.s')).toHaveText('Tuning your harmonica');
  });

  test('F3.4 pick a suggestion with the keyboard', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('flatten');
    await page.keyboard.press('Enter');
    await expect(u.options.first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(u.input).toHaveAttribute('aria-activedescendant', 'el-o0');
    await expect(u.options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await page.waitForURL(/guide\/tuning\.html#flatten$/);
  });

  test('F3.4 Enter twice opens the first suggestion', async ({ page }) => {
    await page.keyboard.type('flatten');
    await page.keyboard.press('Enter');
    await expect(ui(page).options.first()).toBeVisible();
    await page.keyboard.press('Enter');
    await page.waitForURL(/guide\/tuning\.html#flatten$/);
  });

  test('F3.4 pick a suggestion with the mouse', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('bending');
    await page.keyboard.press('Enter');
    await u.options.first().click();
    await page.waitForURL(/guide\/#basics$/);
  });

  test('F3.5 falls back to sitemap.xml (same-origin URLs only)', async ({ page }) => {
    await load(page, `${HOME}sitemap-only.html`);
    const u = ui(page);
    await page.keyboard.type('getting');
    await page.keyboard.press('Enter');
    await expect(u.options.first()).toContainText('Getting started');
    await u.input.fill('page');
    await expect(u.list).toBeHidden(); // elsewhere.example/page is ignored
  });

  test('F3.5/NF3 inline pages, window config, theme and labels', async ({ page }) => {
    await load(page, `${HOME}inline.html`);
    const u = ui(page);
    await expect(u.host).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.type('band');
    await page.keyboard.press('Enter');
    await expect(u.options.first()).toContainText('About the band');
    await expect(u.close).toHaveAttribute('aria-label', 'Shut');
  });
});

test.describe('F4 in-page navigation', () => {
  test('F4.1 Enter switches to site pages and Escape comes back to page matches', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'true'); // starts in in-page mode
    await page.keyboard.press('Enter');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
    await expect(u.options.first()).toBeVisible();
    await waitEscWindow(page);
    await page.keyboard.press('Escape');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'true');
    await expect(u.list).toBeHidden();
    await expect(u.panel).toBeVisible();
  });

  test('F4.2/F4.3 count and all navigation keys, with wrap-around', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await expect(u.count).toHaveText('1 of 4'); // F4.7 the first match is picked as you type
    const steps = [['ArrowDown', '2'], ['ArrowRight', '3'], ['Tab', '4'], ['ArrowDown', '1'], ['Shift+Tab', '4'], ['ArrowUp', '3'], ['ArrowLeft', '2'], ['Shift+Enter', '1']];
    for (const [key, n] of steps) {
      await page.keyboard.press(key);
      await expect(u.count, key).toHaveText(`${n} of 4`);
    }
    expect(await focusedIsInput(page)).toBe(true);
  });

  test('F4.3 Shift+Left/Right select text instead of moving; Shift+Enter never opens a page', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(u.count).toHaveText('1 of 4');
    expect(await u.input.evaluate((i) => i.selectionEnd - i.selectionStart)).toBe(1);
    await page.keyboard.press('Enter');
    await expect(u.options.first()).toBeVisible();
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(200);
    expect(page.url()).toMatch(/fixtures\/site\/$/);
  });

  test('F4.4/F4.5 the page scrolls the current match into view above the bar', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('farword');
    await expect(u.count).toHaveText('1 of 1');
    expect(await currentText(page)).toBe('farword');
    await expect.poll(async () => page.evaluate(() => {
      const r = [...CSS.highlights.get('minimarker-current')][0].getBoundingClientRect();
      const bar = document.querySelector('minimarker-ui').shadowRoot.querySelector('.panel').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= bar.top;
    })).toBe(true);
  });

  test('F4.4 matches inside scroll containers are scrolled into view', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.type('deepword');
    await expect.poll(() => page.evaluate(() => {
      const s = document.getElementById('scroller');
      const r = [...CSS.highlights.get('minimarker-current')][0].getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return s.scrollTop > 0 && r.top >= sr.top && r.bottom <= sr.bottom && r.top >= 0 && r.bottom <= innerHeight;
    })).toBe(true);
  });

  test('F4.4 reduced motion scrolls instantly', async ({ page }) => {
    // Record the behaviour Minimarker asks for, rather than timing the scroll (which is flaky).
    await page.evaluate(() => {
      window.scrollCalls = [];
      const orig = window.scrollBy.bind(window);
      window.scrollBy = (...a) => { window.scrollCalls.push(a[0] && a[0].behavior); return orig(...a); };
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.type('farword');
    await expect.poll(() => page.evaluate(() => window.scrollCalls)).toContain('instant');
    expect(await page.evaluate(() => window.scrollCalls)).not.toContain('smooth');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.keyboard.press('ArrowUp'); // wraps to the same single match, which is already in view
    await page.evaluate(() => { window.scrollCalls = []; window.scrollTo(0, 0); });
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => window.scrollCalls)).toContain('smooth');
  });

  test('F4.6 typing keeps updating results in in-page mode', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harm');
    await expect(u.count).toHaveText('1 of 4');
    await page.keyboard.type('onica players');
    await expect(u.count).toHaveText('1 of 1');
  });

  test('F4.7 typing starts from the first match in view', async ({ page }) => {
    const u = ui(page);
    await page.evaluate(() => document.getElementById('far').scrollIntoView({ block: 'center' }));
    await page.keyboard.type('harmonica');
    await expect(u.count).toHaveText('4 of 4');
  });

  test('F4 prev/next buttons work with the mouse and keep focus in the input', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await expect(u.count).toHaveText('1 of 4');
    await u.next.click();
    await expect(u.count).toHaveText('2 of 4');
    await u.next.click();
    await expect(u.count).toHaveText('3 of 4');
    await u.prev.click();
    await expect(u.count).toHaveText('2 of 4');
    expect(await focusedIsInput(page)).toBe(true);
  });
});

test.describe('F5 exit', () => {
  test('F5.1 Escape in in-page mode closes', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });

  test('F5.1 from site pages, a quick double Escape closes', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Enter');
    await expect(ui(page).options.first()).toBeVisible();
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
    await expect(u.count).toHaveText(/of 4/);
    expect((await strokes(page)).length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expectClosed(page);
    expect(await hlCount(page)).toBe(0);
    expect(await page.evaluate(() => CSS.highlights.has('minimarker-current'))).toBe(false);
    expect(await strokes(page)).toEqual([]);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('btn');
    await expect(u.input).toHaveValue('');
    await expect(u.hint).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('main').outerHTML)).toBe(before);
  });

  test('F5 Escape from elsewhere on the page also steps back and closes', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Enter');
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
    await page.waitForFunction(() => window.Minimarker && window.Minimarker.element);
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
    const activeId = () => page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.type('zzqq'); // page mode, but no matches: Tab is not intercepted
    await page.keyboard.press('Tab');
    expect(await focusedIsInput(page)).toBe(false);
    await u.input.focus();
    await page.keyboard.press('Shift+Tab');
    expect(await activeId()).toBe('lastbtn'); // left the component for the page
    // With matches, Tab steps through them; in site pages mode Tab moves focus normally
    await u.input.focus();
    await u.input.fill('harmonica');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'true'); // still in page mode
    await page.keyboard.press('Tab');
    await expect(u.count).toHaveText('2 of 4');
    await page.keyboard.press('Enter');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Shift+Tab');
    expect(await activeId()).toBe('lastbtn');
  });

  test('NF6.5 combobox, listbox and live region semantics', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('tuning');
    await page.keyboard.press('Enter');
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
      b.style.cssText = 'position:fixed;bottom:20px;left:20px'; // under the bottom-left hint
      document.body.append(b);
    });
    await page.focus('#under');
    await expect(u.hint).toHaveClass(/obscuring/);
    await page.focus('#btn');
    await expect(u.hint).not.toHaveClass(/obscuring/);
  });

  test('NF6.1 label in name: the hint accessible name contains its visible prompt', async ({ page }) => {
    await load(page, `${HOME}inline.html`); // no prompt
    await page.evaluate(() => { window.Minimarker.destroy(); window.Minimarker.init({ prompt: 'type to search', index: false, sitemap: false }); });
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
    await page.evaluate(() => { window.Minimarker.destroy(); window.Minimarker.init({ exclude: '[[bad', noCapture: '::nope(', index: false, sitemap: false }); });
    await page.keyboard.type('harmonica');
    await expect(ui(page).count).toHaveText('1 of 4');
  });

  test('NF4 re-attaches if the host page replaces <body>', async ({ page }) => {
    await page.evaluate(() => { const b = document.createElement('body'); b.innerHTML = '<main><p>fresh harmonica page</p></main>'; document.body.replaceWith(b); });
    await expect(page.locator('minimarker-ui')).toHaveCount(1);
    await page.keyboard.type('harmonica');
    await expect(ui(page).count).toHaveText('1 of 1');
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
    expect(await page.locator('minimarker-ui').count()).toBe(1);
    await page.keyboard.type('harmonica');
    await expect(ui(page).count).toHaveText('1 of 1');
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
    const st = await page.evaluate(() => {
      const h = document.querySelector('minimarker-ui');
      return [getComputedStyle(h).display, ...['.wrap', '.marks'].map((s) => getComputedStyle(h.shadowRoot.querySelector(s)).position)];
    });
    expect(st).toEqual(['contents', 'fixed', 'absolute']);
    const size = () => page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    const before = await size();
    await page.keyboard.type('harmonica');
    await expect.poll(async () => (await strokes(page)).length).toBeGreaterThan(0);
    expect(await size()).toEqual(before); // marker strokes don't grow the page
  });

  test('NF3 JS API: open with a query, setTheme, close', async ({ page }) => {
    const u = ui(page);
    await page.evaluate(() => window.Minimarker.open('harmonica'));
    await expect(u.count).toHaveText('1 of 4');
    await page.evaluate(() => window.Minimarker.setTheme('dark'));
    await expect(u.host).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => window.Minimarker.close());
    await expectClosed(page);
  });
});

test.describe('Layout, cursor and marker defaults', () => {
  test('NF3 position: the hint and the bar sit at the bottom left by default', async ({ page }) => {
    const u = ui(page);
    const vp = page.viewportSize();
    const h = await u.hint.boundingBox();
    expect(h.x).toBeCloseTo(16, 0);
    expect(vp.height - (h.y + h.height)).toBeCloseTo(16, 0);
    await page.keyboard.type('ha');
    const p = await u.panel.boundingBox();
    expect(p.x).toBeCloseTo(16, 0);
  });

  test('NF3 position: center and right move the hint and the bar', async ({ page }) => {
    const u = ui(page);
    const vp = page.viewportSize();
    await reinit(page, { position: 'center' });
    let h = await u.hint.boundingBox();
    expect(Math.abs(h.x + h.width / 2 - vp.width / 2)).toBeLessThan(2);
    await page.keyboard.type('ha');
    let p = await u.panel.boundingBox();
    expect(Math.abs(p.x + p.width / 2 - vp.width / 2)).toBeLessThan(2);
    await reinit(page, { position: 'right' });
    h = await u.hint.boundingBox();
    expect(vp.width - (h.x + h.width)).toBeCloseTo(16, 0);
    await page.keyboard.type('ha');
    p = await u.panel.boundingBox();
    expect(vp.width - (p.x + p.width)).toBeCloseTo(16, 0);
  });

  test('F1.10 the idle cursor and the text cursor are terminal-style blocks', async ({ page }) => {
    const u = ui(page);
    const caretW = await u.hint.locator('.caret').evaluate((c) => c.getBoundingClientRect().width / parseFloat(getComputedStyle(c).fontSize));
    expect(caretW).toBeGreaterThan(0.5);
    await page.keyboard.type('ha');
    const bc = u.host.locator('.bcaret');
    await expect(bc).toBeVisible();
    expect(await u.input.evaluate((i) => getComputedStyle(i).caretColor)).toBe('rgba(0, 0, 0, 0)');
    const at = () => bc.evaluate((b) => b.getBoundingClientRect().left);
    const x1 = await at();
    await page.keyboard.type('rmonica');
    await expect.poll(at).toBeGreaterThan(x1 + 20); // follows the end of the text
    const end = await at();
    await page.keyboard.press('Home');
    await expect.poll(at).toBeLessThan(x1);
    await expect(bc).toHaveText('h'); // sits over the character under the cursor
    await page.keyboard.press('End');
    await expect.poll(at).toBeCloseTo(end, 0);
    await page.keyboard.press('Shift+Home'); // a selection shows instead of the block
    await expect(bc).toBeHidden();
    await page.focus('#btn');
    await expect(bc).toBeHidden();
  });

  test('F1.10 the block cursor follows ::part(input) font styling', async ({ page }) => {
    await page.addStyleTag({ content: 'minimarker-ui::part(input){font-family:monospace;font-size:24px;letter-spacing:4px}' });
    await page.keyboard.type('harmonica');
    const gap = () => page.evaluate(() => {
      const r = document.querySelector('minimarker-ui').shadowRoot;
      const i = r.querySelector('input');
      const c = r.querySelector('.bcaret').getBoundingClientRect();
      const probe = document.createElement('span');
      probe.style.cssText = 'font:24px monospace;letter-spacing:4px;white-space:pre;position:absolute';
      probe.textContent = i.value;
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return c.left - (i.getBoundingClientRect().left + parseFloat(getComputedStyle(i).paddingLeft) + w);
    });
    await expect.poll(async () => Math.abs(await gap())).toBeLessThan(3);
  });

  test('F1.10 caret: bar gives a thin line and the native text cursor', async ({ page }) => {
    const u = ui(page);
    await reinit(page, { caret: 'bar' });
    const w = await u.hint.locator('.caret').evaluate((c) => c.getBoundingClientRect().width);
    expect(w).toBeLessThanOrEqual(3);
    await page.keyboard.type('ha');
    await expect(u.host.locator('.bcaret')).toBeHidden();
    expect(await u.input.evaluate((i) => getComputedStyle(i).caretColor)).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('F1.10 the block cursor blinks for at most 5 s, and not at all with reduced motion', async ({ page }) => {
    await page.keyboard.type('ha');
    const bc = ui(page).host.locator('.bcaret');
    const anim = () => bc.evaluate((c) => { const s = getComputedStyle(c); return [s.animationName, s.animationIterationCount]; });
    expect(await anim()).toEqual(['el-blink', '5']);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect((await anim())[0]).toBe('none');
  });

  test('F2.6 matches are drawn as marker strokes over the text, current one distinct', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await expect.poll(async () => (await strokes(page)).length).toBeGreaterThanOrEqual(3);
    const s = await strokes(page);
    expect(s.filter((m) => m.cur)).toHaveLength(1);
    const st = await page.evaluate(() => {
      const r = document.querySelector('minimarker-ui').shadowRoot;
      const rect = r.querySelector('.marks rect:not(.cur)');
      return {
        blend: getComputedStyle(r.querySelector('.marks')).mixBlendMode,
        filter: rect.getAttribute('filter'),
        hasFilter: !!r.getElementById('el-mf'),
        fill: getComputedStyle(rect).fill,
        cur: getComputedStyle(r.querySelector('.marks rect.cur')).fill,
        style: document.querySelector('style[data-minimarker]').textContent,
      };
    });
    expect(st).toMatchObject({ blend: 'multiply', filter: 'url(#el-mf)', hasFilter: true, fill: 'rgb(255, 109, 183)', cur: 'rgb(255, 164, 46)' });
    expect(st.style.trim()).toMatch(/^@media \(forced-colors:active\)\{[^{}]*(\{[^{}]*\}[^{}]*)*\}$/); // flat highlight only in forced colours
    // Each stroke covers its match: 0.25em wider at each end, about 1em tall
    const m = await page.evaluate(() => [...CSS.highlights.get('minimarker-current')][0].getBoundingClientRect().toJSON());
    const cur = s.find((x) => x.cur).box;
    expect(cur.left).toBeLessThan(m.left);
    expect(cur.right).toBeGreaterThan(m.right);
    expect(cur.top).toBeGreaterThanOrEqual(m.top - 12);
    expect(cur.bottom).toBeLessThanOrEqual(m.bottom + 12);
  });

  test('F2.6 marker strokes look hand-drawn and keep the text readable (pixels)', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.keyboard.press('ArrowDown'); // current moves to match 2, so match 1 is a pink stroke
    await expect(ui(page).count).toHaveText('2 of 4');
    await page.waitForTimeout(100);
    const m = await page.evaluate(() => [...CSS.highlights.get('minimarker')][0].getBoundingClientRect().toJSON());
    const img = decodePng(await page.screenshot({ clip: { x: m.left - 12, y: m.top - 6, width: m.width + 24, height: m.height + 12 } }));
    let pink = 0;
    let dark = 0;
    const lefts = [];
    for (let y = 0; y < img.height; y++) {
      let first = -1;
      for (let x = 0; x < img.width; x++) {
        const [r, g, b] = img.px(x, y);
        if (r > 200 && g < 190 && b > 110 && r - g > 60) { pink++; if (first < 0) first = x; }
        if (r < 90 && g < 90 && b < 90) dark++;
      }
      if (first >= 0) lefts.push(first);
    }
    expect(pink).toBeGreaterThan(200); // the stroke is painted
    expect(dark).toBeGreaterThan(20); // text under it stays dark (multiply blend)
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeGreaterThanOrEqual(2); // ragged ends (turbulence filter)
  });

  test('F2.6 strokes follow scrolling and are clipped to scroll containers', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await expect.poll(async () => (await strokes(page)).length).toBeGreaterThan(0);
    const first = (await strokes(page))[0].box.top;
    await page.evaluate(() => window.scrollBy(0, 50));
    await expect.poll(async () => Math.round((await strokes(page))[0].box.top)).toBe(Math.round(first - 50));
    await ui(page).input.fill('deepword');
    await expect(ui(page).count).toHaveText('1 of 1');
    await page.evaluate(() => { document.getElementById('scroller').scrollTop = 0; });
    await expect.poll(() => strokes(page)).toEqual([]); // hidden inside the scroller, so nothing is drawn
  });

  test('F2.6 on a dark page the strokes use a dark marker with screen blending', async ({ page }) => {
    await page.evaluate(() => { document.body.style.background = '#111'; document.body.style.color = '#eee'; });
    await page.keyboard.type('harmonica');
    await expect(ui(page).host).toHaveAttribute('data-page', 'dark');
    const blend = await page.evaluate(() => getComputedStyle(document.querySelector('minimarker-ui').shadowRoot.querySelector('.marks')).mixBlendMode);
    expect(blend).toBe('screen');
  });

  test('F2.6 the page colour comes from the background behind the matches, in any colour syntax', async ({ page }) => {
    const u = ui(page);
    await page.evaluate(() => { document.body.style.background = 'oklch(0.985 0.002 247.8)'; });
    await page.keyboard.type('harmonica');
    await expect(u.host).toHaveAttribute('data-page', 'light');
    await page.evaluate(() => { document.querySelector('main').style.background = 'lab(8 0 0)'; }); // a dark wrapper
    await expect(u.host).toHaveAttribute('data-page', 'dark');
  });

  test('F2.6 strokes follow layout changes that move the text', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await expect.poll(async () => (await strokes(page)).length).toBeGreaterThan(0);
    const top = async () => (await strokes(page)).find((m) => m.cur).box.top;
    const before = await top();
    await page.evaluate(() => { document.querySelector('h1').style.marginTop = '300px'; });
    await expect.poll(top).toBeGreaterThan(before + 200);
  });

  test('F2.6 highlight: solid uses flat highlights and no strokes', async ({ page }) => {
    await reinit(page, { highlight: 'solid' });
    await page.keyboard.type('harmonica');
    await expect.poll(() => hlCount(page)).toBe(4);
    expect(await strokes(page)).toEqual([]);
    expect(await page.evaluate(() => document.querySelector('style[data-minimarker]').textContent)).toMatch(/::highlight\(minimarker\)\{background-color/);
  });
});

test.describe('startMode: suggest (suggestions while typing)', () => {
  test.beforeEach(async ({ page }) => { await reinit(page, { startMode: 'suggest' }); });

  test('F3.1 suggestions appear as you type, and the index loads on first use', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('gui');
    await expect(u.options.first()).toContainText('Guide');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
    await expect(u.count).toHaveText('No matches');
  });

  test('F4.1 Escape toggles between suggestions and in-page mode', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await expect(u.options.first()).toBeVisible();
    await expect(u.count).toHaveText('4 on page');
    await page.keyboard.press('Escape');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'true');
    await expect(u.list).toBeHidden();
    await waitEscWindow(page);
    await page.keyboard.press('Escape');
    await expect(u.mode).toHaveAttribute('aria-pressed', 'false');
    await expect(u.options.first()).toBeVisible();
  });

  test('F4.3 Enter and Shift+Enter step through matches in in-page mode', async ({ page }) => {
    const u = ui(page);
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Escape');
    await expect(u.count).toHaveText('1 of 4');
    await page.keyboard.press('Enter');
    await expect(u.count).toHaveText('2 of 4');
    await page.keyboard.press('Shift+Enter');
    await expect(u.count).toHaveText('1 of 4');
  });

  test('F5.1 a quick double Escape closes', async ({ page }) => {
    await page.keyboard.type('harmonica');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expectClosed(page);
  });
});
