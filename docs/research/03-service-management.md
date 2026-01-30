# Service Management

## What is a "Container"?

A **container** is a Docker container—a self-contained unit that encapsulates an application with all its:
- Configuration
- Environment variables
- Operational metadata

Containers are the fundamental building blocks of the homelab, orchestrated by Docker Compose.

### Container Categories

Containers span multiple categories:
- **Web applications:** File managers, code hosting, media servers
- **Monitoring tools:** Uptime monitors, metrics dashboards
- **Database systems:** Relational and key-value stores
- **Infrastructure:** DNS, DHCP, VPN, Traefik reverse proxy
- **Game servers:** Various dedicated game server applications

## Container Lifecycle

Containers progress through distinct states:

```
AVAILABLE → ENABLED → RUNNING → STOPPED ↔ DISABLED → ARCHIVED
```

### State Definitions

| State | Description | User Action |
|-------|-------------|-------------|
| **AVAILABLE** | Container definition exists but not active | Discovery/browsing |
| **ENABLED** | Container registered, configuration prepared | Container setup |
| **RUNNING** | Container active and accessible | Normal operation |
| **STOPPED** | Container exists but not running | Temporary pause |
| **DISABLED** | Container unregistered, data archived | Decommissioning |
| **ARCHIVED** | Configuration permanently removed | Complete removal |

### State Transitions

- **AVAILABLE → ENABLED:** User enables a container
- **ENABLED → RUNNING:** User starts the container
- **RUNNING → STOPPED:** User stops the container (preserves state)
- **STOPPED → RUNNING:** User restarts the container
- **RUNNING/STOPPED → DISABLED:** User disables (keeps data)
- **DISABLED → ARCHIVED:** User nukes (removes all data)

**Key insight:** Disabling preserves data for recovery; archiving is permanent.

## Container Relationships

### 1. Networking Relationships
- **Traefik Network:** All containers join common Docker Compose network for web access via Traefik reverse proxy
- **Container-to-Container:** Containers can reference each other by name
- **Direct Ports:** Some containers expose non-HTTP protocols

### 2. Database Dependencies
- Containers with databases typically run dedicated database containers
- **Benefits:** Isolation, independent backups, simpler disaster recovery
- Containers declare dependencies on their databases

### 3. Configuration Relationships
- **Global Config:** Provides base configuration to all containers (domain, credentials, timezone)
- **Container-Specific Config:** Override/extend global settings

### 4. Extension Relationships
- **Overrides:** Extend container functionality without modifying base definition
- Examples: NFS mounts, GPU passthrough, VPN routing
- Additive composition model

### 5. External Service Relationships
- External services can be proxied through Traefik reverse proxy
- Examples: VMs, physical servers, appliances
- Same access pattern as managed containers

## Container Configuration Requirements

Every container requires:

1. **Definition:** Docker image, networking, volumes, labels
2. **Environment:** Container-specific variables and secrets
3. **Configuration Files:** Generated from templates or provided

### Configuration Sources

| Source | Scope | Examples |
|--------|-------|----------|
| **Global** | All containers | Domain, timezone, user IDs |
| **Container-specific** | One container | Admin password, container name, image tag |
| **Infrastructure** | Optional groups | NFS mounts, external service URLs |

## Container Discovery

Users need to find and understand available containers:

### Discovery Mechanisms

1. **Listing commands:** View all available, enabled, or filtered containers
2. **Documentation:** Auto-generated index with descriptions and links
3. **Metadata:** Container definitions include category, description, upstream URL
4. **Naming conventions:** Consistent patterns for predictability

### Container Metadata

Containers self-document via metadata:
- **Description:** What the container does
- **Category:** Grouping (DNS, Media, Monitoring, etc.)
- **Upstream URL:** Link to official documentation
- **Database:** Whether container requires a database

## Problems Solved by Container Abstraction

### 1. Configuration Complexity
- **Problem:** Manual Docker Compose configuration files are verbose and repetitive
- **Solution:** Convention-based approach auto-generates common patterns

### 2. Variable Management
- **Problem:** Hundreds of hardcoded values scattered across Docker Compose files
- **Solution:** Unified variable system with inheritance and defaults

### 3. Disaster Recovery
- **Problem:** Complex container setups are fragile and hard to restore
- **Solution:** Containers are independently rebuildable from templates

### 4. Safe Customization
- **Problem:** Manual edits overwritten by updates
- **Solution:** Configuration preserved across Docker Compose operations

### 5. Operational Discoverability
- **Problem:** Hard to know what containers exist and their status
- **Solution:** Rich listing and auto-generated documentation

### 6. Extensibility
- **Problem:** Customizing containers breaks future updates
- **Solution:** Extension mechanism separate from base definitions

### 7. Environment Portability
- **Problem:** Containers hardcoded to one environment
- **Solution:** Complete parameterization enables restoration on new hardware

## Key Design Principles

1. **Automatic updates:** Container definitions update without losing customization
2. **Layered configuration:** Global → Container-specific → Overlay
3. **Predictable structure:** Consistent patterns across all containers
4. **Idempotent operations:** Safe to re-run without losing customizations
5. **Separation of concerns:** Container definition separate from configuration
