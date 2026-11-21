# Cartouche Agent Launch Kit (Rezono Lessons Applied from Day 0)

This playbook applies every hard-won operational lesson from building `rezono-lang/rezono` directly to `rezono-lang/cartouche`.

## 1. Roles & Model Tiering (Cost Discipline)

| Role | Model Tier | Responsibility |
| :--- | :--- | :--- |
| **Coordinator (*Aanjager*)** | Medium / Fast | Reads `npm run red-board -- --json`, respects WIP backpressure, spawns workers, clears stale claims (>2h). |
| **Planner** | Strongest | Writes `decisions/XXXX-*.md` (with YAML head) and bundled red tests in `tests/red/`. Never writes implementation code. |
| **Worker** | Fast / Economical | Claims ONE `ready` red test (`task/<id>`), implements the minimum clean change, passes `npm run fast-check` locally (<15s), promotes the red test to `tests/green/`. |
| **Reviewer (*Nakijker*)** | Strongest (Read-Only) | Runs every 15–20 landed PRs and pre-merge on critical boundaries (`opaque.ts`, `xd-guard.ts`, `zero-compute-lint.mjs`, role projection). |

## 2. WIP Backpressure & Runner Budget

- **Hard limits:** max **15 open PRs**, max **10 PRs in merge queue**. Above 10, unstick/rebase existing PRs before spawning new workers.
- **Why Cartouche stays cheap on GitHub Actions:**
  - `.github/workflows/ci.yml` runs **diff-aware** against frozen fixtures in `fixtures/` (no Rust/Feldera/K8s in PR CI).
  - Average PR uses **1–2 runners for ~35 seconds** (`concurrency.cancel-in-progress: true`).
  - Even with 10 parallel workers, Cartouche fits comfortably inside `rezono-lang`'s existing GitHub Team pool (60 concurrent jobs) without splitting organizations.
  - If `rezono-lang/rezono` saturates all 60 runners during heavy core sprints, attach a single inexpensive self-hosted runner directly to `rezono-lang/cartouche` (self-hosted orchestration fees remain $0) rather than splitting the org and `@rezono/*` scope.

## 3. Mandatory Visual Quality Gate (Beyond Unit Tests)

1. **Headless Geometric Invariants first:** Every sheet compiler must pass `checkGeometricInvariants(scene)` and `assertXDDiscipline(scene)` in <20ms.
2. **HTML Prototype Gate for new sheets:** Before spending 10+ PRs wiring a new 3D/WebGPU sheet (`Threlte v8` / `PixiJS v8`), validate layout and visual calm in a standalone HTML prototype and capture screenshots across `swisstopo`, `obsidian`, and `forced` palettes.
3. **Golden Fixtures decouple UI from core:** Never block UI PRs on backend runs; live contract parity runs nightly in `.github/workflows/nightly-live.yml`.
