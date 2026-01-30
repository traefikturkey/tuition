# Research Document Review Prompt

## Objective

Review all research documents in `.chat/research/` and ensure content focuses on user needs while keeping core platform terminology.

## Core Platform (KEEP these terms)

These are foundational and should NOT be abstracted away:
- **Docker** / **Docker Compose** / **containers**
- **Traefik** (reverse proxy)
- **Joyride** (if referenced)
- **CLI-based interface** (command-line driven)
- **Debian/Ubuntu** (target Linux distribution)
- Container-related concepts: images, volumes, networks, labels

## Exclusion Criteria (REMOVE or abstract)

### Specific Services & Applications
- Media servers: Plex, Jellyfin, Emby, etc.
- Download tools: Sonarr, Radarr, Lidarr, etc.
- Monitoring: Prometheus, Grafana, etc.
- Any specific application that runs ON the platform

### Specific Database Engines
- PostgreSQL, MariaDB, MySQL, Redis, Valkey, SQLite
- Abstract to: "database", "relational database", "cache"

### Implementation Mechanisms
- Scaffolding system details
- Templating mechanisms (envsubst, Python templating)
- Make targets and Makefile structure
- File paths and directory structures (services-available/, etc.)
- Specific configuration file formats

### Project-Specific History
- Commit references or hashes
- Dates when features were added
- Development timeline
- What was tried and failed

## Inclusion Criteria (KEEP)

### User Needs
- What users want to accomplish
- Problems users face with Docker/Traefik homelabs
- Goals and motivations
- Decision criteria

### Platform Concepts
- Docker container lifecycle
- Traefik routing and SSL
- Container networking patterns
- Volume management concepts

### User Stories
- "As a user, I want to X so that Y"
- Pain points with Docker homelab management
- Workflow stages

## Examples

**Good (keeps platform, abstracts services):**
> Users enable Docker containers through a simple command. Traefik automatically routes traffic and manages SSL certificates.

**Good (keeps platform concepts):**
> Each service runs in its own Docker container with dedicated configuration. Traefik labels define routing rules.

**Bad (too abstract):**
> Users enable services through a simple command. A reverse proxy automatically routes traffic.

**Bad (too specific on services):**
> Users run `make enable-service plex` to enable Plex, which creates a symlink and generates configuration for the Jellyfin alternative.
