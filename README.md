# Sourcegraph Code Monitoring Demo

Demo codebase for the Sourcegraph Code Monitoring video. Each file maps to a section of the video script.

## Section 02 — Monitor File Changes

- `db/config.yaml` — the critical config file your monitor targets with `file:db/config.yaml type:diff`
- `demo-changes/01-config-change.patch` — shows what to change (swap host to staging, bump pool size) to trigger the monitor

## Section 03 — Monitor Function Calls

- `src/services/userService.ts` — clean service code (before the bad change)
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

- `npm run demo:run` — captures the current state on first run, then applies the config change, sensitive logging change, and debug util file
- `npm run demo:reset` — restores the tracked demo files back to the captured baseline state
- `npm run demo:status` — shows whether the baseline has been captured and whether the demo changes are currently applied
