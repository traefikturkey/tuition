# Tuition Product Requirements Document

## Executive Summary

Tuition is a TUI-first homelab management tool that simplifies running 5-50+ Docker containers with automated SSL, disaster recovery, and low operational overhead. It provides a curated catalog of pre-configured services accessible through an interactive terminal interface.

---

## Problem Statement

Self-hosting enthusiasts face a **complexity gap**:

| Approach | Problem |
|----------|---------|
| **Manual Docker Compose** | Configuration sprawl, SSL management headaches, no consistency |
| **Enterprise Orchestration (K8s)** | Overkill for home environments, steep learning curve, HA complexity |

There is no middle ground that provides:
- Easy management of 10-50+ Docker containers
- Consistent SSL/TLS via a single reverse proxy
- Simple disaster recovery
- Low operational overhead

---

## Target Users

**Primary:** Homelab enthusiasts and self-hosting hobbyists who:
- Want to host 5-50+ Docker containers
- Have a Debian/Ubuntu Linux server and personal domain
- Are comfortable with CLI-based tools
- Need disaster recovery without high-availability complexity
- Want quick setup without deep Docker expertise

**Secondary:** Small infrastructure teams needing rapid deployment and reproducibility.

---

## Core Philosophy

> "Disaster Recovery over High Availability. Rebuildable in minutes from backups."

| High Availability (Rejected) | Disaster Recovery (Embraced) |
|------------------------------|------------------------------|
| Complex distributed infrastructure | Simple single-server setup |
| Minimizes downtime through redundancy | Accepts brief downtime for simplicity |
| Many moving parts to maintain | Few critical components |
| Expensive and overkill for hobbies | Cost-effective and pragmatic |

### What This Provides
- 3-2-1 backup strategy support
- Configuration-as-code that's easily reproducible
- Ability to rebuild entire stack from backups
- Automated backup and restore procedures

### What This Does NOT Provide
- Service replication across multiple nodes
- Automatic failover
- High availability guarantees

---

## Solution Overview

### Interface: TUI-First with CLI Fallback

**Primary:** Interactive Terminal UI (TUI)
- Guided setup wizards with real-time validation
- Visual service catalog browsing
- Status dashboards and log viewing
- Menu-driven operations

**Secondary:** CLI commands for scripting and automation
- All TUI operations available as subcommands
- Scriptable for CI/CD and automation
- Headless mode for remote management

### Implementation: TypeScript/Bun

**Preferred stack:**
1. TypeScript with Bun runtime
2. Ink (React for CLI) for TUI components
3. Single-file or minimal distribution

**Alternatives considered:**
- Go with Bubble Tea/Charm
- Python with Textual/Rich

### Architecture: Docker + Caddy

**Container Runtime:** Docker with Docker Compose

**Reverse Proxy:** Caddy with tool-generated Caddyfile
- Wildcard SSL certificates via built-in DNS-01 challenge
- Tool manages Caddyfile (regenerated on service enable/disable)
- Single entry point (ports 80/443)
- Human-readable config for easier debugging

**Why Caddy over Traefik:**
- Simpler configuration (Caddyfile vs labels + YAML)
- Built-in DNS-01 support (no plugins needed)
- Clearer error messages (aligns with UX goals)
- Generated config is inspectable and debuggable
- Tool already manages service lifecycle, so managing routes is natural

**Service Catalog:** Curated, pre-configured services
- Tested and maintained by the project
- Sensible defaults with customization options
- Categorized for discovery

---

## Focus Areas

### Primary: Initial Setup UX

The first-time user experience is the most critical path.

**Goals:**
1. **Zero-to-first-service in under 5 minutes** (excluding downloads)
2. **No configuration file editing during initial setup**
3. **Clear, actionable error messages at every step**
4. **Sensible defaults that work out of the box**

**Approach:**
- Interactive setup wizard collects required information
- Automatic detection of system state (Docker installed, ports available)
- Progressive disclosure: basic → advanced options
- Validation before execution, not after failure

**Required Information (Minimal):**
- Hostname and domain
- DNS provider credentials (for SSL)
- Timezone

**Everything Else:**
- Auto-detected or defaulted
- Changeable later through TUI

### Secondary: Service Lifecycle

Clean, predictable service management.

**Goals:**
1. **Enable/disable services without side effects**
2. **Clear service dependencies and relationships**
3. **Non-destructive by default, destructive requires confirmation**
4. **Update services without losing configuration**

**Service States:**
```
AVAILABLE → ENABLED → RUNNING ↔ STOPPED → DISABLED → [DELETED]
```

**Operations:**
| Operation | Effect | Data Impact |
|-----------|--------|-------------|
| Enable | Register service, generate config | Creates configs |
| Start | Launch container | None |
| Stop | Pause container | None |
| Disable | Unregister service | Preserves data |
| Delete | Remove completely | Destroys data |

---

## User Workflows

### Workflow 1: First-Time Setup

```
User runs tuition
    ↓
TUI detects fresh install
    ↓
Setup Wizard launches:
    1. System check (Docker, ports, etc.)
    2. Domain configuration
    3. DNS provider setup
    4. First service selection
    5. Confirmation and apply
    ↓
First service running with SSL
```

### Workflow 2: Add a New Service

```
User opens TUI → Service Catalog
    ↓
Browse or search services
    ↓
Select service → View description
    ↓
Enable → Configure (with defaults)
    ↓
Start → Service running
```

### Workflow 3: Disaster Recovery

```
New server + backup archive
    ↓
Install tuition
    ↓
Restore command points to backup
    ↓
All configuration restored
    ↓
Start services → Stack operational
```

---

## Technical Architecture

### Configuration Hierarchy

```
Global Config (domain, timezone, user IDs)
    ↓
Infrastructure Config (NFS mounts, external services)
    ↓
Per-Service Config (passwords, custom settings)
```

### Database Strategy

**Dedicated database per service** (not shared):
- Independent backups
- Failure isolation
- Per-service recovery
- No scaling limits

### Storage Patterns

**Local Storage (Default):**
- Works out of the box
- Suitable for small deployments

**NFS Storage (Optional):**
- For large media libraries
- Multi-service access to same data
- Separates compute from storage

### Secret Management

- Auto-generate secrets when not specified
- Per-service isolation
- Never committed to version control
- File-based patterns over embedded secrets

---

## Design Principles

Based on documented pain points, the solution must:

1. **Be Proactive, Not Reactive**
   - Fix permission issues before they cause problems
   - Create required files before they're needed

2. **Provide Sensible Defaults**
   - Every variable has a default or clear error
   - Generate secure values for secrets automatically

3. **Give Clear Error Messages**
   - When something fails, tell user exactly what to do
   - Never fail silently

4. **Support Idempotent Operations**
   - Safe to run commands multiple times
   - Handle "already done" gracefully

5. **Verify Reality**
   - Don't trust marker files; check actual state
   - Verify prerequisites before proceeding

6. **Use Generous Timeouts**
   - Real-world DNS is slow
   - Network operations need slack

---

## Success Criteria

### For Users

| Metric | Target |
|--------|--------|
| Time to first service | < 5 minutes (excluding downloads) |
| Setup wizard completion rate | > 90% without errors |
| Service enable success rate | > 95% first attempt |
| Disaster recovery time | < 15 minutes to full restore |

### For the Project

| Metric | Target |
|--------|--------|
| Supported services | 30+ curated services |
| Test coverage | > 80% |
| Documentation completeness | All commands documented |

---

## Decisions Made

### Reverse Proxy: Caddy with Generated Caddyfile

**Decision:** Use Caddy instead of Traefik, with the tool generating and managing the Caddyfile.

**Rationale:**
- Caddyfile syntax is simpler and more readable than Traefik's label-based configuration
- Built-in DNS-01 support for most providers (no plugins needed)
- Generated config is easily inspectable for debugging
- Aligns with "clear error messages" design principle
- Since the tool manages service lifecycle, managing routes via Caddyfile is a natural extension

**Trade-off accepted:** Routing is centralized in Caddyfile rather than distributed in service labels. This is acceptable because the tool controls both.

### Service Catalog: Bundled with Tool

**Decision:** Services ship bundled with the tool binary, version-locked together.

**Rationale:**
- Simpler distribution (single artifact)
- Guaranteed compatibility between tool and service definitions
- No network dependency for catalog access
- Easier testing (catalog version matches tool version)

**Trade-off accepted:** Users can't add community services without tool updates. Acceptable for initial version; can add registry later if needed.

### Updates: Pull-Based

**Decision:** User explicitly runs update command when they want container image updates.

**Rationale:**
- Aligns with "no surprises" philosophy
- User controls when changes happen
- No background processes or network checks
- Predictable behavior

**Trade-off accepted:** Users must remember to update. Acceptable given target audience is comfortable with CLI tools.

---

## Open Questions for Discussion

### 1. Configuration Storage Format

Options:
- **YAML:** Human-readable, familiar to Docker users
- **TOML:** Simpler syntax, less ambiguous
- **JSON:** Easy to parse, verbose

**Discussion point:** What format feels most natural for the target audience?

---

## Pain Points Addressed

| Pain Point | How Addressed |
|------------|---------------|
| **Permissions issues** | Pre-create directories with correct ownership |
| **Environment variable chaos** | Single source of truth, clear precedence, wizard-driven |
| **Initial setup complexity** | TUI wizard, system detection, sensible defaults |
| **Silent failures** | Explicit error messages, validation before execution |
| **Configuration brittleness** | Generated configs from templates, never edited directly |
| **State tracking lies** | Verify actual state, don't trust markers |
| **Idempotency failures** | All operations safe to re-run |
| **Timing/timeout issues** | Generous defaults, progress indication |

---

## Out of Scope (Non-Goals)

- **Web dashboard:** TUI is primary interface; web UI is future consideration
- **Multi-node orchestration:** Single-server focus per philosophy
- **High availability:** Explicitly rejected per philosophy
- **Custom service definitions:** Users cannot add arbitrary services (catalog-only)
- **Windows support:** Linux (Debian/Ubuntu) only

---

## Implementation Phases (Not Time-Estimated)

### Phase 1: Foundation
- Core TUI framework
- System detection and prerequisites
- Global configuration management
- Caddy integration with Caddyfile generation

### Phase 2: Setup Experience
- First-run wizard
- DNS provider integrations
- SSL certificate automation
- First service (e.g., homepage dashboard)

### Phase 3: Service Catalog
- Catalog browsing and search
- Service enable/disable lifecycle
- Per-service configuration
- Initial 10 services

### Phase 4: Operations
- Service status and logs
- Start/stop/restart operations
- Update management
- Backup and restore

### Phase 5: Expansion
- Expand catalog to 30+ services
- NFS storage integration
- External service proxying
- Community feedback integration

---

## Appendix: User Stories

### Tier 1: New User

1. **As a new user**, I want to complete initial setup through a guided wizard so that I don't need to read documentation before getting started.

2. **As a new user**, I want the system to detect and validate my environment so that I know if something is misconfigured before I proceed.

3. **As a new user**, I want sensible defaults for everything so that I only configure what I care about.

### Tier 2: Active User

4. **As a homelab user**, I want to browse available services visually so that I can discover what's possible.

5. **As a homelab user**, I want to enable a service and have it work immediately so that I don't debug configuration issues.

6. **As a homelab user**, I want to see service status at a glance so that I know what's running without multiple commands.

### Tier 3: Power User

7. **As a power user**, I want CLI commands for all operations so that I can script and automate.

8. **As a power user**, I want to customize service configuration beyond defaults so that I can fine-tune behavior.

### Tier 4: Recovery

9. **As a user recovering from failure**, I want to restore my entire setup from a backup so that I'm operational again quickly.

10. **As a user**, I want to restore a single service without affecting others so that I can recover from partial failures.

---

*Document Version: Draft 1.2*
*Based on research in `.chat/research/01-09`*

**Decisions made:**
- Caddy with generated Caddyfile (reverse proxy)
- Bundled service catalog
- Pull-based updates

**Open:** Configuration storage format
