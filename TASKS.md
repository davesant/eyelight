# Tasks

## Needs Dave

- [ ] **Turn on GitHub Pages.** Go to Settings > Pages > Build and deployment > Deploy from a branch > `main` / `/docs`. The docs will then be live at https://davesant.github.io/minisearch/.
- [ ] **Switch on CI.** Move `ci/ci.yml` to `.github/workflows/ci.yml`, using GitHub's web editor or a local git push (the connector's token can't write workflow files).
- [ ] **Publish to npm.** Run `npm login`, then `npm publish --access public` (package `@davesant/minisearch`). The build environment used so far couldn't reach the npm registry.
- [ ] **Tag v0.1.0** (create a GitHub release). Then switch the CDN URL in the README and `docs/index.html` from `@main` to `@v0.1`, because `@main` is cached by jsDelivr for up to 12 hours and changes without warning.
- [ ] **Check the first CI run** in Actions, especially Firefox and WebKit, which haven't been run locally yet.

## Before v1.0

- [ ] Manual screen reader testing: NVDA + Firefox, JAWS + Chrome, VoiceOver macOS + Safari, VoiceOver iOS, TalkBack Android.
- [ ] Test on real devices: iOS Safari (keyboard offset with `visualViewport`), Android Chrome, and an iPad with a hardware keyboard.
- [ ] Test IME with a real Japanese/Chinese/Korean input method (automated tests only simulate `isComposing`).
- [ ] Add miniharp.dev integration: add the script tag and run `minisearch-index` in its build.
- [ ] Consider an optional full-text mode for the index (page body text, size-capped) for small sites.
- [ ] Consider showing a "no matching pages" row when the index loads but nothing matches (currently the list just hides and the live region says "0 pages suggested").
- [ ] Add an axe-core automated check to the e2e suite (couldn't be installed in the first build environment; contrast is checked by a unit test instead).
- [ ] Add a `package-lock.json` once `npm install` has been run with registry access, and switch CI to `npm ci`.
