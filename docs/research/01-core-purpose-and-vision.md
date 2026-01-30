# Core Purpose & Vision

## Problem Statement

Self-hosting enthusiasts and homelab operators face a **complexity gap**:

- **Too simple:** Managing services manually leads to configuration sprawl
- **Too complex:** Enterprise orchestration platforms are overkill for home environments

There's no middle ground that provides:
- Easy management of many Docker containers (10-50+)
- Consistent SSL/TLS across all containers via a single reverse proxy
- Simple disaster recovery
- Low operational overhead

## Target Users

**Primary:** Homelab enthusiasts and self-hosting hobbyists who:
- Want to host 5-50+ Docker containers
- Have a Debian/Ubuntu Linux server and personal domain
- Prefer CLI-based tools over web UIs for management
- Need disaster recovery without high-availability complexity
- Want quick setup without deep Docker expertise

**Secondary:** Small infrastructure teams needing rapid deployment and reproducibility

## Core Philosophy

> "Disaster Recovery over High Availability"

| High Availability (Rejected) | Disaster Recovery (Embraced) |
|------------------------------|------------------------------|
| Complex distributed infrastructure | Simple single-server setup |
| Minimizes downtime through redundancy | Accepts brief downtime for simplicity |
| Many moving parts to maintain | Few critical components |
| Expensive and overkill for hobbies | Cost-effective and pragmatic |

### Practical Implications

**What this philosophy provides:**
- 3-2-1 backup strategy (3 copies, 2 media types, 1 offsite)
- Configuration-as-code that's easily reproducible
- Ability to rebuild entire stack from backups
- Emphasis on automated backups and restore procedures

**What it explicitly does NOT provide:**
- Service replication across multiple nodes
- Automatic failover
- High availability guarantees

## User Needs Being Addressed

### 1. Multi-Container Management Complexity
- Managing dozens of Docker containers with consistent configuration is overwhelming
- Each container requires unique setup, environment variables, volumes, and networking
- **Need:** Convention-based approach that auto-generates configuration

### 2. SSL/TLS Certificate Management
- Manually managing SSL certificates across multiple Docker containers is tedious
- Renewal requires coordination across all containers
- **Need:** Centralized, automated certificate management (handled by Traefik reverse proxy)

### 3. Quick Recovery from Failures
- Traditional HA approaches are overkill for hobby deployments
- Need to rebuild infrastructure quickly after hardware failure
- **Need:** Backup-and-restore focused on configuration reproducibility

### 4. Low Operational Overhead
- Users don't want to become full-time sysadmins
- Updates, monitoring, and maintenance should be simple
- **Need:** Consistent commands and patterns across all Docker containers

## Success Criteria

From a user's perspective, success means:

1. **Speed to First Service:** Quick wins (first service running rapidly)
2. **Predictability:** Operations work the same way across all services
3. **Discoverability:** Easy to find and understand available services
4. **Safety:** No destructive surprises; backups are easy
5. **Flexibility:** Customization without forking the entire project

## Why Users Self-Host

Understanding the motivations behind self-hosting:

| Category | User Motivation |
|----------|-----------------|
| **Media Servers** | Replace streaming subscriptions, own content library |
| **Download Automation** | Automate content acquisition and organization |
| **Photo Management** | Replace cloud photo storage, maintain privacy |
| **Monitoring** | Visibility into system and service health |
| **Authentication** | Unified identity, no external dependencies |
| **Game Servers** | Host games for friends/family |
| **Development Tools** | Self-hosted repos, CI/CD, code collaboration |
| **Home Automation** | Smart home without cloud dependencies |
| **AI/ML Tools** | Local AI capabilities, data privacy |
| **File Sync/Share** | Replace Dropbox/Google Drive |

**Common thread:** Users want to replace cloud services with self-hosted alternatives for:
- **Privacy:** Data stays on their hardware
- **Cost:** No recurring subscriptions
- **Control:** No vendor lock-in or service shutdowns
- **Learning:** Technical skill development

## Why Not Alternatives?

| Aspect | Manual Setup | Enterprise Orchestration | OnRamp |
|--------|--------------|--------------------------|--------|
| Learning Curve | Per-service | Steep | Gentle |
| Configuration | Per-service | Complex | Automated |
| SSL Management | Manual | Manual | Automated |
| Disaster Recovery | Your problem | Complex | Simple |
| Suitable For | Small deployments | Production enterprise | Home deployments |
