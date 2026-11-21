---
id: 0001-zero-compute-and-opaque-cells
status: accepted
milestone: M0
owner: core
created: 2026-11-21
---

# Decision 0001: Zero Client Compute and Opaque Display Cells

## Context
During earlier viewer work, business calculations and client-side filtering crept into UI helpers (`diff`, `redact`, `row-model`), forcing costly audits and rewrites.

## Decision
1. Every value crossing into Cartouche from a Rezono publication or fixture is represented as a branded `OpaqueDisplayCell`.
2. Cartouche packages (`packages/*`) never perform business arithmetic, rounding, threshold checks, or rule evaluation on cell values.
3. Enforcement runs in **< 1 second** on every local `npm run fast-check` and PR via:
   - `scripts/zero-compute-ast.mjs` (native ESTree AST linter via `oxc-parser` MIT covering rules `ZC01`–`ZC12` across `.ts`, `.js`, and `.svelte` `<script>` + `{...}` template expressions: bans `Intl`/locale formatting, `parseFloat`/`parseInt`/`Number`/unary `+` coercion, `.toFixed()`, opaque arithmetic, `.reduce()` summation, `.sort()`/`.toSorted()` on domain values, relational thresholds on opaque values, `unknown ?? 0` fallbacks, `Math.*` on opaque values, nondeterministic clock/random globals, `any`/`as unknown as number` escape hatches, and `@ts-ignore`),
   - `tests/green/zero-compute-ast.test.mjs` (14 adversarial worker attack cases including Svelte template injections + zero-false-positive verification for structural/geometry code), and
   - `tests/green/opaque-mutation.test.mjs` (Exhaustive Opaque-Token Mutation Test + Order-Invariance Test: replaces all server-formatted display strings with reversed/non-numeric trap sentinels and verifies verbatim passthrough, zero `NaN`, and byte-identical row ordering).
4. `unknown` cells must carry `display: null` (zero digits) and an explicit `reason` code; renderers must never coerce `unknown` to `0` or `"0"`.
