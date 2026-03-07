# Tuition Test Review Checklist

This document records the active testing checklist so the review plan is still
available if the session closes.

## Goals

- Reach at least **80% overall code coverage**
- Reach **95-100% coverage per source file**
- Reduce happy-path bias across unit, integration, and future e2e tests
- Standardize on a single Bun-based test and coverage workflow

## Current Baseline (2026-03-07)

- `bun test` passes
- `bun test --coverage` passes
- `make lint` passes
- Current overall line coverage: **99.65%**
- Current overall function coverage: **96.16%**
- 321 tests passing across 28 files
- No `tests/e2e/` suite exists yet

### Lowest-Coverage Source Files

- `src/cli/commands/caddy.ts` - 100.00% lines / 79.31% functions
- `src/cli/commands/config.ts` - 100.00% lines / 85.71% functions
- `src/core/config/validator.ts` - 100.00% lines / 80.00% functions
- `src/services/backup/manager.ts` - 100.00% lines / 94.44% functions
- `src/cli/commands/dns.ts` - 100.00% lines / 82.61% functions

### Recently Closed Gaps

- `src/core/config/manager.ts` - 100.00% lines
- `src/core/lifecycle/manager.ts` - 100.00% lines
- `src/core/state/detector.ts` - 100.00% lines
- `src/tui/app.ts` - 100.00% lines
- `src/tui/views/service-browser.ts` - 100.00% lines

### Command Layer Snapshot

- `src/cli/commands/backup.ts` - 100.00% lines
- `src/cli/commands/caddy.ts` - 100.00% lines
- `src/cli/commands/config.ts` - 100.00% lines
- `src/cli/commands/dns.ts` - 100.00% lines
- `src/cli/commands/index.ts` - 100.00% lines
- `src/cli/commands/init.ts` - 100.00% lines
- `src/cli/commands/service.ts` - 100.00% lines
- `src/cli/commands/validate.ts` - 100.00% lines

## Checklist

### 1. Coverage Baseline and Enforcement

- [x] Standardize test execution on Bun in `package.json` and `Makefile`
- [x] Add a dedicated coverage command
- [ ] Add a script to report uncovered hot spots clearly
- [ ] Add staged threshold enforcement plan: report-only, then gate overall,
      then gate per-file

### 2. Shared Test Infrastructure

- [x] Add reusable console capture helpers
- [ ] Add reusable temp-directory helpers
- [x] Add reusable process-exit stubs
- [x] Add reusable monkey-patch cleanup helpers for command tests
- [ ] Add shared fixtures for config, Docker responses, and filesystem failures

### 3. Highest-Priority Orchestration Files

- [x] `src/core/lifecycle/manager.ts`
- [x] `src/services/backup/manager.ts`
- [x] `src/services/docker/client.ts`
- [x] `src/services/docker/compose.ts`

### 4. Config and State Files

- [x] `src/core/config/manager.ts`
- [ ] `src/core/config/validator.ts`
- [ ] `src/core/catalog/loader.ts`
- [x] `src/core/state/detector.ts`

### 5. Command Layer

- [x] `src/cli/commands/backup.ts`
- [x] `src/cli/commands/caddy.ts`
- [x] `src/cli/commands/config.ts`
- [x] `src/cli/commands/dns.ts`
- [x] `src/cli/commands/index.ts`
- [x] `src/cli/commands/init.ts`
- [x] `src/cli/commands/service.ts`
- [x] `src/cli/commands/validate.ts`
- [ ] `index.ts`

### 6. Caddy and DNS Services

- [x] `src/services/caddy/caddyfile.ts`
- [x] `src/services/caddy/manager.ts`
- [x] `src/services/dns/coredns.ts`

### 7. Utilities

- [x] `src/utils/logger.ts`
- [x] `src/utils/password.ts`

### 8. TUI Equal-Priority Review

- [x] `src/tui/app.ts`
- [x] `src/tui/views/service-browser.ts`
- [x] `src/tui/views/status-dashboard.ts`
- [x] Add TUI-specific test seams where necessary

### 9. Integration Expansion

- [~] Add `init -> validate -> config show` integration flow
- [ ] Add `service enable -> caddy regenerate -> dns regenerate` integration flow
- [x] Add `backup create -> list -> restore` integration flow
- [~] Add failure propagation integration tests for command-to-manager wiring

### 10. End-to-End Coverage

- [ ] Create `tests/e2e/`
- [ ] Add first-run initialization e2e test
- [ ] Add simple service enablement e2e test
- [ ] Add backup walkthrough e2e test
- [ ] Add TUI launch and first-screen e2e test

### 11. Future Real-Docker and Full E2E Work

- [ ] Plan Docker-backed integration tests for lifecycle, Caddy, DNS, and backup
- [ ] Add environment-gated heavy test suites
- [ ] Expand thin e2e into a fuller Docker-backed e2e layer

## Immediate Execution Order

1. Continue expanding integration coverage in existing files
2. Add more command-to-manager failure-propagation integration coverage
3. Decide whether to raise function coverage in low-branch command/config files
4. Add initial e2e coverage
5. Plan minimal `tests/e2e/` scaffolding without new heavy Docker dependencies

## Latest Progress Notes

- Service-manager process helper branches are now covered deterministically through internal spawn seams rather than module-level process mocks.
- `src/services/docker/compose.ts`, `src/services/caddy/manager.ts`, and `src/services/dns/coredns.ts` are now at **100% line coverage**.
- Integration coverage has started expanding beyond isolated happy paths with a saved-config → validate → config-show round-trip in `tests/integration/multi-command-flow.test.ts`.
- Added a real `BackupCommand` integration round-trip covering create → list → dry-run restore in `tests/integration/multi-command-flow.test.ts`.
- Added a real restore failure-propagation integration case using a corrupt backup archive in `tests/integration/multi-command-flow.test.ts`.
- Fixed a real regression in `src/cli/commands/backup.ts` where `create()` could overwrite the backup manager default destination with `undefined`.
- `src/services/caddy/caddyfile.ts` is now at **100% line coverage** after covering the labels-without-caddy branch found through LCOV output.
