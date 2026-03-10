# Tuition Test Review Checklist

This document records the active testing checklist so the review plan is still
available if the session closes.

## Goals

- Reach at least **80% overall code coverage**
- Reach **95-100% coverage per source file**
- Reduce happy-path bias across unit, integration, and future e2e tests
- Standardize on a single Bun-based test and coverage workflow

## Current Baseline

Run `bun test` and `bun test --coverage` to get current results. The figures
below are point-in-time snapshots recorded during development; the live suite
is the authoritative source of truth.

- `bun test` passes
- `bun test --coverage` passes
- `make lint` passes
- Snapshot: overall line coverage above 99%; function coverage above 96%
- Snapshot: 358+ tests across 30+ files at last recording
- Thin `tests/e2e/` smoke coverage now exists for CLI and TUI entry flows

### Lowest-Coverage Source Files

- `src/cli/commands/config.ts` - 100.00% lines / 85.71% functions
- `src/core/config/validator.ts` - 100.00% lines / 97.14% functions
- `src/cli/commands/validate.ts` - 100.00% lines / 66.67% functions

### Recently Closed Gaps

- `src/core/config/manager.ts` - 100.00% lines
- `src/core/lifecycle/manager.ts` - 100.00% lines
- `src/core/state/detector.ts` - 100.00% lines
- `src/services/backup/manager.ts` - 100.00% lines / 100.00% functions
- `src/tui/app.ts` - 100.00% lines
- `src/tui/views/service-browser.ts` - 100.00% lines

### Command Layer Snapshot

- `src/cli/commands/backup.ts` - 100.00% lines
- `src/cli/commands/caddy.ts` - 100.00% lines
- `src/cli/commands/config.ts` - 100.00% lines
- `src/cli/commands/dns.ts` - 100.00% lines / 100.00% functions
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

- [x] Add `init -> validate -> config show` integration flow
- [x] Add `service enable -> caddy regenerate -> dns regenerate` integration flow
- [x] Add `backup create -> list -> restore` integration flow
- [x] Add failure propagation integration tests for command-to-manager wiring

### 10. End-to-End Coverage

- [x] Create `tests/e2e/`
- [x] Add first-run initialization e2e test
- [x] Add simple service enablement e2e test
- [x] Add backup walkthrough e2e test
- [x] Add TUI launch and first-screen e2e test

### 11. Future Real-Docker and Full E2E Work

- [ ] Plan Docker-backed integration tests for lifecycle, Caddy, DNS, and backup
- [ ] Add environment-gated heavy test suites
- [ ] Expand thin e2e into a fuller Docker-backed e2e layer

## Immediate Execution Order

1. Decide whether to keep pushing function coverage in `config.ts`, `backup/manager.ts`, and `validate.ts`
2. Add clearer hotspot reporting for uncovered branches and low-function files
3. Plan Docker-backed integration coverage for lifecycle, Caddy, DNS, and backup
4. Expand the thin e2e layer only where it exposes real parser or lifecycle regressions
5. Keep using Windows-path cases in backup coverage to guard cross-platform behavior

## Latest Progress Notes

- Service-manager process helper branches are now covered deterministically through internal spawn seams rather than module-level process mocks.
- `src/services/docker/compose.ts`, `src/services/caddy/manager.ts`, and `src/services/dns/coredns.ts` are now at **100% line coverage**.
- Integration coverage now includes saved-config → validate → config-show and service-enable → caddy-regenerate → dns-regenerate command flows in `tests/integration/multi-command-flow.test.ts`.
- Added a real `BackupCommand` integration round-trip covering create → list → dry-run restore in `tests/integration/multi-command-flow.test.ts`.
- Added real failure-propagation integration cases for backup restore, Caddy regenerate, and DNS regenerate in `tests/integration/multi-command-flow.test.ts`.
- Added thin CLI and TUI smoke suites in `tests/e2e/cli-smoke.e2e.test.ts` and `tests/e2e/tui-smoke.e2e.test.ts`, including a real `service enable --no-start` parser flow.
- Added real `config set` persistence coverage through both the CLI parser and command-level integration flows.
- Fixed a real CLI parser regression in `src/cli/commands/index.ts` so `backup create --no-compression` now maps correctly into `BackupCommand.create()`.
- Fixed a real backup command bug in `src/cli/commands/backup.ts` where the CLI config path could be treated as the backup destination.
- Fixed a real Windows backup bug in `src/services/backup/manager.ts` where compose files were archived using an incorrect basename derived from a full absolute path.
- `src/cli/commands/caddy.ts` is now at **100% function coverage** after adding tests that exercise enabled-service discovery during start, restart, and reload.
- Added focused branch tests for `ConfigCommand`, `ConfigValidator`, `BackupManager`, and `ValidateCommand`, improving the full-suite baseline to **344 passing tests** and raising `tests/unit/validator.test.ts` to **97.14% function coverage**.
- Added more `BackupManager` and `ValidateCommand` branch tests plus parser/integration coverage for `ConfigCommand`, bringing the baseline to **349 passing tests**.
- Added focused `DnsCommand` tests for enabled-service discovery, successful stop, and preset DNS selection, bringing `src/cli/commands/dns.ts` to **100% function coverage** and the full-suite baseline to **354 passing tests**.
- `src/services/caddy/caddyfile.ts` is now at **100% line coverage** after covering the labels-without-caddy branch found through LCOV output.
- Added backup restoration and ordering tests that brought `src/services/backup/manager.ts` to **100% function coverage** and raised the full-suite baseline to **355 passing tests**.
- Added a multi-service `ConfigCommand.show()` behavior test; the suite is now at **356 passing tests**, while `src/cli/commands/config.ts` and `src/cli/commands/validate.ts` still appear capped by Bun's function-accounting rather than missing line coverage.
- Added another focused pass for `ConfigCommand` redaction and multi-error `ValidateCommand` reporting, raising the suite to **358 passing tests** without changing the reported function percentages for `src/cli/commands/config.ts` or `src/cli/commands/validate.ts`.
