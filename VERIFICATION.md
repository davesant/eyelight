# Verification against SPEC.md

Status as of v0.1.0 (28 September 2026). "Test" names are in `test/e2e/*.spec.js` (Playwright) and `test/unit/core.test.js` (`node --test`).

Local runs: 9 unit and 75 e2e tests pass in Chromium desktop and a Pixel 7 touch profile. CI (`.github/workflows/ci.yml`) runs the same suite in Chromium, Firefox, WebKit and an iPhone profile: 221 passed on 28 September 2026. The first CI runs found a Firefox tab-order assumption and a timing-based WebKit check in the tests, which were rewritten to be deterministic, and one real WebKit bug (a stale reduced-motion media query), which was fixed in `src/eyelight.js`. After the rename from Minisearch to Eyelight, the full local suite was re-run and passes.

Update, 28 September 2026 (new defaults: bottom-left bar, in-page search first, block cursor, marker highlight): 10 unit and 97 e2e tests pass locally in Chromium desktop and the Pixel 7 touch profile (also 3 repeated runs with no flakes). Firefox and WebKit run in CI. A separate review pass of the change found 16 issues. All were fixed, most with a regression test: dark or modern-syntax (oklch, lab) page backgrounds were misjudged, strokes went stale after layout-only changes, the overlay scrolled on the main thread (it now sits in page coordinates and scrolls natively), clipping used the border box, the block cursor ignored `::part(input)` fonts and didn't track drag selections, an early "0 pages" announcement, Shift+arrows and Shift+Enter handling, and an unguarded handler. Two remain as known limitations in TASKS.md: strokes are drawn over sticky or fixed page elements that cover a match, and strokes inside fixed or sticky content catch up only when scrolling stops.

Key: **Met** = implemented and covered by an automated test. **Met (manual)** = implemented, but needs human or device checking to fully confirm.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| F1.1 | Typing anywhere opens the box with the text; bottom left by default | Met | `F1.1 typing on the page opens the box…`, `F1.1 typing while the idle hint has focus…`, `NF3 position: …` (left default, center, right) |
| F1.2 | Idle blinking cursor, optional prompt text | Met | `F1.2 idle hint shows the prompt and a cursor` |
| F1.3 | Blink stops within 5 s, none with reduced motion | Met | `F1.3 cursor blinks for at most 5 s…` |
| F1.4 | The hint is a real button | Met | `F1.4 the hint is a button that opens the search` |
| F1.5 | Not captured in fields, editable areas, widgets, dialogs, no-capture areas | Met | `F1.5 keys are not captured in …` (input, textarea, contenteditable, ARIA listbox, no-capture area, modal dialog, closed-shadow custom element) |
| F1.6 | Modifier shortcuts never captured (except AltGr) | Met | `F1.6 modifier shortcuts are never captured`. AltGr is allowed in code (`getModifierState('AltGraph')`) but can't be simulated in Playwright. |
| F1.7 | Host-handled keys and `ignoreKeys` not captured | Met | `F1.7 keys the host handled, and ignoreKeys…` |
| F1.8 | Space, `/`, `'`, IME and dead keys never taken from the page | Met | `F1.8 Space, / and ' never start a search`, `F1.8 Space is never taken from page controls…`, `NF6.3 IME composition keys…` |
| F1.9 | Real text input once open | Met | `F1.9 once open, typing goes to a real input…` |
| F1.10 | Block cursor, idle and in the box; `caret: 'bar'` | Met | `F1.10 the idle cursor and the text cursor are terminal-style blocks`, `F1.10 the block cursor follows ::part(input) font styling`, `F1.10 the block cursor blinks for at most 5 s…`, `F1.10 caret: bar…` |
| F2.1 | Highlight from 2 characters | Met | `F2.1 highlights start at two characters` |
| F2.2 | Case, accent and whitespace insensitive | Met | `F2.2 matching ignores case…`, `F2.2 <br> counts as whitespace`, unit `F2.2 folding…` |
| F2.3 | Scope: include/exclude, hidden text skipped | Met | `F2.3 hidden, excluded and out-of-scope text is not searched` |
| F2.4 | Matches span inline elements, not blocks | Met | `F2.4 matches span inline elements but not blocks`, `F2.4 elements styled display:block are block boundaries` |
| F2.5 | Updates when page content changes | Met | `F2.5 highlights update when page content changes` |
| F2 | DOM never modified | Met | `F2 page DOM is never modified by highlighting`, `F5.2 …` (with marker strokes drawn) |
| F2.6 | Marker pen strokes, readable text, distinct current, dark pages; `highlight: 'solid'` | Met | `F2.6 matches are drawn as marker strokes…`, `F2.6 marker strokes look hand-drawn and keep the text readable (pixels)`, `F2.6 strokes follow scrolling and are clipped to scroll containers`, `F2.6 strokes follow layout changes…`, `F2.6 on a dark page…`, `F2.6 the page colour comes from the background behind the matches…`, `F2.6 highlight: solid…`, unit `NF6.1 marker strokes keep page text at AA contrast` |
| F3.0 | Site pages on Enter by default; while typing with `startMode: 'suggest'` | Met | `F3.0/F3.1/F3.2 Enter shows site pages…`, `F3.5 the index is not fetched until the first Enter`, `startMode: suggest › F3.1 suggestions appear as you type…`, `D2/NF3 the custom theme demo switches every default…` |
| F3.1 | Site pages suggested, capped | Met | `F3.0/F3.1/F3.2 …`, unit `F3.1` |
| F3.2 | Prefix matching and ranking | Met | unit `F3.2 every query word must prefix-match…` |
| F3.3 | Sections with ids suggested | Met | `F3.3 headings with ids are suggested as sections`, unit `F3.3` |
| F3.4 | Pick with keyboard, mouse or tap | Met | `F3.4 pick a suggestion with the keyboard`, `F3.4 Enter twice opens the first suggestion`, `…with the mouse`, `F3.4 tapping a suggestion opens it on touch devices` |
| F3.5 | Lazy load; index, then sitemap, plus inline pages | Met | `F3.5 the index is not fetched until the first Enter`, `startMode: suggest › F3.1 …`, `F3.5 falls back to sitemap.xml…`, `F3.5/NF3 inline pages…` |
| F3.6 | "No matching pages" after Enter | Met | `F3.6 Enter with no matching pages says so` |
| F4.1 | Enter / Escape switch modes (default); Escape toggles (`suggest`) | Met | `F4.1 Enter switches to site pages and Escape comes back…`, `startMode: suggest › F4.1 Escape toggles…`, `F5 Escape from elsewhere…` |
| F4.2 | Count and current match shown | Met | `F4.2/F4.3 count and all navigation keys…` |
| F4.3 | Up/Down, Left/Right, Tab/Shift+Tab, Shift+Enter (and Enter with `suggest`); wraps | Met | `F4.2/F4.3 …` (8 key presses, wrap-around both ways), `F4.3 Shift+Left/Right select text…`, `startMode: suggest › F4.3 Enter and Shift+Enter…` |
| F4.4 | Scrolls match into view above the bar, including nested scrollers; instant with reduced motion | Met | `F4.4/F4.5 the page scrolls…`, `F4.4 matches inside scroll containers…`, `F4.4 reduced motion scrolls instantly` |
| F4.5 | Current match looks different | Met | separate `eyelight-current` highlight, checked in `F4.4/F4.5` |
| F4.6 | Typing updates results in either mode | Met | `F4.6 typing keeps updating results in in-page mode` |
| F4.7 | Starts at first match in view, as you type by default | Met | `F4.7 typing starts from the first match in view` |
| F5.1 | Esc in in-page mode (default) or double Esc, Esc on empty box, close button | Met | `F5.1 Escape in in-page mode closes`, `F5.1 from site pages, a quick double Escape closes`, `startMode: suggest › F5.1 a quick double Escape closes`, `F5.1 Escape on an empty box closes; so does the close button` |
| F5.2 | Clears highlights, restores focus, DOM unchanged | Met | `F5.2 closing clears highlights, restores focus and leaves the DOM unchanged` |
| F6.1 | Floating button on touch devices | Met | `F6.1 a floating search button replaces the idle cursor` |
| F6.2 | Tap opens with input focused | Met | `F6.2-F6.3 tap to open…` |
| F6.3 | Big prev/next, toggle, close buttons (44 px) | Met | `F6.2-F6.3 …` (checks each button's size) |
| F6.4 | Stays above on-screen keyboard | Met (manual) | `F6.4 the bar moves up with the on-screen keyboard` simulates `visualViewport`. Needs a check on real iOS and Android devices. |
| NF1 | Drop-in, no framework | Met | One `<script defer>` tag. The fixtures and docs use nothing else. There's also an ESM build. |
| NF2 | Works on static sites | Met | The docs site is plain static HTML on GitHub Pages (`D2` tests). |
| NF3 | Configurable scope, text, theme, styling, and the four defaults | Met | `F2.3`, `F3.5/NF3 inline pages, window config, theme and labels`, `NF3 JS API…`, `NF3 position: …`, `F1.10 caret: bar…`, `F2.6 highlight: solid…`, `startMode: suggest › …`, `D2 theme buttons…`, `D2/NF3 the custom theme demo switches every default with data attributes` |
| NF4 | Never breaks the site | Met | `NF4 if the script fails to load…`, `NF4 loading the script twice…`, `NF4 an invalid selector in the config is ignored`, `NF4 re-attaches if the host page replaces <body>`, and every e2e test asserts no uncaught page errors |
| NF5 | No slowdown | Met | `defer`, 12.8 KB gzipped (the build enforces 13 KB; it was 10.3 KB before the new defaults), `F3.5` lazy loading, `NF5 no layout shift…` (also checks marker strokes don't grow the page). Marker strokes are only drawn near the viewport. |
| NF6.1 | WCAG 2.2 AA | Met (manual) | Contrast unit tests (both themes, and marker strokes on light and dark pages), `NF6.1 … 2.4.11`, `NF6.1 reflows at 320 px…`, `NF6.1 at 320/412 px every bar control is visible and clickable`, `NF6.1 label in name…`, target sizes in `F6.2-F6.3`, `F1.3`. Full AA sign-off needs manual assistive technology testing (TASKS.md). |
| NF6.2 | 2.1.4: capture can be turned off | Met | `NF6.2/NF7 capture can be turned off, and the choice is remembered` |
| NF6.3 | No interference with screen readers, find-in-page, IME, host shortcuts | Met (manual) | `F1.6`, `F1.7`, `F1.8`, `NF6.3 IME…`, `NF6.3 keys typed in the search box do not trigger host shortcuts`. Screen reader behaviour follows from design (no DOM changes; browse-mode keys never reach the page), but needs manual confirmation. |
| NF6.4 | Never traps focus | Met | `NF6.4 Tab moves focus normally unless navigating matches` |
| NF6.5 | Combobox/listbox/live region | Met | `NF6.5 combobox, listbox and live region semantics`, `F3.4` (`aria-activedescendant`) |
| NF7 | Reduced motion, colour scheme, remembered capture choice | Met | `F1.3`, `F4.4 reduced motion…`, `NF6.2/NF7…`, `prefers-color-scheme` in styles |
| NF8 | Current major browsers | Met | Full suite runs in CI in Chromium, Firefox and WebKit, plus an iPhone profile, including the marker pixel check. There's a graceful fallback without the Highlight API. |
| D1 | Component published | Partly | `dist/eyelight.min.js` is committed and servable through jsDelivr from GitHub. **npm publish and the v0.1.0 tag are pending with Dave** (TASKS.md). |
| D2 | Docs with live demo | Met | Live at https://davesant.github.io/eyelight/ (9 pages), covered by `D2 …` tests. |

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
