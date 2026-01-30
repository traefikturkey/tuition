# OnRamp Research Documentation

This directory contains research findings for understanding the OnRamp project's goals, user needs, and workflows - abstracted from current implementation details.

**Purpose:** Create a foundation for a PRD that could evaluate alternative approaches to solving the same problems.

## Research Files

| File | Focus Area |
|------|------------|
| [01-core-purpose-and-vision.md](01-core-purpose-and-vision.md) | Problem statement, target users, philosophy |
| [02-user-workflows.md](02-user-workflows.md) | User journey, recurring tasks, user stories |
| [03-service-management.md](03-service-management.md) | Service lifecycle, relationships, conceptual model |
| [04-configuration-management.md](04-configuration-management.md) | Config types, user decisions, templates |
| [05-disaster-recovery.md](05-disaster-recovery.md) | Backup strategy, restore process, data persistence |
| [06-networking-and-access.md](06-networking-and-access.md) | Access patterns, SSL/TLS, exposure control |
| [07-nfs-storage-patterns.md](07-nfs-storage-patterns.md) | **Deep dive:** NFS use cases, decision criteria |
| [08-database-architecture-patterns.md](08-database-architecture-patterns.md) | **Deep dive:** Shared vs dedicated databases |
| [09-user-pain-points.md](09-user-pain-points.md) | **Deep dive:** Friction points, root causes, design principles |

## Key Themes

### Problem Space

OnRamp addresses the **complexity gap** in self-hosting:
- Manual Docker Compose per service → Configuration sprawl
- Kubernetes/Swarm → Overkill for home environments

### Core Philosophy

> "Disaster Recovery over High Availability. Rebuildable in minutes from backups."

### Target Users

Homelab enthusiasts who:
- Want 5-50+ self-hosted services
- Have a Linux server and personal domain
- Need disaster recovery without HA complexity
- Want quick setup without deep Docker expertise

### User Needs (Priority Order)

1. **Data Ownership** - Replace cloud services with self-hosted alternatives
2. **Visibility & Reliability** - Know what's running and that it works
3. **Control & Privacy** - Zero external dependencies where possible
4. **Automation** - Reduce manual operational overhead
5. **Community** - Host services for friends/family

## Research Methodology

This research focuses on **WHY** (user needs, goals) rather than **HOW** (implementation).

Content derived from:
- User workflows and journey mapping
- Problem space analysis
- Service and configuration patterns
- Operational friction points

## Next Steps

This research can be used to:
1. Create a PRD describing the problem space without implementation bias
2. Evaluate alternative architectures that could solve the same problems
3. Identify opportunities for simplification or improvement
4. Document user stories for new implementations
