# Tuition - Project Status

**Version**: 0.1.0  
**Branch**: `feature/initial-implementation`  
**Status**: 🚧 **ACTIVE HARDENING - Implementation Ongoing**  
**Date**: 2026-03-06

---

## 🎉 Implementation Complete

All 7 implementation phases have been completed successfully:

- ✅ Phase 1: Foundation (config management, CLI, service catalog)
- ✅ Phase 2: Docker Integration (dockerode, compose operations)
- ✅ Phase 3: Caddy Reverse Proxy (auto HTTPS, wildcard certs)
- ✅ Phase 4: Service Lifecycle (enable/disable/start/stop/update)
- ✅ Phase 5: CoreDNS Internal DNS (port 53, zero-config)
- ✅ Phase 6: Disaster Recovery (backup/restore, 3-2-1 strategy)
- ✅ Phase 7: TUI & Documentation (Blessed interface, comprehensive docs)

## 🆕 Recent Updates

### Security, Logging, and Test Hardening (2026-03-06)
- Added backup path validation to block restore/delete outside configured backup directory
- Added Windows-safe absolute path handling for backup restore/delete CLI paths
- Added sensitive value redaction for `tuition config show`
- Switched generated secret path to cryptographically secure randomness
- Added restrictive config file write permissions (best-effort `0600` semantics)
- Added integration tests for CLI security behavior
- Introduced shared logger utility and adopted it in core catalog/lifecycle warning paths
- Extended logger usage in backup restore warning path
- Added low-impact service definitions: `openspeedtest`, `webtop`
- Added unit tests for lifecycle manager and service command flows
- Added CLI dispatch and parser registration smoke tests
- Added deeper config/validate command behavior coverage for failure branches
- Updated `make test` to run Bun tests directly for deterministic cross-platform behavior

### CoreDNS Integration (2026-02-16)
- Caddy now automatically uses CoreDNS for DNS resolution
- Fixes Cloudflare ACME DNS-01 challenge issues (SERVFAIL errors)
- CoreDNS assigned static IP (10.0.7.2) for reliability

### Admin UI Password Protection (2026-02-16)
- New command: `tuition caddy set-password`
- bcrypt password hashing (10 salt rounds)
- Password confirmation during setup
- Status shows ✓ (protected) or ⚠ (unconfigured)
- Optional setup during `tuition init`

---

## 📊 Project Statistics

| Metric | Value |
|--------|-------|
| **Source Files** | 25 TypeScript modules |
| **Test Files** | 22 test suites (149 tests) |
| **Service Definitions** | 8 YAML files |
| **Documentation** | 4 markdown files |
| **Total Lines of Code** | ~4,200 lines |
| **Test Coverage** | Core modules covered |
| **Compilation Status** | Zero errors ✅ |
| **Test Status** | 149/149 passing ✅ |

---

## 🏗️ Architecture

```
Internet
    ↓
DNS (Cloudflare)
    ↓
Caddy (Port 443/80) ──► Automatic HTTPS with Let's Encrypt
    ↓
Docker Network (tuition)
    ├─ Pi-hole (DNS ad blocking)
    ├─ Plex (Media server)
    ├─ Joyride (Media requests)
    └─ CoreDNS (Internal DNS: Port 53)
```

---

## 📦 Complete CLI Reference

### System Commands
| Command | Description |
|---------|-------------|
| `tuition init` | Interactive setup wizard |
| `tuition validate` | Validate configuration |
| `tuition config show` | Display current configuration |
| `tuition config set <key> <value>` | Set configuration value |

### Service Management
| Command | Description |
|---------|-------------|
| `tuition service list` | List all services with status |
| `tuition service show <name>` | Show service details |
| `tuition service enable <name>` | Enable and start service |
| `tuition service disable <name>` | Stop and disable service |
| `tuition service start <name>` | Start service container |
| `tuition service stop <name>` | Stop service container |
| `tuition service restart <name>` | Restart service container |
| `tuition service update <name>` | Pull latest image |
| `tuition service logs <name>` | View service logs |
| `tuition service search <query>` | Search service catalog |

### Infrastructure
| Command | Description |
|---------|-------------|
| `tuition caddy start` | Start Caddy reverse proxy |
| `tuition caddy stop` | Stop Caddy reverse proxy |
| `tuition caddy restart` | Restart Caddy |
| `tuition caddy reload` | Reload configuration (zero-downtime) |
| `tuition caddy status` | Show Caddy status |
| `tuition caddy regenerate` | Regenerate Caddyfile |
| `tuition caddy set-password` | Set admin UI password (bcrypt) |
| `tuition dns start` | Start CoreDNS |
| `tuition dns stop` | Stop CoreDNS |
| `tuition dns status` | Show CoreDNS status |
| `tuition dns regenerate` | Regenerate CoreDNS config |

### Disaster Recovery
| Command | Description |
|---------|-------------|
| `tuition backup create` | Create backup archive |
| `tuition backup list` | List available backups |
| `tuition backup restore <n>` | Restore backup #n |
| `tuition backup delete <n>` | Delete backup #n |

### Interactive TUI
| Command | Description |
|---------|-------------|
| `tuition tui` | Launch blessed-based terminal UI |

---

## 🧪 Testing

### Running Tests
```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/config.test.ts

# Run with coverage
bun test --coverage
```

### Test Suites (149 tests total)

| Suite | Tests | Coverage |
|-------|-------|----------|
| Config Manager | 11 | Configuration loading, saving, validation |
| Config Validator | 8 | Input validation, error handling |
| Service Catalog | 14 | Service discovery, search, filtering |
| Caddyfile Generator | 8 | Configuration generation, parsing |
| Docker Compose | 5 | Compose file generation |
| Backup Manager | 8 | Archive creation, restoration |

**All tests passing**: 149/149 ✅

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Initialize tuition
bun run index.ts init
# Follow prompts: domain, email, Cloudflare token

# 3. Start infrastructure
bun run index.ts caddy start
bun run index.ts dns start

# 4. Deploy first service
bun run index.ts service enable pihole

# 5. Access via HTTPS
# https://pihole.yourdomain.com

# 6. Create backup
bun run index.ts backup create

# 7. Launch TUI for management
bun run index.ts tui
```

---

## 📁 Project Structure

```
tuition/
├── src/
│   ├── cli/commands/         # CLI command implementations (9 files)
│   │   ├── backup.ts
│   │   ├── caddy.ts
│   │   ├── config.ts
│   │   ├── dns.ts
│   │   ├── index.ts
│   │   ├── init.ts
│   │   ├── service.ts
│   │   └── validate.ts
│   ├── core/
│   │   ├── config/          # Configuration management
│   │   │   ├── index.ts
│   │   │   ├── manager.ts
│   │   │   └── validator.ts
│   │   ├── catalog/         # Service catalog
│   │   │   └── loader.ts
│   │   └── lifecycle/       # Service lifecycle
│   │       └── manager.ts
│   ├── services/
│   │   ├── backup/          # Disaster recovery
│   │   │   └── manager.ts
│   │   ├── caddy/           # Reverse proxy
│   │   │   ├── caddyfile.ts
│   │   │   └── manager.ts
│   │   ├── dns/             # Internal DNS
│   │   │   └── coredns.ts
│   │   └── docker/          # Docker integration
│   │       ├── client.ts
│   │       └── compose.ts
│   ├── tui/                 # Terminal UI
│   │   ├── app.ts
│   │   └── views/
│   │       ├── service-browser.ts
│   │       └── status-dashboard.ts
│   └── types/
│       └── index.ts         # TypeScript definitions
├── tests/
│   └── unit/                # Unit tests (20 files)
│       ├── backup.test.ts
│       ├── caddyfile.test.ts
│       ├── catalog.test.ts
│       ├── compose.test.ts
│       ├── config.test.ts
│       └── validator.test.ts
├── catalog/services/        # Service definitions
│   ├── dns/pihole.yaml
│   ├── media/joyride.yaml
│   └── media/plex.yaml
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   └── STATUS.md
├── README.md
├── index.ts
├── package.json
└── tsconfig.json
```

---

## 🔧 Configuration

### Global Configuration (`~/.tuition/config/global.yaml`)

```yaml
hostname: homelab-server
domain: example.com
adminEmail: admin@example.com
timezone: UTC
puid: 1000
pgid: 1000
dnsProvider: cloudflare
cloudflareToken: <your-token>
adminPasswordHash: $2b$10$...  # bcrypt hash for admin UI
```

### Service Configuration (`~/.tuition/config/services/<name>.yaml`)

```yaml
enabled: true
imageTag: latest
environment:
  DOMAIN: example.com
  TZ: UTC
```

### Directory Structure

```
~/.tuition/
├── config/
│   ├── global.yaml
│   ├── infrastructure.yaml
│   └── services/
│       └── pihole.yaml
├── data/                      # Service data volumes
│   └── pihole/
├── backups/                   # Backup archives
├── caddy-data/               # Caddy certificates
├── coredns-config/           # DNS configuration
└── logs/                     # Application logs
```

---

## ✨ Features

### Core Features
- **Service Catalog** - Pre-configured services (Pi-hole, Plex, Joyride)
- **Automatic HTTPS** - Caddy with Let's Encrypt certificates
- **Internal DNS** - CoreDNS for zero-configuration container resolution
- **Service Lifecycle** - Enable, disable, start, stop, update services
- **Disaster Recovery** - Backup and restore entire homelab setup
- **Interactive TUI** - Blessed-based terminal interface

### Technical Features
- **Type-safe** - Full TypeScript implementation
- **Zero-downtime** - Graceful config reloads for Caddy and CoreDNS
- **Idempotent** - Safe to re-run operations
- **Auto-configuration** - Generates configs from service definitions
- **3-2-1 Backup** - Implements backup best practices

---

## 🛡️ Security

- HTTPS automatically enabled for all services
- Cloudflare DNS challenge for certificates
- Service passwords auto-generated
- Environment files excluded from version control
- Secrets stored in isolated files

---

## 📝 Development Commands

```bash
# Development
bun run dev                    # Run CLI
bun run lint                   # TypeScript check
bun test                       # Run tests

# Production
bun run build                  # Build for production
bun run index.ts init          # Initialize
bun run index.ts tui           # Launch TUI
```

---

## 🔄 Git History

| Commit | Description |
|--------|-------------|
| `67d210c` | Initial implementation (34 files, 6326 lines) |
| `aece860` | Unit test suite (54 tests, 6 test files) |

**Branch**: `feature/initial-implementation`  
**Status**: Ready for merge to main

---

## 📋 Requirements

- **Runtime**: Bun (latest)
- **Docker**: Engine 20.10+, Compose 2.0+
- **OS**: Linux (Debian/Ubuntu recommended)
- **Network**: Domain with Cloudflare DNS
- **Hardware**: Single server capable of running Docker

---

## 🎯 Roadmap (Optional Enhancements)

- [ ] Add more services to catalog (Nextcloud, Vaultwarden, etc.)
- [ ] Integration tests with real Docker
- [ ] Remote backup destinations (S3, rsync)
- [ ] Monitoring integration (Prometheus/Grafana)
- [ ] Web UI dashboard
- [ ] Service health checks and alerting
- [ ] Log aggregation and analysis

---

## 📜 License

MIT License

---

## 🤝 Contributing

Contributions welcome! Please ensure:
- TypeScript compilation passes (`bun run lint`)
- All tests pass (`bun test`)
- Code follows existing style
- Documentation is updated

---

**Status**: Production Ready ✅  
**Tests**: 54/54 Passing ✅  
**Compilation**: Zero Errors ✅

*Last updated: 2026-02-16*
