# Tuition - Implementation Plan

## Executive Summary

This document reflects the **current** implementation state of Tuition rather
than the original greenfield phase plan.

The branch has already delivered the MVP foundation:

- terminal-first CLI flows
- a Blessed-based TUI
- curated service catalog loading
- service lifecycle orchestration through Docker Compose
- generated Caddy and CoreDNS configuration
- backup and restore primitives

The remaining plan is therefore about closing the gap between the **current MVP**
and the **full PRD target**.

---

## What Has Been Delivered

### Core CLI Surface

Implemented command groups:

- `init`
- `validate`
- `config`
- `service`
- `caddy`
- `dns`
- `backup`
- `tui`

### Core Runtime Areas

- configuration management and validation
- bundled catalog loader
- lifecycle manager with dependency handling
- Docker client and Compose wrappers
- Caddyfile generation and reverse proxy management
- CoreDNS configuration generation and reload flow
- backup creation, restore, and deletion
- state detection module
- terminal dashboard and service browser views

### Catalog Scope

- 24 service definitions
- 10 categories

### Hardening Already Completed

- backup path containment for restore and delete operations
- Windows-safe absolute path handling in backup CLI flows
- config redaction for sensitive output
- cryptographically secure generated secrets
- restrictive config file permissions where supported
- broader unit and integration coverage for command behavior

---

## Current Architecture Snapshot

```text
tuition/
├── src/cli/commands/      # Command implementations
├── src/core/config/       # Config load/save/validate
├── src/core/catalog/      # Catalog loading
├── src/core/lifecycle/    # Service lifecycle orchestration
├── src/core/state/        # Actual state detection
├── src/services/docker/   # Docker and Compose integration
├── src/services/caddy/    # Reverse proxy generation and control
├── src/services/dns/      # CoreDNS generation and control
├── src/services/backup/   # Backup and restore workflows
├── src/tui/               # Blessed TUI
├── catalog/services/      # Bundled service definitions
└── tests/                 # Unit and integration suites
```

This replaces earlier plan references to components that are not part of the
current branch, such as Traefik-specific managers, parser placeholders, or
future scheduler modules.

---

## Remaining Scope to Reach Full PRD Completion

### Priority 1: Disaster Recovery Completion

These items are the largest remaining gap against the stated project philosophy.

1. **Database dump integration**
    - add real PostgreSQL and MySQL dump workflows
    - connect `includeDatabases` to actual backup behavior
    - restore database dumps as part of recovery

2. **Scheduled backups**
    - add cron or systemd-timer compatible scheduling
    - provide safe idempotent setup and removal flows

3. **Offsite backup targets**
    - add S3, rsync, or similar remote destinations
    - keep local-first behavior intact

### Priority 2: Internal DNS Automation

1. **Docker event-based DNS registration**
    - watch container lifecycle events
    - update CoreDNS state automatically
    - reduce reliance on manual regenerate and reload flows

2. **Route and DNS sync tightening**
    - ensure reverse proxy exposure and DNS registration stay aligned
    - expand static host handling where needed

### Priority 3: Catalog and Power-User Expansion

1. Expand curated service count from **24** to **30+**.
2. Add GPU passthrough workflows for media and AI services.
3. Improve auth and SSO-oriented workflows beyond catalog presence.
4. Evaluate external service proxy support for non-container services.

### Priority 4: Quality and Release Readiness

1. Publish a formal coverage number if coverage reporting is required for v1.
2. Reconcile the contributor runtime story:
    - installer and wrapper use Node plus `npx tsx`
    - repo entrypoint shebang uses Bun
    - `make test` uses Bun while `package.json` uses `tsx --test`
3. Add release packaging and versioned handoff documentation.

---

## Recommended Next Execution Order

1. Finish backup completeness first.
2. Finish DNS automation second.
3. Expand catalog and power-user features third.
4. Normalize runtime and release workflow last.

This order keeps the project aligned with the PRD's disaster-recovery-first
goal and avoids polishing secondary workflows before the core recovery story is
complete.

---

## Mapping to the Original Phase Plan

| Original Area                  | Current State                                                 |
| ------------------------------ | ------------------------------------------------------------- |
| Foundation                     | Delivered                                                     |
| Catalog and Docker integration | Delivered                                                     |
| Reverse proxy and SSL          | Delivered in Caddy-based form                                 |
| Service lifecycle and state    | Delivered, with room to integrate state detector more broadly |
| Internal DNS                   | Partially delivered                                           |
| Disaster recovery              | Partially delivered                                           |
| TUI                            | Delivered                                                     |
| Polish and documentation       | In progress                                                   |

The original plan should no longer be read as a future checklist. It is now a
historical outline whose unfinished items have been consolidated into the
remaining scope sections above.

---

## Exit Criteria for Calling the PRD Fully Met

Tuition should only be described as fully complete against the PRD once all of
the following are true:

- backups include real database dump support
- scheduled and offsite backup flows exist
- internal DNS registration is automatic rather than mostly regenerate-based
- catalog reaches or exceeds 30 curated services
- documentation, tests, and release workflow are consistent and current

---

## Related Documents

- [README.md](../README.md)
- [docs/STATUS.md](STATUS.md)
- [docs/PRD/PRD.md](PRD/PRD.md)
