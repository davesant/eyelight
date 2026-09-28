# Tasks

## Needs Dave

- [ ] **Rename the GitHub repo to `eyelight`** (Settings > General > Repository name) straight after the rename PR is merged. GitHub redirects the old repo and git URLs, but not the GitHub Pages URL, so the docs move from `davesant.github.io/minisearch/` to `davesant.github.io/eyelight/` with no redirect. Then check Pages is still on (`main` / `/docs`) and the live docs load.
- [ ] **Publish to npm.** Run `npm login`, then `npm publish --access public` (package `@davesant/eyelight`). The build environment used so far couldn't reach the npm registry.
- [ ] **Tag v0.1.0** (create a GitHub release). Then switch the CDN URL in the README and `docs/index.html` from `@main` to `@v0.1`, because `@main` is cached by jsDelivr for up to 12 hours and changes without warning.

## Before v1.0

- [ ] Manual screen reader testing: NVDA + Firefox, JAWS + Chrome, VoiceOver macOS + Safari, VoiceOver iOS, TalkBack Android.
- [ ] Test on real devices: iOS Safari (keyboard offset with `visualViewport`), Android Chrome, and an iPad with a hardware keyboard.
- [ ] Test IME with a real Japanese/Chinese/Korean input method (automated tests only simulate `isComposing`).
- [ ] Add miniharp.dev integration: add the script tag and run `eyelight-index` in its build.
- [ ] Consider an optional full-text mode for the index (page body text, size-capped) for small sites.
- [ ] Consider showing a "no matching pages" row when the index loads but nothing matches (currently the list just hides and the live region says "0 pages suggested").
- [ ] Add an axe-core automated check to the e2e suite (couldn't be installed in the first build environment; contrast is checked by a unit test instead).
- [ ] Add a `package-lock.json` once `npm install` has been run with registry access, and switch CI to `npm ci`.
- [ ] Add Ctrl+K (Cmd+K on macOS) to open the search, as VitePress, docmd and Docusaurus search do. This is an exception to F1.6 (modifier keys are never captured), so update `SPEC.md`, tests and `VERIFICATION.md` together. Points to decide: on by default or opt-in via config; skip it if the host's handler has already called `preventDefault()` (F1.7) or it's in `ignoreKeys`; it should still work when focus is in a form field (unlike type-anywhere); it overrides the browser's own Ctrl+K (focus the search/address bar), so document that; and whether the idle hint should show the shortcut.

## Done

- [x] Renamed from Minisearch to Eyelight: package `@davesant/eyelight`, `<eyelight-ui>`, `eyelight-index` CLI and index file, `window.eyelightConfig`, `data-eyelight-*` attributes, `--eyelight-*` CSS custom properties (formerly `--ms-*`) (2026-09-28)
- [x] GitHub Pages turned on - docs live at https://davesant.github.io/eyelight/ (2026-09-28)
- [x] CI switched on in `.github/workflows/ci.yml`; first runs checked and two browser-specific test issues fixed (2026-09-28)
