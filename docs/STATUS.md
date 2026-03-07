# Tuition - Project Status

**Version**: 0.1.0
**Branch**: `feature/initial-implementation`
**Status**: **MVP complete, backlog tracked explicitly**
**Date**: 2026-03-07

---

## Summary

Tuition has delivered the core shape described in the PRD: a terminal-first
homelab manager for a single-server environment with a curated service catalog,
consistent Docker workflows, centralized HTTPS, internal DNS, disaster recovery
basics, and an interactive TUI.

The current implementation should be described as **MVP complete**, not fully
finished against every PRD target.

Delivered now:

- CLI for initialization, validation, config, service lifecycle, Caddy, DNS,
  backup, and TUI workflows
- 24 curated service definitions across 10 categories
- dependency-aware service enable flow
- Caddy configuration generation and admin password setup
- CoreDNS configuration generation, reload, and upstream selection
- backup create, list, restore, and delete flows
- security hardening around config output and backup path handling
- TUI dashboard and service browser views

Still in backlog:

- database dump integration in backups
- event-driven DNS registration instead of manual regenerate/reload flows
- scheduled backups and offsite backup targets
- GPU passthrough support
- SSO-oriented workflows beyond catalog presence
- expansion from 24 services to the PRD target of 30+

---

## Delivered Capability Areas

### Configuration and Validation

- interactive `tuition init`
- layered configuration with global and per-service data
- `tuition validate` for preflight checks
- redacted sensitive output in `tuition config show`
- generated secrets and restrictive file permissions where supported

### Service Catalog and Lifecycle

- browse, inspect, and search the service catalog
- enable, disable, start, stop, restart, update, and logs workflows
- dependency auto-enable during service activation
- data-preserving disable by default
- destructive disable path available with `--remove-data`

### HTTPS and Reverse Proxy

- Caddy start, stop, restart, reload, status, and regenerate commands
- generated Caddy configuration from enabled services
- admin password management through `set-password`
- Cloudflare DNS challenge integration for certificate management

### Internal DNS

- CoreDNS start, stop, status, regenerate, and configure commands
- generated hosts and Corefile output from enabled services
- CoreDNS runs on **port 54**, not port 53, to avoid local resolver conflicts
- Tuition hostname registration in generated DNS config

### Disaster Recovery

- backup archive creation
- optional inclusion of service data volumes
- restore and delete by list number or filename
- path containment validation for restore and delete operations

### Terminal UI

- dashboard view
- service browser view
- keyboard-driven navigation using Blessed

---

## Current CLI Surface

### System

- `tuition init`
- `tuition validate`
- `tuition config show`
- `tuition config set <key> <value>`

### Services

- `tuition service list`
- `tuition service show <name>`
- `tuition service search <query>`
- `tuition service enable <name>`
- `tuition service disable <name> [--remove-data]`
- `tuition service start <name>`
- `tuition service stop <name>`
- `tuition service restart <name>`
- `tuition service update <name>`
- `tuition service logs <name>`

### Infrastructure

- `tuition caddy start|stop|restart|reload|status|regenerate`
- `tuition caddy set-password`
- `tuition caddy hash-password` (legacy helper)
- `tuition dns start|stop|status|regenerate|configure`

### Backup and Recovery

- `tuition backup create`
- `tuition backup list`
- `tuition backup restore <identifier>`
- `tuition backup delete <identifier>`

### Interactive UI

- `tuition tui`

---

## Catalog Coverage

Current catalog footprint:

- **24 services**
- **10 categories**

Categories represented:

- AI
- Auth
- Development
- DNS
- Downloads
- Games
- Home Automation
- Media
- Monitoring
- Storage

---

## Verification Snapshot (2026-03-07)

- `make lint` passes
- `make test` passes
- test runner result: **185 passing tests across 24 files**

---

## PRD Alignment Review

| Area                                  | Status                                       | Notes                                                                                                            |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **FR1 Multi-container management**    | Implemented                                  | Consistent CLI flows, central lifecycle manager, and status-oriented service handling are present.               |
| **FR2 SSL/TLS management**            | Implemented with current provider constraint | Centralized Caddy flow is implemented. Current implementation is Cloudflare-first rather than provider-agnostic. |
| **FR3 Service discovery and catalog** | Implemented                                  | Catalog browsing, descriptions, categories, and search are available.                                            |
| **FR4 Configuration management**      | Implemented                                  | Layered config, validation, defaults, secret generation, and precedence flows are present.                       |
| **FR5 Disaster recovery**             | Partial                                      | Backup and restore work, but database dump integration and offsite automation are still missing.                 |
| **FR6 Service lifecycle**             | Implemented                                  | Enable, disable, update, dependency handling, and non-destructive defaults are present.                          |
| **FR7 Internal DNS**                  | Partial                                      | CoreDNS generation exists, but event-driven registration and full automatic sync are still backlog items.        |

The project remains on track with the original goal: a practical, single-server,
CLI/TUI homelab manager focused on disaster recovery over high availability.
Current gaps are mainly completeness and automation items, not direction
changes.

---

## Success Criteria Snapshot

| PRD Target                      | Current Position                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| **30+ curated services**        | At risk for v1 on this branch; current catalog is 24 services.                      |
| **All commands documented**     | Addressed by this documentation sync.                                               |
| **>80% test coverage**          | Test suites are broad, but formal coverage reporting is not published in repo docs. |
| **Fast first-service workflow** | On track via `init`, infrastructure commands, and `service enable`.                 |

---

## Backlog Required for Full PRD Completion

1. Add database dump support to backup creation and restore workflows.
2. Replace manual DNS regeneration with Docker event-based registration and
   sync.
3. Add scheduled backup execution.
4. Add offsite backup destinations for fuller 3-2-1 coverage.
5. Expand catalog from 24 services to 30+ curated services.
6. Implement power-user features such as GPU passthrough and broader auth/SSO
   workflows.

---

## Source of Truth

- [README.md](../README.md) for user-facing setup and command usage
- [docs/IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for remaining scope
- [docs/PRD/PRD.md](PRD/PRD.md) for product goals and the alignment review
