# Sourcegraph Code Monitoring Demo

Demo codebase for the Sourcegraph Code Monitoring video. Each file maps to a section of the video script.

## Section 02 — Monitor File Changes

- `db/config.yaml` — the critical config file your monitor targets with `file:db/config.yaml type:diff`
- `demo-changes/clean/config.yaml` — the canonical clean config that `demo:run` and `demo:reset` use as their source of truth
- `demo-changes/01-config-change.patch` — shows what to change (swap host to staging, bump pool size) to trigger the monitor

## Section 03 — Monitor Function Calls

- `src/services/userService.ts` — clean service code (before the bad change)
- `demo-changes/clean/userService.ts` — the canonical clean service file that the demo runner restores before applying the logging change
- `demo-changes/02-debug-util.ts` — the dangerous `logSensitiveData()` function to commit, triggering the `logSensitiveData() type:diff` monitor
- `demo-changes/02-sensitive-logging.patch` — shows the import + call to add to `userService.ts`

## Supporting Files

These make the codebase feel like a real project:

- `src/services/paymentService.ts` — payment processing service
- `src/utils/database.ts` — loads `db/config.yaml` and provides a query interface
- `src/utils/logger.ts` — structured logging utility
- `scripts/debug-users.ts` — debug script

## Demo Flow

1. Commit the "clean" codebase first
2. Make the changes from `demo-changes/` to produce the diffs that Sourcegraph's Code Monitors would catch

## Demo Scripts

- `npm run demo:run` — rewrites the tracked demo files from canonical clean fixtures, then applies the config change, sensitive logging change, and debug util file
- `npm run demo:reset` — restores the tracked demo files back to the canonical clean state and removes the debug util
- `npm run demo:status` — reports whether the workspace is in the clean, demo, or invalid mixed state
- `npm test` — verifies `run`, `reset`, and repeated demo cycles stay deterministic

## Live Demo Workflow

1. Run `npm run demo:status` and confirm the overall state is `clean`
2. Run `npm run demo:run` to apply the monitor-triggering changes
3. Run `npm run demo:status` again and confirm the overall state is `demo`
4. Run `npm run demo:reset` whenever you want to get back to the clean production-style baseline

The demo runner no longer uses a hidden local snapshot, so repeated `run -> reset -> run` cycles stay deterministic on the same machine.
