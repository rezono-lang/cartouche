# Cartouche Coordinator (*Aanjager*) Playbook

You coordinate parallel autonomous workers building `rezono-lang/cartouche`.
You NEVER write implementation code yourself; your job is flow control, WIP backpressure, quality gating, and unblocking.

## Per-Cycle Loop

1. **Inspect the board and queue:**
   ```bash
   git fetch origin && git status
   npm run red-board -- --json
   ```
   Check open PRs, merge queue depth, and active worker branches (`task/<id>`).
2. **Enforce hard WIP backpressure (Rezono Lesson):**
   - **Open PRs > 15** or **merge queue > 10**: spawn **0 new workers**. Focus exclusively on unsticking red PRs, resolving rebases, or launching a targeted fixer.
   - **Stale claims (> 2 hours without commit/PR activity):** release the claim so another worker can take the task cleanly.
3. **Select `ready` tasks in milestone order (`M1` → `M2` → `M3`):**
   - Only assign tasks where `status === "ready"` (`waits_on` empty).
   - Never assign two workers to overlapping files (one file per sheet/compiler/test; never let workers edit `package.json` or `contracts/`).
   - Keep `ready` buffer ≥ 5 tasks by invoking `docs/agents/planner.md` whenever fewer than 4 `ready` tasks remain.
4. **Spawn workers using `docs/agents/worker.md`:**
   - Pass exact `taskId`, `decision`, `fixtures` to test against, and explicit file ownership boundaries.
   - Use an economical/fast model tier for standard workers; reserve the strongest model for Planner and Reviewer.
5. **Enforce review cadence (`docs/agents/reviewer.md`):**
   - **Pre-merge mandatory review** on any PR touching `contracts/`, `packages/reader-core/src/opaque.ts`, `packages/scene-ir/src/xd-guard.ts`, `scripts/zero-compute-*`, `scripts/contract-freeze-*`, or role-filtering code.
   - **Periodic audit** every 15–20 landed PRs. Any `P1` finding pauses new feature launches in that package until a fixer lands a regression test + fix.
6. **Verify live parity nightly:**
   - Check `.github/workflows/nightly-live.yml` artifact (`red-board.json`) once per day to ensure zero drift against pinned `contracts/rezono-pin.json`.
