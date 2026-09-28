# Agent rules

- Read `README.md` (layout, deploy) and `SPEC.md` (requirements) before changing anything. Open work is in `TASKS.md`.
- Treat `SPEC.md` as the source of truth. If a change alters behaviour, update the spec, the tests (named by requirement ID) and `VERIFICATION.md` in the same commit.
- Never edit build output by hand. After changing `src/` or `docs/`, run `npm run build` and commit `dist/minimarker.min.js`, `docs/minimarker.min.js` and `docs/minimarker-index.json` with the change (the other build outputs are gitignored).
- Check the CI run in GitHub Actions after pushing. Don't leave `main` red.
- Keep the component dependency-free and within the 13 KB gzip budget (the build fails if it's exceeded).
- The component must never break the host page. Wrap new event handlers in `guard()`, never mutate host DOM beyond `<minimarker-ui>` and the highlight `<style>`, and never throw from `init()`.
- Run `npm test` before committing. Don't weaken or delete a test to make it pass; fix the code or change the spec on purpose.
- Keep private notes out of `docs/`, because it's publicly deployed.
- Use plain hyphens, not em or en dashes, in prose.
- Log follow-ups in `TASKS.md`, not here.
