# Tuition - Product Requirements Document

## Executive Summary

Tuition addresses the **complexity gap** in self-hosting: the space between manual Docker Compose management (configuration sprawl) and enterprise orchestration platforms (overkill for home environments). It provides a streamlined way to manage 5-50+ Docker containers with automated SSL, disaster recovery focus, and low operational overhead.

This document defines the problem space, user needs, and requirements to enable evaluation of different implementation approaches.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Target Users](#target-users)
3. [Core Philosophy](#core-philosophy)
4. [User Motivations](#user-motivations)
5. [User Needs & Requirements](#user-needs--requirements)
6. [User Workflows](#user-workflows)
7. [User Stories](#user-stories)
8. [Technical Requirements](#technical-requirements)
9. [Design Principles](#design-principles)
10. [Success Criteria](#success-criteria)
11. [Non-Goals](#non-goals)
12. [Decision Points](#decision-points)

---

## Problem Statement

### The Complexity Gap

Self-hosting enthusiasts face two unsatisfying extremes:

| Approach                                        | Problems                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Manual Docker Compose**                       | Configuration sprawl, per-service SSL management, inconsistent patterns, no discoverability |
| **Enterprise Orchestration (Kubernetes/Swarm)** | Steep learning curve, HA complexity, expensive infrastructure, overkill for hobbies         |

### What's Missing

There is no middle ground that provides:

- Easy management of many Docker containers (10-50+)
- Consistent SSL/TLS across all containers via a single reverse proxy
- Simple disaster recovery
- Low operational overhead
- Discoverability of available services
- Predictable, repeatable operations

### Why Existing Solutions Fall Short

| Aspect            | Manual Setup   | Enterprise Orchestration | Needed           |
| ----------------- | -------------- | ------------------------ | ---------------- |
| Learning Curve    | Per-service    | Steep                    | Gentle           |
| Configuration     | Per-service    | Complex                  | Automated        |
| SSL Management    | Manual         | Manual                   | Automated        |
| Disaster Recovery | User's problem | Complex                  | Simple           |
| Suitable For      | 1-5 services   | Production enterprise    | Home deployments |

---

## Target Users

### Primary Audience

Homelab enthusiasts and self-hosting hobbyists who:

- Want to host 5-50+ Docker containers
- Have a Debian/Ubuntu Linux server and personal domain
- Prefer CLI-based tools over web UIs for management
- Need disaster recovery without high-availability complexity
- Want quick setup without deep Docker expertise
- Are comfortable with terminal interfaces

### Secondary Audience

Small infrastructure teams needing rapid deployment and reproducibility.

### User Characteristics

| Characteristic      | Description                                          |
| ------------------- | ---------------------------------------------------- |
| **Technical Level** | Comfortable with command line, basic Linux knowledge |
| **Time Available**  | Want to run services, not become full-time sysadmins |
| **Hardware**        | Single Linux server, possibly with NAS for storage   |
| **Network**         | Personal domain, ability to configure DNS            |
| **Risk Tolerance**  | Accept brief downtime in exchange for simplicity     |

---

## Core Philosophy

> "Disaster Recovery over High Availability. Rebuildable in minutes from backups."

### Philosophy Comparison

| High Availability (Rejected)          | Disaster Recovery (Embraced)          |
| ------------------------------------- | ------------------------------------- |
| Complex distributed infrastructure    | Simple single-server setup            |
| Minimizes downtime through redundancy | Accepts brief downtime for simplicity |
| Many moving parts to maintain         | Few critical components               |
| Expensive and overkill for hobbies    | Cost-effective and pragmatic          |

### Practical Implications

**What this philosophy provides:**

- 3-2-1 backup strategy (3 copies, 2 media types, 1 offsite)
- Configuration-as-code that's easily reproducible
- Ability to rebuild entire stack from backups
- Emphasis on automated backups and restore procedures
- Rebuild time measured in minutes, not hours

**What it explicitly does NOT provide:**

- Service replication across multiple nodes
- Automatic failover
- High availability guarantees
- Zero-downtime deployments

---

## User Motivations

### Why Users Self-Host

| Category                | Motivation                                           |
| ----------------------- | ---------------------------------------------------- |
| **Media Servers**       | Replace streaming subscriptions, own content library |
| **Download Automation** | Automate content acquisition and organization        |
| **Photo Management**    | Replace cloud photo storage, maintain privacy        |
| **Monitoring**          | Visibility into system and service health            |
| **Authentication**      | Unified identity, no external dependencies           |
| **Game Servers**        | Host games for friends/family                        |
| **Development Tools**   | Self-hosted repos, CI/CD, code collaboration         |
| **Home Automation**     | Smart home without cloud dependencies                |
| **AI/ML Tools**         | Local AI capabilities, data privacy                  |
| **File Sync/Share**     | Replace Dropbox/Google Drive                         |

### Common Threads

- **Privacy:** Data stays on their hardware
- **Cost:** No recurring subscriptions
- **Control:** No vendor lock-in or service shutdowns
- **Learning:** Technical skill development
- **Community:** Hosting services for friends/family

### User Needs (Priority Order)

1. **Data Ownership** - Replace cloud services with self-hosted alternatives
2. **Visibility & Reliability** - Know what's running and that it works
3. **Control & Privacy** - Zero external dependencies where possible
4. **Automation** - Reduce manual operational overhead
5. **Community** - Host services for friends/family

---

## User Needs & Requirements

### Functional Requirements

#### FR1: Multi-Container Management

| ID    | Requirement                                                               |
| ----- | ------------------------------------------------------------------------- |
| FR1.1 | Manage dozens of Docker containers with consistent configuration patterns |
| FR1.2 | Convention-based approach that auto-generates common configuration        |
| FR1.3 | Centralized view of all container status                                  |
| FR1.4 | Consistent commands across all containers                                 |

#### FR2: SSL/TLS Certificate Management

| ID    | Requirement                                                     |
| ----- | --------------------------------------------------------------- |
| FR2.1 | Centralized, automated certificate management via reverse proxy |
| FR2.2 | Wildcard certificate support for all subdomains                 |
| FR2.3 | Automatic renewal before expiration                             |
| FR2.4 | DNS-based validation (works through firewalls)                  |

#### FR3: Service Discovery & Catalog

| ID    | Requirement                                                             |
| ----- | ----------------------------------------------------------------------- |
| FR3.1 | Browse available services with descriptions and categories              |
| FR3.2 | Self-documenting service metadata (description, category, upstream URL) |
| FR3.3 | Consistent naming patterns for predictability                           |
| FR3.4 | Search and filter capabilities                                          |

#### FR4: Configuration Management

| ID    | Requirement                                                  |
| ----- | ------------------------------------------------------------ |
| FR4.1 | Layered configuration: Global → Infrastructure → Per-Service |
| FR4.2 | Sensible defaults with override capability                   |
| FR4.3 | Auto-generate secrets when not specified                     |
| FR4.4 | Clear precedence rules                                       |
| FR4.5 | Configuration validation before execution                    |

#### FR5: Disaster Recovery

| ID    | Requirement                                       |
| ----- | ------------------------------------------------- |
| FR5.1 | Backup entire configuration with single operation |
| FR5.2 | Restore to new hardware from backup               |
| FR5.3 | Per-service backup granularity                    |
| FR5.4 | Database dump integration                         |
| FR5.5 | Support for 3-2-1 backup strategy                 |

#### FR6: Service Lifecycle

| ID    | Requirement                                                              |
| ----- | ------------------------------------------------------------------------ |
| FR6.1 | Enable/disable services without side effects                             |
| FR6.2 | Clear service states: Available → Enabled → Running → Stopped → Disabled |
| FR6.3 | Non-destructive by default, destructive requires confirmation            |
| FR6.4 | Update services without losing configuration                             |
| FR6.5 | Dependencies handled automatically                                       |

#### FR7: Internal DNS Resolution

| ID    | Requirement                                          |
| ----- | ---------------------------------------------------- |
| FR7.1 | Automatic DNS registration for containers via labels |
| FR7.2 | Zero-configuration DNS for new containers            |
| FR7.3 | Static host entries for non-containerized services   |
| FR7.4 | Local resolution independent of external DNS         |
| FR7.5 | Sync DNS entries with reverse proxy routes           |

### Non-Functional Requirements

| ID   | Requirement                                          |
| ---- | ---------------------------------------------------- |
| NFR1 | First service running within minutes of installation |
| NFR2 | Operations work the same way across all services     |
| NFR3 | No destructive surprises; backups are easy           |
| NFR4 | Customization without forking the project            |
| NFR5 | All operations idempotent (safe to re-run)           |
| NFR6 | Clear, actionable error messages                     |
| NFR7 | Works on fresh Debian/Ubuntu installations           |

---

## User Workflows

### User Journey: New to Operational

```
Stage 1: DISCOVERY & PLANNING
├─ Learn about homelab architecture
├─ Browse available containers (media, DNS, monitoring, etc.)
└─ Decide initial container set to enable

Stage 2: FOUNDATION SETUP
├─ Install Docker and dependencies
├─ Configure global environment (domain, hostname, credentials)
├─ Set up SSL certificates via reverse proxy
└─ Verify core infrastructure is accessible

Stage 3: SERVICE ACTIVATION
├─ Enable services on-demand
├─ Review/customize service-specific configuration
├─ Configuration is automatically prepared
└─ Access services via web UI or API through reverse proxy

Stage 4: CUSTOMIZATION
├─ Enable extensions (storage mounts, GPU passthrough, VPN)
├─ Configure external services
├─ Set up authentication/SSO with middleware
└─ Fine-tune environment variables

Stage 5: MAINTENANCE & RECOVERY
├─ Create regular backups
├─ Schedule automated backups
├─ Set up monitoring dashboards
└─ Test disaster recovery procedures
```

### Recurring Tasks

| Frequency   | Tasks                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| **Daily**   | View service status and logs, check health via dashboard, monitor resource usage       |
| **Weekly**  | Create configuration backups, update container images, review resource trends          |
| **Monthly** | Test restore procedure, clean up old backups, review logs for errors, apply OS patches |

### Key Decision Points

| Decision                                 | Options                                   | Considerations                                 |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| **Which services to enable?**            | Browse catalog                            | Hardware requirements, conflicts, dependencies |
| **Enable incrementally or all at once?** | Incremental (recommended) vs. all at once | Troubleshooting complexity                     |
| **Local vs. network storage?**           | Local (simpler) vs. NFS (scalable)        | Library size, multi-service coordination       |
| **Shared vs. dedicated databases?**      | Dedicated (recommended) vs. shared        | Resource usage, isolation, recovery            |
| **Authentication approach?**             | None, IP whitelist, SSO                   | Security requirements, exposure level          |
| **Hardware acceleration?**               | None, Intel QuickSync, Nvidia GPU         | Hardware availability, workload type           |
| **Backup strategy?**                     | Local only, remote, both (3-2-1)          | Disaster recovery requirements                 |

---

## User Stories

### Tier 1: New User (Getting Started)

| ID    | Story                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| US1.1 | As a new user, I want to install and configure the platform quickly so that I can get a self-hosted homelab running without deep expertise |
| US1.2 | As a new user, I want to understand which services to enable first so that I don't overwhelm myself with too many options                  |
| US1.3 | As a new user, I want to enable a service and have it work out of the box so that I don't spend time debugging networking or configuration |
| US1.4 | As a new user, I want the system to detect and validate my environment so that I know if something is misconfigured before I proceed       |
| US1.5 | As a new user, I want sensible defaults for everything so that I only configure what I care about                                          |

### Tier 2: Active User (Daily Operations)

| ID    | Story                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| US2.1 | As a homelab user, I want to view service status and logs from one place so that I can quickly troubleshoot without SSH and multiple tools      |
| US2.2 | As a homelab user, I want to backup my entire configuration regularly so that I can restore everything to a new machine without losing my setup |
| US2.3 | As a homelab user, I want to manage network storage for services so that I can store files on separate hardware from the main server            |
| US2.4 | As a homelab user, I want to update all containers to latest versions so that I get security patches and new features without manual management |
| US2.5 | As a homelab user, I want to browse available services visually so that I can discover what's possible                                          |

### Tier 3: Power User (Customization)

| ID    | Story                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| US3.1 | As a power user, I want to add hardware acceleration to services so that I can transcode media without CPU bottlenecks                           |
| US3.2 | As a power user, I want to route external services through the reverse proxy so that I get unified SSL and can access everything from one domain |
| US3.3 | As a power user, I want to set up single sign-on for all services so that I don't need individual credentials per service                        |
| US3.4 | As a power user, I want to customize service configuration beyond defaults so that I can fine-tune behavior                                      |
| US3.5 | As a power user, I want CLI commands for all operations so that I can script and automate                                                        |

### Tier 4: Administrator (Maintenance & Recovery)

| ID    | Story                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| US4.1 | As an administrator, I want to test disaster recovery by restoring to a test environment so that I know I can rebuild if production fails |
| US4.2 | As an administrator, I want to schedule automated offsite backups so that configs are always backed up without manual intervention        |
| US4.3 | As an administrator, I want to enforce security best practices so that my homelab is resilient to compromises                             |
| US4.4 | As an administrator, I want to restore a single service without affecting others so that I can recover from partial failures              |

### Tier 5: Community & Contributors

| ID    | Story                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------- |
| US5.1 | As a contributor, I want to add new services to the catalog so that others can use them without manual configuration |
| US5.2 | As a community member, I want to understand how the system works so that I can troubleshoot issues or help others    |

---

## Technical Requirements

### Platform Prerequisites

| Prerequisite            | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| **Docker Engine**       | Container runtime for all services                                      |
| **Docker Compose**      | Multi-container orchestration; all services defined as Compose projects |
| **Debian/Ubuntu Linux** | Primary supported platform                                              |
| **Personal Domain**     | Required for SSL certificates and service URLs                          |
| **DNS Provider Access** | API credentials for automated certificate validation                    |

Docker Compose is the foundational technology for service orchestration. All service definitions are Compose files, and the system manages containers through Compose commands rather than raw Docker CLI.

### Service Management

#### Service Lifecycle States

```
AVAILABLE → ENABLED → RUNNING ↔ STOPPED → DISABLED → [ARCHIVED]
```

| State         | Description                                | Data Impact     |
| ------------- | ------------------------------------------ | --------------- |
| **AVAILABLE** | Service definition exists but not active   | None            |
| **ENABLED**   | Service registered, configuration prepared | Creates configs |
| **RUNNING**   | Container active and accessible            | None            |
| **STOPPED**   | Container exists but not running           | None            |
| **DISABLED**  | Service unregistered                       | Preserves data  |
| **ARCHIVED**  | Configuration permanently removed          | Destroys data   |

#### Service Relationships

| Relationship Type         | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| **Networking**            | All services join common network for web access via reverse proxy     |
| **Database Dependencies** | Services with databases run dedicated database containers             |
| **Configuration**         | Global config provides base; service-specific extends/overrides       |
| **Extensions**            | Overrides extend functionality (NFS, GPU, VPN) without modifying base |
| **External Services**     | Non-containerized services can be proxied through reverse proxy       |

#### Service Metadata Requirements

- Description of what the service does
- Category for grouping (DNS, Media, Monitoring, etc.)
- Upstream documentation URL
- Database requirements
- Resource requirements (CPU, memory, GPU)
- Dependencies on other services

### Configuration Management

#### Configuration Hierarchy

```
Tier 1: Global Configuration (all services)
    ├─ Host identification (hostname, domain)
    ├─ DNS/SSL provider credentials
    ├─ System basics (timezone, user/group IDs)
    └─ Common infrastructure settings

Tier 2: Infrastructure Configuration (optional)
    ├─ NFS storage (addresses, mount options, paths)
    └─ External services (non-containerized service URLs)

Tier 3: Per-Service Configuration
    ├─ Service-specific secrets and passwords
    ├─ Image tags and versions
    └─ Custom settings

Tier 4: Service Configuration Files
    ├─ Application configuration files
    ├─ Generated with variable substitution
    └─ Persisted for runtime use
```

#### Required Initial Configuration

| Configuration            | Purpose                           |
| ------------------------ | --------------------------------- |
| Hostname & Domain        | SSL certificates and service URLs |
| DNS Provider Credentials | Automated certificate management  |
| User/Group IDs           | Container file permissions        |
| Timezone                 | Container time synchronization    |

#### Sensitive Data Requirements

| Requirement      | Description                                          |
| ---------------- | ---------------------------------------------------- |
| Auto-generation  | Passwords auto-generated when not specified          |
| Isolation        | Each service gets its own environment file           |
| Protection       | Environment files never committed to version control |
| File permissions | Restricted to owner read/write only                  |
| Archival         | Credentials preserved when disabling services        |

### Networking & Access

#### Access Patterns

| Pattern                     | Use Case          | Description                          |
| --------------------------- | ----------------- | ------------------------------------ |
| **HTTPS via Reverse Proxy** | Web UIs, APIs     | Primary access method                |
| **Direct Protocols**        | DNS, SSH, SMTP    | Non-HTTP protocols exposed directly  |
| **Internal Networks**       | Databases, caches | Container-to-container only          |
| **External Service Proxy**  | VMs, appliances   | Non-containerized services via proxy |

#### SSL/TLS Requirements

| Requirement           | Description                                 |
| --------------------- | ------------------------------------------- |
| Wildcard Certificates | Single cert covers `*.example.com`          |
| DNS-01 Validation     | Works through firewalls                     |
| Automatic Renewal     | Before expiration, zero manual intervention |
| Provider Support      | Multiple DNS providers supported            |

#### Network Architecture

```
Internet (user)
    ↓
DNS (resolves domain to server IP)
    ↓
Server Ports 80/443 (reverse proxy listens)
    ↓
Reverse Proxy (routes based on hostname)
    ↓
Docker Network
├─ Service A (web-accessible)
├─ Service B (web-accessible)
└─ Database (internal only, not exposed)
```

#### Exposure Control

| Mechanism         | Purpose                                     |
| ----------------- | ------------------------------------------- |
| Proxy Routing     | Enable/disable web access per service       |
| Network Selection | Control which Docker networks service joins |
| Port Mappings     | Expose direct ports (or localhost only)     |
| Middleware        | Add authentication, security at proxy level |

#### Internal DNS Management

The system requires automatic DNS resolution for containers without depending on external DNS services or manual configuration.

**Core Requirements:**

| Requirement            | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| Automatic Registration | Containers automatically register their hostnames via labels         |
| Zero Configuration     | New containers get DNS entries without manual intervention           |
| Static Entry Support   | Support for non-containerized services (VMs, appliances, NAS)        |
| Local Resolution       | DNS queries resolve within the homelab without external dependencies |
| External Proxy Sync    | DNS entries auto-created for services proxied through reverse proxy  |

**DNS Architecture:**

```
Container starts with hostname label
    ↓
DNS Server detects container via Docker API
    ↓
DNS record automatically created
    ↓
Other containers and clients can resolve hostname
    ↓
Reverse proxy routes traffic to container
```

**Benefits:**

- **Service Discovery:** Containers can reference each other by hostname
- **Independence:** No reliance on external DNS for internal resolution
- **Disaster Recovery:** DNS rebuilds automatically with containers
- **Simplicity:** No manual DNS management for container services

**Static Hosts Support:**

For services that aren't Docker containers (NAS, printers, VMs, external appliances), users can define static host entries that take precedence over container labels.


### Disaster Recovery

#### Backup Tiers

| Tier                         | Contents                                                 | Priority               |
| ---------------------------- | -------------------------------------------------------- | ---------------------- |
| **Configuration (Critical)** | All service configs, environment files, enabled services | Required               |
| **Database Data**            | Database dumps for each service with a database          | Required if applicable |
| **Volume Data**              | Photos, media libraries, application data                | User-dependent         |

#### Backup Exclusions (By Design)

- Logs, caches, temporary files (regeneratable)
- Large media library metadata (regeneratable)
- Git pack files (cloned repositories)
- AI model files (downloadable)
- Game server binaries (downloadable)
- Database journals (part of DB backup)

#### Recovery Process

```
Step 1: Deploy Fresh Infrastructure
    └─ Install prerequisites, clone/download tool

Step 2: Restore Configuration
    └─ Extract backup, restore environment files

Step 3: Restore Databases (If Applicable)
    └─ Start database containers, import dumps

Step 4: Start Services
    └─ Restart all containers with restored configuration
```

#### Recovery Time Objectives

| Scenario                | Target Time               |
| ----------------------- | ------------------------- |
| With prepared backup    | 5-15 minutes              |
| Without prepared backup | Hours (manual recreation) |

### Storage Patterns

#### When to Use Shared Storage

| Use Case                     | Local Storage | Shared Storage |
| ---------------------------- | ------------- | -------------- |
| Small media library (<100GB) | ✓             |                |
| Large media library (1TB+)   |               | ✓              |
| Single-service deployment    | ✓             |                |
| Multi-service coordination   |               | ✓              |
| Backup to separate hardware  |               | ✓              |
| Testing/development          | ✓             |                |

#### Shared Storage Benefits

- Centralized media management across services
- Separate compute from storage (independent scaling)
- Multi-container coordination (download → organize → serve)
- Disaster recovery alignment (configuration stays small)

### Database Architecture

#### Recommended: Dedicated Database Per Service

| Factor               | Dedicated (Recommended) | Shared          |
| -------------------- | ----------------------- | --------------- |
| Failure Isolation    | Excellent               | Poor (cascade)  |
| Recovery Granularity | Per-service             | All-or-nothing  |
| Upgrade Independence | Independent             | Must coordinate |
| Configuration        | Simple                  | Complex         |
| Scaling              | Unlimited               | Limited         |
| Resource Usage       | Higher overhead         | Lower           |

#### Why Dedicated Databases

- Matches DR philosophy (independent, rebuildable services)
- Simpler operations (no special management tools)
- Better disaster recovery (restore services independently)
- Future-proof (no architectural limits on service count)

---

## Design Principles

Based on documented user pain points, the system must follow these principles:

### 1. Be Proactive, Not Reactive

- Fix permission issues before they cause problems
- Create required files before they're needed
- Pre-create directories with correct ownership

### 2. Provide Sensible Defaults

- Every variable has a default or clear error
- Generate secure values for secrets automatically
- Works out of the box for common cases

### 3. Give Clear Error Messages

- When something fails, tell user exactly what to do
- Never fail silently
- Include actionable guidance in error messages

### 4. Support Idempotent Operations

- Safe to run commands multiple times
- Handle "already done" gracefully
- No destructive side effects on re-run

### 5. Verify Reality

- Don't trust marker files; check actual state
- Verify prerequisites before proceeding
- Detect actual system state, don't assume

### 6. Use Generous Timeouts

- Real-world DNS is slower than development
- Network operations need slack
- Progress indication for long operations

### 7. Maintain Backward Compatibility

- Migration paths for changing variable names
- Aliasing between old and new conventions
- No silent breakage on upgrades

### 8. Detect Environment Context

- Handle interactive vs background environments
- Adapt to different shell types and distributions
- Work on fresh minimal installations

### 9. Provide Comprehensive Service Setup

- Services need documentation, not just container definitions
- Include post-enable checklists
- Troubleshooting guidance included

### 10. Support Progressive Disclosure

- Basic options first, advanced options available
- Don't overwhelm new users
- Power users can access full control

---

## Success Criteria

### User Experience Metrics

| Metric                      | Target                                |
| --------------------------- | ------------------------------------- |
| Time to first service       | Under 5 minutes (excluding downloads) |
| Setup completion rate       | > 90% without errors                  |
| Service enable success rate | > 95% first attempt                   |
| Disaster recovery time      | Under 15 minutes to full restore      |

### Project Metrics

| Metric                     | Target                  |
| -------------------------- | ----------------------- |
| Supported services         | 30+ curated services    |
| Test coverage              | > 80%                   |
| Documentation completeness | All commands documented |

### User Satisfaction Indicators

| Indicator           | Description                                      |
| ------------------- | ------------------------------------------------ |
| **Speed**           | Quick wins (first service running rapidly)       |
| **Predictability**  | Operations work the same way across all services |
| **Discoverability** | Easy to find and understand available services   |
| **Safety**          | No destructive surprises; backups are easy       |
| **Flexibility**     | Customization without forking the project        |

---

## Implementation Alignment Review (2026-03-07)

This section records a point-in-time review of the current implementation
against the requirements in this PRD. It does not change the product goals.

| Area                                   | Status                              | Notes                                                                                                                                         |
| -------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core product direction**             | On track                            | The current branch still matches the original goal: a single-server homelab manager that favors disaster recovery over high availability.     |
| **FR1 Multi-Container Management**     | Implemented                         | Consistent command flows, service lifecycle management, and centralized status handling are present.                                          |
| **FR2 SSL/TLS Certificate Management** | Implemented with current constraint | Caddy-based HTTPS and DNS challenge automation are present. Current implementation is Cloudflare-first rather than broadly provider-agnostic. |
| **FR3 Service Discovery & Catalog**    | Implemented                         | Catalog browsing, metadata display, category grouping, and search are present.                                                                |
| **FR4 Configuration Management**       | Implemented                         | Layered config, validation, generated secrets, and clear command flows are present.                                                           |
| **FR5 Disaster Recovery**              | Partial                             | Backup and restore commands exist, but database dump automation and fuller 3-2-1 offsite coverage are still outstanding.                      |
| **FR6 Service Lifecycle**              | Implemented                         | Enable, disable, update, logs, and dependency-aware lifecycle operations are present.                                                         |
| **FR7 Internal DNS Resolution**        | Partial                             | CoreDNS generation and management are implemented, but event-driven automatic registration and full sync behavior remain backlog work.        |
| **US3.1 Hardware acceleration**        | Not yet implemented                 | Data structures allow for it, but no end-user workflow is complete yet.                                                                       |
| **US3.3 SSO**                          | Not yet implemented                 | Auth services exist in the catalog, but a cross-service SSO workflow is not complete.                                                         |
| **US4.2 Automated offsite backups**    | Not yet implemented                 | Scheduling and remote destinations are not implemented yet.                                                                                   |
| **Supported services target**          | At risk                             | The PRD target is 30+ curated services; the current catalog is 24 services.                                                                   |

### Review Conclusion

The project is still aligned with the original vision. The main remaining gaps
are completeness and automation items, especially in disaster recovery and DNS,
not a drift away from the intended product.

---

## Non-Goals

The following are explicitly out of scope:

| Non-Goal                          | Rationale                             |
| --------------------------------- | ------------------------------------- |
| **Multi-node orchestration**      | Single-server focus per philosophy    |
| **High availability**             | Explicitly rejected per DR philosophy |
| **Windows support**               | Linux (Debian/Ubuntu) only            |
| **Arbitrary service definitions** | Curated catalog ensures quality       |
| **Zero-downtime deployments**     | Accept brief downtime for simplicity  |
| **Service replication**           | Single-instance per philosophy        |

---

## Decision Points

The following implementation decisions require evaluation:

### DP1: User Interface Approach

| Option                 | Pros                                                | Cons                                      |
| ---------------------- | --------------------------------------------------- | ----------------------------------------- |
| **TUI (Terminal UI)**  | Rich interaction, visual feedback, guided workflows | Requires TUI library, more complex        |
| **Pure CLI**           | Simple, scriptable, universal                       | Less discoverable, steeper learning curve |
| **Web Dashboard**      | Most accessible, visual                             | Requires server, adds complexity          |
| **Hybrid (TUI + CLI)** | Best of both                                        | More development effort                   |

### DP2: Implementation Language/Runtime

| Option              | Pros                                 | Cons                   |
| ------------------- | ------------------------------------ | ---------------------- |
| **TypeScript/Bun**  | Modern, fast, good ecosystem         | Newer runtime          |
| **TypeScript/Node** | Mature, widely deployed              | Slower than Bun        |
| **Go**              | Single binary, fast, Charm ecosystem | Less flexible          |
| **Python**          | Rich ecosystem, familiar             | Requires runtime       |
| **Rust**            | Fast, safe, single binary            | Steeper learning curve |

### DP3: Reverse Proxy

| Option      | Pros                              | Cons                            |
| ----------- | --------------------------------- | ------------------------------- |
| **Traefik** | Label-based, dynamic discovery    | Complex config, plugins for DNS |
| **Caddy**   | Simple Caddyfile, built-in DNS-01 | Centralized config file         |
| **nginx**   | Widely known, performant          | Manual config, no auto-SSL      |

### DP4: Configuration Storage Format

| Option   | Pros                                     | Cons                 |
| -------- | ---------------------------------------- | -------------------- |
| **YAML** | Human-readable, familiar to Docker users | Whitespace-sensitive |
| **TOML** | Simpler syntax, less ambiguous           | Less familiar        |
| **JSON** | Easy to parse, universal                 | Verbose, no comments |

### DP5: Service Catalog Distribution

| Option                  | Pros                                 | Cons                                  |
| ----------------------- | ------------------------------------ | ------------------------------------- |
| **Bundled with tool**   | Simple, version-locked compatibility | Requires tool update for new services |
| **Separate repository** | Independent updates                  | Version compatibility issues          |
| **Registry/API**        | Dynamic updates                      | Network dependency, complexity        |

### DP6: Update Strategy

| Option                             | Pros                      | Cons                       |
| ---------------------------------- | ------------------------- | -------------------------- |
| **Pull-based (user initiates)**    | Predictable, no surprises | User must remember         |
| **Push-based (automatic)**         | Always current            | Potential breaking changes |
| **Notified (alert + user action)** | Awareness without forcing | Middle complexity          |

### DP7: Database Container Strategy

| Option                    | Pros                            | Cons                         |
| ------------------------- | ------------------------------- | ---------------------------- |
| **Dedicated per service** | Isolation, independent recovery | Higher resource usage        |
| **Shared instances**      | Resource efficiency             | Cascade failures, complexity |
| **User choice**           | Flexibility                     | Decision burden              |

### DP8: Internal DNS Approach

| Option                                | Pros                                  | Cons                                          |
| ------------------------------------- | ------------------------------------- | --------------------------------------------- |
| **Label-based DNS (CoreDNS/Joyride)** | Automatic, zero-config, Docker-native | Requires DNS server container                 |
| **Docker internal DNS**               | Built-in, no extra containers         | Limited to container names, no custom domains |
| **External DNS only**                 | Simple, no local DNS                  | Requires external DNS changes, slower         |
| **hosts file management**             | Simple, no server                     | Manual, doesn't scale                         |

---

## Appendix: Pain Points Addressed

| Pain Point                          | How System Must Address                                 |
| ----------------------------------- | ------------------------------------------------------- |
| **Directory/file ownership issues** | Pre-create directories with correct ownership           |
| **Environment variable chaos**      | Single source of truth, clear precedence, guided setup  |
| **Initial setup complexity**        | Guided setup, system detection, sensible defaults       |
| **Container networking issues**     | Non-destructive, idempotent network operations          |
| **Configuration brittleness**       | Generated configs from templates, never edited directly |
| **Silent failures**                 | Explicit error messages, validation before execution    |
| **State tracking lies**             | Verify actual state, don't trust markers                |
| **Timing/timeout issues**           | Generous defaults, progress indication                  |
| **Installation idempotency**        | All operations safe to re-run                           |

---

## Appendix: Unsolved User Needs

Areas requiring further research:

1. **Configuration Validation** - Know if configuration is correct before starting
2. **Service Health Verification** - Automated testing after setup
3. **Simplified Updates** - One-command update with breaking change handling
4. **Better Error Recovery** - Clear guidance and automated rollback
5. **Multi-Environment Support** - Development/staging/production separation
6. **Operational Visibility** - Audit trail for troubleshooting

---

*Document Version: 1.0*
*Source: Consolidated from docs/research/ (01-09)*
