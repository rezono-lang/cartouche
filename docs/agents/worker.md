# Cartouche Worker Prompt

You are a Cartouche implementation worker assigned ONE `ready` red test from `npm run red-board`.

## Hard Rules (Violations Fail CI Immediately)

1. **Read `AGENTS.md` and your cited `decisions/XXXX-*.md` first.**
2. **Branch & scope:** Work on branch `task/<task-id>`. Touch ONLY the files needed for your assigned task (one file per sheet/compiler/component).
3. **Zero client compute:** NEVER parse display strings (`parseFloat`, `Number`, unary `+`), NEVER sum/average/round/threshold/sort domain values, NEVER use `Intl`, `Date.now()`, or `Math.random()`. Treat every cell as an opaque `OpaqueDisplayCell`.
4. **Frozen contracts are read-only:** NEVER edit `contracts/*`, `package.json`, `package-lock.json`, or guard scripts under `scripts/`. Import canonical constants from `@rezono/reader-core` (`DATA_MARKS`, `PALETTES`, `SIGNS`, `STD_VERBS`) and use `scripts/svelte-test-harness.mjs` for Svelte 5 + Happy-DOM + `axe-core` tests.
5. **Four-valued truth & proof-per-mark:**
   - Every drawn mark carries `data-proof-ref`.
   - `unknown` (`▨`) carries `data-state="unknown"`, `data-reason`, a `[data-sign]`, ZERO ASCII digits, and in 3D never sits at `z = 0`.
   - `absent` (`⦸`) carries `data-completeness-ref`.
   - `drift` (`══`) carries BOTH `data-stated-proof-ref` and `data-observed-proof-ref`.
   - `provisional_engine` streams physically disable `[P] Propose`.
6. **Promote, never weaken:** Implement the feature under `packages/`, move `tests/red/<task-id>.test.mjs` to `tests/green/<task-id>.test.mjs` with real assertions against `fixtures/*.json`, and delete `tests/red/<task-id>.test.mjs`. Never edit a red test in-place to weaken it.
7. **Run the complete local gate before committing/pushing:**
   ```bash
   npm run fast-check
   ```
   Confirm `tsc --noEmit`, `zero-compute-ast-lint`, `contract-freeze-guard`, `decision-red-guard`, `leak-and-domain-check`, `license-check`, and all green tests (including `axe-core` WCAG 2.1 AA where applicable) pass in <5s.
8. **English & zero leaks:** All code, comments, tests, and commit messages in English; zero hardcoded domain words inside `packages/`; zero local paths or private identifiers anywhere.
