# Verification against SPEC.md

Status as of v0.1.0 (28 September 2026). "Test" names are in `test/e2e/*.spec.js` (Playwright) and `test/unit/core.test.js` (`node --test`).

Local runs: 9 unit and 75 e2e tests pass in Chromium desktop and a Pixel 7 touch profile. CI (`.github/workflows/ci.yml`) runs the same suite in Chromium, Firefox, WebKit and an iPhone profile: 221 passed on 28 September 2026. The first CI runs found a Firefox tab-order assumption and a timing-based WebKit check in the tests, which were rewritten to be deterministic, and one real WebKit bug (a stale reduced-motion media query), which was fixed in `src/minisearch.js`.

Key: **Met** = implemented and covered by an automated test. **Met (manual)** = implemented, but needs human or device checking to fully confirm.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| F1.1 | Typing anywhere opens the box with the text | Met | `F1.1 typing on the page opens the box…`, `F1.1 typing while the idle hint has focus…` |
| F1.2 | Idle blinking cursor, optional prompt text | Met | `F1.2 idle hint shows the prompt and a cursor` |
| F1.3 | Blink stops within 5 s, none with reduced motion | Met | `F1.3 cursor blinks for at most 5 s…` |
| F1.4 | The hint is a real button | Met | `F1.4 the hint is a button that opens the search` |
| F1.5 | Not captured in fields, editable areas, widgets, dialogs, no-capture areas | Met | `F1.5 keys are not captured in …` (input, textarea, contenteditable, ARIA listbox, no-capture area, modal dialog, closed-shadow custom element) |
| F1.6 | Modifier shortcuts never captured (except AltGr) | Met | `F1.6 modifier shortcuts are never captured`. AltGr is allowed in code (`getModifierState('AltGraph')`) but can't be simulated in Playwright. |
| F1.7 | Host-handled keys and `ignoreKeys` not captured | Met | `F1.7 keys the host handled, and ignoreKeys…` |
| F1.8 | Space, `/`, `'`, IME and dead keys never taken from the page | Met | `F1.8 Space, / and ' never start a search`, `F1.8 Space is never taken from page controls…`, `NF6.3 IME composition keys…` |
| F1.9 | Real text input once open | Met | `F1.9 once open, typing goes to a real input…` |
| F2.1 | Highlight from 2 characters | Met | `F2.1 highlights start at two characters` |
| F2.2 | Case, accent and whitespace insensitive | Met | `F2.2 matching ignores case…`, `F2.2 <br> counts as whitespace`, unit `F2.2 folding…` |
| F2.3 | Scope: include/exclude, hidden text skipped | Met | `F2.3 hidden, excluded and out-of-scope text is not searched` |
| F2.4 | Matches span inline elements, not blocks | Met | `F2.4 matches span inline elements but not blocks`, `F2.4 elements styled display:block are block boundaries` |
| F2.5 | Updates when page content changes | Met | `F2.5 highlights update when page content changes` |
| F2 | DOM never modified | Met | `F2 page DOM is never modified by highlighting` |
| F3.1 | Site pages suggested, capped | Met | `F3.1/F3.2 suggestions appear and narrow…`, unit `F3.1` |
| F3.2 | Prefix matching and ranking | Met | unit `F3.2 every query word must prefix-match…` |
| F3.3 | Sections with ids suggested | Met | `F3.3 headings with ids are suggested as sections`, unit `F3.3` |
| F3.4 | Pick with keyboard, mouse or tap | Met | `F3.4 pick a suggestion with the keyboard`, `…with the mouse`, `F3.4 tapping a suggestion opens it on touch devices` |
| F3.5 | Lazy load; index, then sitemap, plus inline pages | Met | `F3.5 the index is not fetched until first use`, `F3.5 falls back to sitemap.xml…`, `F3.5/NF3 inline pages…` |
| F4.1 | Escape toggles modes | Met | `F4.1 Escape toggles between suggestions and in-page mode`, `F5 Escape from elsewhere…` |
| F4.2 | Count and current match shown | Met | `F4.2/F4.3 count and all navigation keys…` |
| F4.3 | Up/Down, Left/Right, Tab/Shift+Tab, Enter/Shift+Enter; wraps | Met | `F4.2/F4.3 …` (all 8 keys, wrap-around both ways) |
| F4.4 | Scrolls match into view above the bar, including nested scrollers; instant with reduced motion | Met | `F4.4/F4.5 the page scrolls…`, `F4.4 matches inside scroll containers…`, `F4.4 reduced motion scrolls instantly` |
| F4.5 | Current match looks different | Met | separate `minisearch-current` highlight, checked in `F4.4/F4.5` |
| F4.6 | Typing updates results in either mode | Met | `F4.6 typing keeps updating results in in-page mode` |
| F4.7 | Starts at first match in view | Met | `F4.7 entering in-page mode starts from the first match in view` |
| F5.1 | Double Esc, Esc on empty box, close button | Met | `F5.1 a quick double Escape closes`, `F5.1 Escape on an empty box closes; so does the close button` |
| F5.2 | Clears highlights, restores focus, DOM unchanged | Met | `F5.2 closing clears highlights, restores focus and leaves the DOM unchanged` |
| F6.1 | Floating button on touch devices | Met | `F6.1 a floating search button replaces the idle cursor` |
| F6.2 | Tap opens with input focused | Met | `F6.2-F6.3 tap to open…` |
| F6.3 | Big prev/next, toggle, close buttons (44 px) | Met | `F6.2-F6.3 …` (checks each button's size) |
| F6.4 | Stays above on-screen keyboard | Met (manual) | `F6.4 the bar moves up with the on-screen keyboard` simulates `visualViewport`. Needs a check on real iOS and Android devices. |
| NF1 | Drop-in, no framework | Met | One `<script defer>` tag. The fixtures and docs use nothing else. There's also an ESM build. |
| NF2 | Works on static sites | Met | The docs site is plain static HTML on GitHub Pages (`D2` tests). |
| NF3 | Configurable scope, text, theme, styling | Met | `F2.3`, `F3.5/NF3 inline pages, window config, theme and labels`, `NF3 JS API…`, `D2 theme buttons…`, custom theme demo page |
| NF4 | Never breaks the site | Met | `NF4 if the script fails to load…`, `NF4 loading the script twice…`, `NF4 an invalid selector in the config is ignored`, `NF4 re-attaches if the host page replaces <body>`, and every e2e test asserts no uncaught page errors |
| NF5 | No slowdown | Met | `defer`, 10.3 KB gzipped (the build enforces 12 KB), `F3.5` lazy loading, `NF5 no layout shift…` |
| NF6.1 | WCAG 2.2 AA | Met (manual) | Contrast unit test (both themes), `NF6.1 … 2.4.11`, `NF6.1 reflows at 320 px…`, `NF6.1 at 320/412 px every bar control is visible and clickable`, `NF6.1 label in name…`, target sizes in `F6.2-F6.3`, `F1.3`. Full AA sign-off needs manual assistive technology testing (TASKS.md). |
| NF6.2 | 2.1.4: capture can be turned off | Met | `NF6.2/NF7 capture can be turned off, and the choice is remembered` |
| NF6.3 | No interference with screen readers, find-in-page, IME, host shortcuts | Met (manual) | `F1.6`, `F1.7`, `F1.8`, `NF6.3 IME…`, `NF6.3 keys typed in the search box do not trigger host shortcuts`. Screen reader behaviour follows from design (no DOM changes; browse-mode keys never reach the page), but needs manual confirmation. |
| NF6.4 | Never traps focus | Met | `NF6.4 Tab moves focus normally unless navigating matches` |
| NF6.5 | Combobox/listbox/live region | Met | `NF6.5 combobox, listbox and live region semantics`, `F3.4` (`aria-activedescendant`) |
| NF7 | Reduced motion, colour scheme, remembered capture choice | Met | `F1.3`, `F4.4 reduced motion…`, `NF6.2/NF7…`, `prefers-color-scheme` in styles |
| NF8 | Current major browsers | Met | Full suite runs in CI in Chromium, Firefox and WebKit, plus an iPhone profile. There's a graceful fallback without the Highlight API. |
| D1 | Component published | Partly | `dist/minisearch.min.js` is committed and servable through jsDelivr from GitHub. **npm publish and the v0.1.0 tag are pending with Dave** (TASKS.md). |
| D2 | Docs with live demo | Met | Live at https://davesant.github.io/minisearch/ (9 pages), covered by `D2 …` tests. |

## Independent review

A separate review pass of the source against this spec found 10 issues. All were fixed, and each has a regression test:

- tapping a suggestion did nothing on touch devices
- bar buttons were clipped at phone widths
- closed-shadow fields were hijacked
- Space was taken from page buttons while the box was open
- `<br>` and `display:block` spans weren't treated correctly
- a replaced `<body>` broke the component
- a bad `exclude` selector broke search
- the hint's name didn't contain its visible prompt (label in name)
- malformed data could crash suggestions or the CLI

One finding was handled by documentation instead of code: the default index path is root-relative, so sites in a sub-folder need `data-index`.
