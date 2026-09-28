# Minisearch specification

Status: v0.1 working spec, 28 September 2026. It is based on the original proposal (kept in full at the end of this file), with the open "TBC" questions answered.

Each requirement has an ID (for example `F1.3`). Tests and the verification table in [`VERIFICATION.md`](VERIFICATION.md) refer to these IDs.

## Purpose

Minisearch is an open source search component that any website can drop in. [miniharp.dev](https://miniharp.dev) will be the first site to use it.

## Decisions made on the proposal's open questions

| Question | Decision |
|---|---|
| Where suggestion data comes from | A **build-time index**. The `minisearch-index` CLI scans a folder of built HTML and writes `minisearch-index.json` with page titles, descriptions, keywords and headings with anchors. If the index is missing, the component falls back to **`sitemap.xml`**, taking titles from URLs. Sites can also **pass their own list of pages** in the config. All three can be combined. |
| How it works on static sites | The index is a static JSON file served next to the pages, so no server is needed. |
| Drop-in setup | One `<script defer>` tag. Config is read from `data-*` attributes, or from `window.minisearchConfig`. |
| Escape: "toggle" vs "twice closes" | A single Escape toggles between site suggestions and in-page navigation. A second Escape within 500 ms closes the search. Escape on an empty box closes it straight away. There is also a visible close button. |
| Tab vs "never traps focus" | Tab and Shift+Tab only move between matches when the box is in in-page mode and there is at least one match. The box always shows how to leave (Escape). In suggestion mode, Tab moves focus normally. |
| Mobile | On touch devices with no hover or fine pointer, a small floating search button replaces the idle cursor. Tapping it opens the same bar with a real input, so the on-screen keyboard appears. There are large previous/next buttons and a mode toggle. |
| Accessibility targets | All adopted. See NF6. |
| Highlighting technique | The CSS Custom Highlight API. The page's DOM is never changed. |
| Package name | `minisearch` on npm is taken by an unrelated library, so the package is published as `@davesant/minisearch`. It can also be served from GitHub through jsDelivr. |
| Docs hosting | GitHub Pages, serving the `docs/` folder on `main`. |

## Functional requirements

### F1 Type anywhere

- **F1.1** On any page, typing a printable character opens the search box at the bottom of the screen and puts the character in it.
- **F1.2** When idle, a blinking cursor is shown at the bottom of the screen as a hint that you can type. The site can optionally set text to show before the cursor (`prompt`, e.g. "search" or "type to search").
- **F1.3** The cursor blinks for no more than 5 seconds after the page loads or the box closes, then stays solid (WCAG 2.2.2). With reduced motion it never blinks.
- **F1.4** The idle hint is a real button: clicking it, or focusing it and pressing Enter/Space, opens the search.
- **F1.5** Keys are **not** captured when focus is in any of these:
  - an `input`, `textarea`, `select` or contenteditable element
  - an element with an interactive ARIA widget role (textbox, searchbox, combobox, listbox, menu, menubar, grid, tree, treegrid, tablist, slider, spinbutton, radiogroup, application)
  - a modal `<dialog>`
  - an area matching the host's `noCapture` selector (default `[data-minisearch-nocapture]`)
  - a form-associated custom element, or a focused custom element whose internals are hidden in a closed shadow root
- **F1.6** Keys pressed with Ctrl, Meta (Cmd) or Alt are never captured. AltGr is the exception, because on many European layouts it is needed to type ordinary characters.
- **F1.7** A key is not captured if the host site's own handler has already called `preventDefault()`, or if it is in the host's `ignoreKeys` list.
- **F1.8** These keys are never taken from the page: Space (it scrolls the page and activates buttons), `/` and `'` (they open Firefox's Quick Find), and keys that come from IME composition or dead keys. They can still be typed once focus is in the box.
- **F1.9** Once the box is open, typing goes into a real text input. IME, dead keys, paste and undo all work normally there.

### F2 Highlight search

- **F2.1** From `minChars` characters (default 2), every match on the current page is highlighted as the user types.
- **F2.2** Matching ignores case, accents and whitespace, like the browser's own find. For example, "cafe" matches "Café", and "hello world" matches across a line break or a `<br>`.
- **F2.3** Only the searchable area is searched: the `include` selector (default: `main`, then `[role=main]`, then `body`), minus the `exclude` selector. Hidden text and the component itself are never matched.
- **F2.4** A match can span inline elements (e.g. `foo <b>bar</b>`) but not block boundaries. Whether something is a block is decided by its computed `display`, not its tag name.
- **F2.5** Highlights update if the page content changes while the search is open.

### F3 Predictive search (site suggestions)

- **F3.1** As the user types, pages from the same site are suggested (up to `maxSuggestions`, default 8).
- **F3.2** Each query word must prefix-match a word in the page's title, headings, keywords, description or URL. Results are ranked with title matches first.
- **F3.3** A heading with an `id` can be suggested on its own, linking straight to that section.
- **F3.4** The user can pick a suggestion with Up/Down and Enter, or with a click or tap. Or they can keep typing to narrow the results.
- **F3.5** The index is loaded on first use, not at page load. The sources are tried in this order: `index` URL, then `sitemap`, then inline `pages`. Inline pages are always merged in.

### F4 In-page navigation

- **F4.1** Pressing Escape toggles between site suggestions and in-page result navigation.
- **F4.2** The box shows how many matches there are on the page, and which one is current (e.g. "3 of 12").
- **F4.3** In in-page mode, Down, Right, Tab and Enter go to the next match. Up, Left, Shift+Tab and Shift+Enter go to the previous one. Navigation wraps around at both ends.
- **F4.4** The page scrolls so that the current match is visible above the search bar, including inside scrollable containers. With reduced motion, scrolling is instant.
- **F4.5** The current match looks different from the other matches.
- **F4.6** Typing continues to update the in-page search in either mode.
- **F4.7** Entering in-page mode picks the first match at or below the top of the viewport.

### F5 Exit

- **F5.1** The user can close the search with a second Escape within 500 ms, with Escape on an empty box, or with the close button.
- **F5.2** Closing removes all highlights, clears the query, returns focus to the element that had it before, and leaves the page's DOM and scroll position as they were after the last navigation.

### F6 Mobile

- **F6.1** On touch-only devices (`(hover: none) and (pointer: coarse)`), a floating search button is shown instead of the idle cursor.
- **F6.2** Tapping the button opens the bar with the input focused, so the on-screen keyboard appears.
- **F6.3** The bar has previous/next and suggestions/in-page toggle buttons with touch targets of at least 44×44 px.
- **F6.4** The bar stays above the on-screen keyboard (it uses the `visualViewport` API).

## Non-functional requirements

- **NF1 Drop-in.** One script tag is enough, and no framework is needed. There's also an ES module build (`init()`) for bundlers.
- **NF2 Works on static sites.** Everything runs in the browser. The index is a static file.
- **NF3 Configurable.**
  - Search scope: `include`, `exclude` and `noCapture`.
  - Text: `prompt` and all visible labels.
  - Light, dark or automatic theme, plus CSS custom properties, `::part()` and `::highlight()` for styling.
- **NF4 Doesn't break the site.**
  - If the script fails to load or throws, the page works normally.
  - Errors are caught and logged once.
  - The component only adds one element (`<minisearch-ui>`) at the end of `<body>` and a `::highlight` stylesheet.
  - Loading two copies of the script is harmless.
  - Invalid selectors in the config are ignored with a warning.
  - If the host page replaces `<body>` (Turbo, pjax), the component re-attaches itself.
- **NF5 Doesn't slow pages down.**
  - The script loads with `defer` and is no more than 12 KB gzipped.
  - Nothing is fetched and the page isn't scanned until the first interaction.
  - It causes no layout shift (it's fixed-position, outside the normal flow).
- **NF6 Accessibility.**
  - **NF6.1** Meets WCAG 2.2 AA. This includes contrast, focus visible, target size, reflow at 320 px (every control stays visible and usable), label in name, and focus not obscured (the idle hint hides if it would cover the focused element).
  - **NF6.2** Meets 2.1.4 Character Key Shortcuts: the user can turn type-anywhere capture off from the open search bar.
  - **NF6.3** Doesn't interfere with:
    - screen reader navigation (browse-mode keys never reach the page, and highlights don't change the DOM)
    - the browser's find-in-page
    - IME
    - the host's keyboard shortcuts
  - **NF6.4** Never traps keyboard focus (see the Tab decision above).
  - **NF6.5** The input is an ARIA combobox with a listbox of suggestions. Match counts and suggestion counts are announced through a polite live region.
- **NF7 Respects user preferences.** It honours `prefers-reduced-motion` and `prefers-color-scheme`. The choice to turn capture off is remembered in `localStorage`.
- **NF8 Browser support.** Current Chrome, Edge, Firefox and Safari. Browsers without the Custom Highlight API still get match counts and navigation, but without painted highlights.

## Deliverables

- **D1** The component: `dist/minisearch.min.js` (script tag), `dist/minisearch.esm.js` (module) and the `minisearch-index` CLI. It's published to npm as `@davesant/minisearch` and served by jsDelivr.
- **D2** Documentation with a live demo in `docs/`, served by GitHub Pages.

---

## Original proposal (verbatim)

> **Purpose**
> An open source, drop-in search component that any website can add. miniharp.dev will be the first site to use it.
>
> **Functional requirements**
>
> 1. Type anywhere
>    * On any page, typing sends the text to a search box at the bottom of the screen.
>    * A blinking cursor sits there when idle, as a hint that you can type. Optionally, the site can set some text to go before the cursor, e.g. "search" or "type to search"
>    * Keys typed into form fields, text areas, editable content, or areas the host site excludes are not captured.
>    * Keyboard shortcuts that use modifier keys are never captured.
> 2. Highlight search - from two characters, matching text on the current page is highlighted as the user types.
> 3. Predictive search - as the user types, pages from the same site are suggested. The user can pick a suggestion or keep typing to narrow the results. TBC where this data comes from.
> 4. In-page navigation
>    * Pressing Escape toggles between site suggestions and in-page search result navigation.
>    * The box shows how many matches are on the page and which one is current.
>    * The user moves between matches with Up/Down, Left/Right, or Tab/Shift+Tab, and the page scrolls to each match.
>    * Or they can continue to type and the in-page search will update.
>    * They can toggle between site suggestions and in-page search result navigation by pressing escape at any time
> 5. Exit - the user can close the search (including by pressing Escape twice), which clears the highlights and returns the page to how it was.
> 6. Mobile - a similar search function is available on touch devices with no physical keyboard. (TBC how this can work)
>
> **Non-functional requirements**
>
> * Drop-in - a site adds it with minimal setup and doesn't need to use any particular framework. TBC - how will this work with the site search data?
> * Works on static sites - TBC - how will this work with the site search data?
> * As a fallback, perhaps host sites can provide their own list of searchable pages?
> * Configurable - host sites can choose which parts of a page are searched, and can change its styling and look, including light and dark mode.
> * Doesn't break the site - if the component fails to load, the site still works normally.
> * Doesn't slow pages down - page load speed is not noticeably affected.
> * Accessibility - TBC whether this proposal can comply with these:
>   * Meets WCAG 2.2 AA.
>   * Complies with 2.1.4 Character Key Shortcuts, so users can turn type-anywhere capture off.
>   * Doesn't interfere with screen reader navigation, the browser's own find-in-page, input methods for non-Latin languages, or the host site's own keyboard shortcuts.
>   * Never traps keyboard focus.
> * Respects user preferences - honours the reduced motion setting and remembers the user's choice to turn capture off.
> * Browser support - works in current versions of the major browsers.
>
> **Deliverables**
>
> * The component itself, published for other sites to use.
> * Documentation with a live demo.
