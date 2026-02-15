# Tuition - Implementation Plan

## Executive Summary

This document outlines the phased implementation strategy for Tuition, a terminal-based homelab management tool. The plan prioritizes delivering core functionality quickly while maintaining quality and adhering to the disaster recovery philosophy.

---

## Technology Decisions

Based on the Decision Points in the PRD:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Language** | **TypeScript/Bun** | Fast runtime, modern ecosystem, excellent for CLI/TUI tools, good Docker API libraries |
| **UI Approach** | **Hybrid (CLI + TUI)** | CLI for scripting/automation, TUI for discoverability and guided workflows |
| **Reverse Proxy** | **Traefik** | Native Docker label support, dynamic discovery, widely used in homelab community |
| **Config Format** | **YAML** | Docker ecosystem standard, familiar to target users, human-readable |
| **Service Catalog** | **Bundled with tool** | Version-locked compatibility, simpler distribution, controlled quality |
| **Update Strategy** | **Notified + User Action** | Awareness without surprises, allows breaking change review |
| **Database Strategy** | **Dedicated per service** | Better isolation, independent recovery, simpler operations |
| **Internal DNS** | **Label-based (CoreDNS)** | Zero-config, Docker-native, automatic registration |

---

## Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  CLI Parser  │  │   TUI App    │  │   Commands   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Core Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Config Mgr   │  │ Catalog Svc  │  │ Lifecycle    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Container    │  │ SSL Manager  │  │ Backup/DR    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ DNS Manager  │  │ State Engine │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Docker API   │  │ Compose CLI  │  │ File System  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Traefik Mgr  │  │ CoreDNS Mgr  │  │ Cert Bot     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
tuition/
├── src/
│   ├── cli/                    # Command-line interface
│   │   ├── commands/           # CLI commands (init, enable, disable, etc.)
│   │   └── parser.ts           # Argument parsing
│   ├── tui/                    # Terminal UI components
│   │   ├── app.ts              # Main TUI application
│   │   ├── views/              # Screen views
│   │   └── components/         # Reusable UI components
│   ├── core/                   # Core business logic
│   │   ├── config/             # Configuration management
│   │   │   ├── loader.ts       # Config loading/parsing
│   │   │   ├── validator.ts    # Config validation
│   │   │   └── hierarchy.ts    # Tier config (global → service)
│   │   ├── catalog/            # Service catalog
│   │   │   ├── loader.ts       # Load service definitions
│   │   │   ├── registry.ts     # Service registry
│   │   │   └── types.ts        # Service metadata types
│   │   ├── lifecycle/          # Service lifecycle
│   │   │   ├── engine.ts       # State machine
│   │   │   ├── states.ts       # State definitions
│   │   │   └── transitions.ts  # State transitions
│   │   └── state/              # System state tracking
│   │       ├── detector.ts     # Actual state detection
│   │       └── store.ts        # State persistence
│   ├── services/               # Infrastructure services
│   │   ├── docker/             # Docker integration
│   │   │   ├── client.ts       # Docker API client
│   │   │   ├── compose.ts      # Docker Compose operations
│   │   │   └── network.ts      # Network management
│   │   ├── traefik/            # Reverse proxy
│   │   │   ├── generator.ts    # Dynamic config generation
│   │   │   └── manager.ts      # Traefik lifecycle
│   │   ├── dns/                # Internal DNS
│   │   │   ├── coredns.ts      # CoreDNS management
│   │   │   └── registrar.ts    # Container DNS registration
│   │   ├── ssl/                # Certificate management
│   │   │   ├── certbot.ts      # Let's Encrypt integration
│   │   │   └── manager.ts      # Certificate lifecycle
│   │   └── backup/             # Disaster recovery
│   │       ├── exporter.ts     # Backup creation
│   │       ├── importer.ts     # Restore operations
│   │       └── scheduler.ts    # Automated backups
│   ├── types/                  # TypeScript definitions
│   ├── utils/                  # Utilities
│   └── constants.ts            # Constants
├── catalog/                    # Bundled service catalog
│   ├── services/               # Service definitions
│   │   ├── media/              # Media servers (jellyfin, plex, etc.)
│   │   ├── dns/                # DNS services (pihole, etc.)
│   │   ├── monitoring/         # Monitoring (prometheus, grafana)
│   │   ├── downloads/          # Download automation
│   │   ├── auth/               # Authentication services
│   │   └── _templates/         # Service templates
│   └── categories.yaml         # Category definitions
├── templates/                  # Configuration templates
│   ├── docker-compose/         # Compose file templates
│   ├── env/                    # Environment file templates
│   └── traefik/                # Traefik config templates
├── tests/                      # Test suite
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── fixtures/               # Test fixtures
├── docs/                       # Documentation
├── scripts/                    # Build/deployment scripts
├── bunfig.toml                 # Bun configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
└── README.md
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Basic project structure and configuration management

#### Deliverables
- [ ] Project initialization with Bun/TypeScript
- [ ] Build and test infrastructure
- [ ] Configuration hierarchy implementation (Global → Infrastructure → Per-Service)
- [ ] Configuration validation framework
- [ ] Environment file management (auto-generation, isolation)
- [ ] Initial CLI framework with basic commands

#### Key Components
- Config loader with YAML parsing
- Config validator with helpful error messages
- Environment file generator
- Basic CLI (init, config, validate commands)

#### Success Criteria
- Can initialize a new tuition project
- Can load and validate tiered configuration
- Can generate secure passwords automatically
- All operations are idempotent

---

### Phase 2: Service Catalog & Docker Integration (Weeks 3-4)
**Goal**: Service discovery and basic container management

#### Deliverables
- [ ] Service catalog data model and loader
- [ ] Service metadata schema (description, category, requirements)
- [ ] Docker API client integration
- [ ] Docker Compose operations (up, down, ps, logs)
- [ ] Basic service enable/disable
- [ ] Initial curated services (5-10 essential services)

#### Key Components
- Service registry
- Catalog browser (CLI)
- Docker client wrapper
- Compose file generator from templates
- Service enablement workflow

#### Success Criteria
- Can browse available services
- Can enable a service and have containers start
- Can view container status and logs
- Can disable a service without data loss

---

### Phase 3: Reverse Proxy & SSL (Weeks 5-6)
**Goal**: Automated SSL and web access for services

#### Deliverables
- [ ] Traefik container management
- [ ] Dynamic route generation from service labels
- [ ] Let's Encrypt certificate automation
- [ ] DNS-01 challenge support (common providers)
- [ ] Wildcard certificate support
- [ ] Service exposure control (enable/disable proxy routes)

#### Key Components
- Traefik manager
- Label-based route generator
- Certificate manager
- DNS provider integrations (Cloudflare, DigitalOcean, etc.)

#### Success Criteria
- Services accessible via HTTPS on configured domain
- Automatic SSL certificate generation
- Wildcard cert covers all subdomains
- Certificate renewal automated

---

### Phase 4: Service Lifecycle & State Management (Weeks 7-8)
**Goal**: Complete service state machine and lifecycle operations

#### Deliverables
- [ ] State machine implementation (Available → Enabled → Running → Stopped → Disabled)
- [ ] State detection engine (verify reality, not markers)
- [ ] Service dependency management
- [ ] Update mechanism (pull latest images)
- [ ] Service logs aggregation
- [ ] Health check integration

#### Key Components
- State engine with transitions
- Real state detector (queries Docker, not files)
- Dependency resolver
- Update manager
- Log aggregator

#### Success Criteria
- Accurate state tracking without marker files
- Services can depend on other services
- Can update services to latest versions
- Can view logs from all services in one place

---

### Phase 5: Internal DNS (Weeks 9-10)
**Goal**: Zero-configuration DNS for containers

#### Deliverables
- [ ] CoreDNS container management
- [ ] Docker event watcher for container labels
- [ ] Automatic DNS record generation
- [ ] Static host entries support
- [ ] DNS sync with reverse proxy routes
- [ ] Local DNS resolution setup

#### Key Components
- CoreDNS manager
- Docker events listener
- DNS record generator
- Hosts file editor

#### Success Criteria
- Containers accessible by hostname within network
- No manual DNS configuration needed
- Static hosts supported for non-container services
- Works independently of external DNS

---

### Phase 6: Disaster Recovery (Weeks 11-12)
**Goal**: Backup and restore capabilities

#### Deliverables
- [ ] Backup exporter (config, databases, volumes)
- [ ] Backup scheduler
- [ ] Restore importer
- [ ] Database dump integration
- [ ] 3-2-1 backup strategy support
- [ ] Disaster recovery testing commands

#### Key Components
- Backup manager with tiered approach
- Database dumpper (MySQL, PostgreSQL, etc.)
- Archive creator
- Restore validator
- Scheduler (cron-based or systemd timer)

#### Success Criteria
- Can backup entire configuration in single operation
- Can restore to new hardware from backup
- Database dumps included automatically
- Backup excludes regeneratable data (logs, caches)

---

### Phase 7: TUI & Advanced Features (Weeks 13-14)
**Goal**: Rich terminal interface and power user features

#### Deliverables
- [ ] Interactive TUI application
- [ ] Service browser with filtering/search
- [ ] Dashboard view (status, health, resource usage)
- [ ] Setup wizard
- [ ] Hardware acceleration support (GPU passthrough)
- [ ] External service proxy support

#### Key Components
- TUI framework (Bubble Tea or similar)
- Interactive service browser
- Status dashboard
- Setup wizard workflow
- GPU detection and configuration

#### Success Criteria
- First-time users can set up via guided TUI
- Can browse and filter services visually
- Real-time status dashboard
- GPU passthrough configurable

---

### Phase 8: Polish & Documentation (Weeks 15-16)
**Goal**: Production readiness and comprehensive docs

#### Deliverables
- [ ] Complete CLI command set
- [ ] Comprehensive error messages with actionable guidance
- [ ] User documentation and guides
- [ ] Service-specific documentation
- [ ] Test coverage > 80%
- [ ] Release packaging

#### Key Components
- Help system
- Documentation generator
- Test suite completion
- Release automation

#### Success Criteria
- All PRD requirements met
- Documentation complete for all features
- Tests passing with > 80% coverage
- Release artifacts available

---

## Testing Strategy

### Unit Tests
- Configuration loading and validation
- State machine transitions
- Template rendering
- Utility functions

### Integration Tests
- Docker API interactions
- Compose operations
- File system operations
- Backup/restore workflows

### End-to-End Tests
- Full installation workflow
- Service enable/disable cycles
- Backup and restore scenarios
- Error handling paths

### Test Fixtures
- Sample configurations
- Mock Docker responses
- Service definitions
- Backup archives

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Docker API complexity | Use established libraries (dockerode), thorough testing |
| Traefik configuration errors | Validation before application, rollback capability |
| SSL certificate failures | Graceful fallback, clear error messages |
| State tracking inaccuracy | Verify actual Docker state, not marker files |
| Breaking Docker changes | Pin tested versions, update testing |
| Configuration complexity | Guided setup, sensible defaults, validation |

---

## Milestones

| Milestone | Target | Criteria |
|-----------|--------|----------|
| **MVP** | Week 4 | Basic config, catalog, enable/disable working |
| **Alpha** | Week 8 | Reverse proxy, SSL, lifecycle complete |
| **Beta** | Week 12 | DNS, DR, TUI functional |
| **v1.0** | Week 16 | All features complete, tested, documented |

---

## Immediate Next Steps

1. **Create feature branch** `git checkout -b feature/initial-implementation`
2. **Initialize project** with Bun, TypeScript, testing framework
3. **Implement Phase 1** (Foundation) starting with config management
4. **Add first curated services** (simple ones: whoami, portainer)
5. **Test basic enable/disable** workflow

---

## Open Questions for Development

1. **Service catalog format**: YAML files or TypeScript definitions?
2. **TUI library**: Bubble Tea (Go-based but can shell out) vs. Ink (React-based) vs. custom?
3. **Backup storage**: Local + remote options (S3, rsync, etc.)?
4. **Update notifications**: Check GitHub releases or built-in mechanism?
5. **Database versions**: Pin to specific versions or allow floating?

These can be decided during Phase 1 based on prototyping.

---

*Plan Version: 1.0*
*Last Updated: 2026-02-15*
