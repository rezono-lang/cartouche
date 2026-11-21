# Working Rules — Cartouche

Cartouche is the domain-neutral, verifiable visualization and exploration engine for [Rezono](https://github.com/rezono-lang/rezono).
These rules apply equally to people and autonomous agents.

## What Must Stay True

1. **Zero client compute.** Cartouche never derives, sums, rounds, thresholds, filters business truth, or re-evaluates rules. Every displayed value is an opaque server-projected `DisplayCell`. Enforced by `scripts/zero-compute-lint.mjs` and the Opaque-Token Mutation Test.
2. **Proof per mark.** Every drawn mark (node, edge, terrace, drift line, figure, or cell) carries a witness or source reference opened in `@rezono/slip`.
3. **No domain knowledge in code.** Names, rates, rules, labels, zones, and colors come from Rezono publications, packs, or `std-view` tokens — never hardcoded in `packages/`.
4. **Deterministic.** The same input produces the same `CartoucheScene` IR and output bytes: no `Intl` locale drift, no unseeded randomness, no wall-clock time in rendered scenes, stable sort order everywhere.
5. **Four-valued truth is explicit.**
   - `unknown` (`▨`) never displays a digit, never collapses to `0`, and in 3D never sits at height `z = 0` (it renders as a hatched uncertainty curtain or prism).
   - `absent` (`⦸`) is visibly distinct from `unknown` and carries its completeness witness (`complete_sweep`).
   - `drift` (`══`) is always two parallel tracks with proof links on both sides (`stated` and `observed`).
   - `not_applicable` (`–`) stays visibly hollow (e.g., future-knowledge cells in bitemporal matrices).
6. **Role-safe zero-leak projection.** Hidden entities leave zero grey placeholders, zero lock icons, and zero count leaks. Forward exploration boundaries report `incomplete: not_read_in_full` honestly.
7. **Three-tier trust boundary.**
   - `sealed`: verified round/manifest (`witness_check: green`).
   - `provisional_checked`: server-checked counterfactual (`suppose` / `sweep` / `Δ = 1` world hop).
   - `provisional_engine`: live unsealed stream — **must physically lock `[P] Propose` and approval actions** until the round seals.
8. **Disciplined x-Dimensionality (`xD-Discipline Guard`).**
   - 3D is strictly orthographic/axonometric (zero perspective distortion).
   - Every Z-axis must represent a true metric, stratified, or bitemporal Rezono dimension (nominal IDs on continuous Z height are rejected).
   - Every 3D sheet collapses cleanly to 2D and carries a synchronized accessible HTML table twin.
9. **Small & permissive.** Prefer vetted open-source libraries over custom engines.

## How Work Is Done (Lessons Applied from Rezono Day 0)

- **Decision-driven work from Commit #1.** Every red test MUST cite a `decisions/XXXX-*.md` file with a structured YAML frontmatter head (`id`, `status`, `milestone`, `owner`). Enforced by `scripts/decision-red-guard.mjs`.
- **The task board is the list of red tests.** Run `npm run red-board` (or `npm run red-board -- --json`). One worker claims one red test (`task/<test-id>`), makes it green, and moves/unmarks it. Only a planner adds or alters red test expectations.
- **One file per thing.** One sheet compiler, one decision, one golden fixture, one red test = one file. Never introduce a central registry file that every PR must touch.
- **Fast local gate (<15s) before any push.** Run `npm run fast-check` locally. PR CI is diff-aware and lightweight (2–4 jobs/PR, <60s) against frozen golden fixtures in `fixtures/`. Live E2E against Rezono core runs in `.github/workflows/nightly-live.yml`.
- **WIP backpressure.** Keep open PRs under 15 and merge queue under 10. If queue depth exceeds 10, unstick/rebase blocked PRs before opening new tasks.
- **Pre-merge review only on critical boundaries.** Changes to `contracts/` (including `contracts/freeze-lock.json`), `packages/reader-core/src/opaque.ts`, `packages/scene-ir/src/xd-guard.ts`, `scripts/zero-compute-lint.mjs`, `scripts/contract-freeze-guard.mjs`, or role-filtering paths require review before merge. Worker PRs must NEVER modify frozen contracts; contract updates require a planner decision bump (`decisions/0007-frozen-contracts-wave-0.md`). Everything else merges automatically on green checks.
- **Headless geometric invariants before pixels.** Every visual sheet compiler must pass `geometry-invariants` (zero bounding-box overlaps, unique X/Y in Monge views, dual drift proofs, zero digits on `unknown`).
- **Nothing private & English everywhere.** No private project names, local machine paths, or personal emails anywhere in code, fixtures, decisions, or commits.

## Licence Policy (Strict Alignment with Rezono)

- Code: **Apache-2.0**. Content/docs: **CC BY 4.0**. Schemas/fixtures: **CC0 1.0**.
- **Permitted runtime dependencies:** `MIT`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `PSF-2.0`, `CC0-1.0`, unmodified `MPL-2.0`, unmodified `EPL-2.0` (e.g. `elkjs`).
- **Strictly forbidden at runtime:** `GPL*`, `AGPL*`, `CC-BY-NC*` (e.g. Cosmograph), and commercial/watermarked SDKs (e.g. tldraw SDK). Enforced automatically by `scripts/license-check.mjs`.
