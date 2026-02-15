# Tuition - Homelab Management Tool

A terminal-based management tool for self-hosted homelab services. Simplifies Docker container management with automatic HTTPS, internal DNS, and disaster recovery.

## Features

- **Service Catalog** - Pre-configured services (Pi-hole, Plex, Joyride) ready to deploy
- **Automatic HTTPS** - Caddy reverse proxy with Let's Encrypt certificates
- **Internal DNS** - CoreDNS for zero-configuration container resolution
- **Service Lifecycle** - Enable, disable, start, stop, and update services
- **Disaster Recovery** - Backup and restore entire homelab setup
- **Interactive TUI** - Blessed-based terminal interface

## Quick Start

```bash
# Install dependencies
bun install

# Initialize tuition
bun run index.ts init

# Start infrastructure
bun run index.ts caddy start
bun run index.ts dns start

# Deploy your first service
bun run index.ts service enable pihole

# Launch interactive TUI
bun run index.ts tui
```

## Architecture

```
Internet
    ↓
Caddy (Port 443)
    ↓
Docker Network (tuition)
    ├─ Pi-hole
    ├─ Plex
    └─ CoreDNS (Port 53)
```

## Commands

### System Setup
- `tuition init` - Interactive setup wizard
- `tuition validate` - Validate configuration
- `tuition config show` - Display current configuration
- `tuition config set <key> <value>` - Set configuration value

### Service Management
- `tuition service list` - List all services
- `tuition service show <name>` - Show service details
- `tuition service enable <name>` - Enable and start service
- `tuition service disable <name>` - Disable service
- `tuition service start <name>` - Start service
- `tuition service stop <name>` - Stop service
- `tuition service restart <name>` - Restart service
- `tuition service update <name>` - Update to latest image
- `tuition service logs <name>` - View logs
- `tuition service search <query>` - Search catalog

### Reverse Proxy (Caddy)
- `tuition caddy start` - Start Caddy
- `tuition caddy stop` - Stop Caddy
- `tuition caddy restart` - Restart Caddy
- `tuition caddy reload` - Reload configuration
- `tuition caddy status` - Show status
- `tuition caddy regenerate` - Regenerate Caddyfile

### Internal DNS (CoreDNS)
- `tuition dns start` - Start CoreDNS
- `tuition dns stop` - Stop CoreDNS
- `tuition dns status` - Show status
- `tuition dns regenerate` - Regenerate config

### Disaster Recovery
- `tuition backup create` - Create backup
- `tuition backup list` - List backups
- `tuition backup restore <1>` - Restore backup #1
- `tuition backup delete <1>` - Delete backup #1

### Interactive TUI
- `tuition tui` - Launch blessed-based terminal UI

## Requirements

- Bun runtime (latest)
- Docker Engine 20.10+
- Docker Compose 2.0+
- Linux (Debian/Ubuntu recommended)
- Domain name with Cloudflare DNS

## Configuration

Configuration is stored in `~/.tuition/config/` with tier hierarchy:

```
~/.tuition/
├── config/
│   ├── global.yaml          # Domain, email, credentials
│   ├── infrastructure.yaml  # NFS, external services
│   └── services/
│       └── <name>.yaml      # Per-service config
├── data/                     # Service data volumes
├── backups/                  # Backup archives
└── logs/                     # Application logs
```

## Service Catalog

Services are defined in `catalog/services/` as YAML files:

```yaml
name: pihole
category: dns
description: Network-wide ad blocking
image: pihole/pihole:latest
ports:
  - host: 53
    container: 53
    protocol: tcp
environment:
  TZ: ${TZ}
  WEBPASSWORD: ${PIHOLE_PASSWORD}
volumes:
  - host: ./data/pihole/etc-pihole
    container: /etc/pihole
labels:
  caddy: pihole.${DOMAIN}
  caddy.reverse_proxy: "{{upstreams 80}}"
```

## Development

```bash
# TypeScript check
bun run lint

# Run tests
bun test

# Run CLI
bun run index.ts <command>

# Run TUI
bun run index.ts tui
```

### Testing

The project includes comprehensive unit tests covering:

- **Configuration Management** - Config loading, validation, and persistence
- **Service Catalog** - Service discovery and metadata
- **Caddyfile Generator** - Reverse proxy configuration generation
- **Docker Compose** - Compose file generation and environment handling
- **Backup Manager** - Archive creation and restoration

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/config.test.ts

# Run with coverage
bun test --coverage
```

## Project Structure

```
src/
├── cli/commands/         # CLI command implementations
├── core/
│   ├── config/          # Configuration management
│   ├── catalog/         # Service catalog loader
│   └── lifecycle/       # Service lifecycle
├── services/
│   ├── docker/          # Docker integration
│   ├── caddy/           # Reverse proxy
│   ├── dns/             # Internal DNS
│   └── backup/          # Disaster recovery
├── tui/                 # Terminal UI
│   ├── app.ts          # Main TUI app
│   └── views/          # TUI views
└── types/               # TypeScript definitions

catalog/services/        # Service definitions
├── dns/pihole.yaml
├── media/joyride.yaml
└── media/plex.yaml
```

## Backup Strategy

Implements 3-2-1 backup strategy:
- **3 copies** of data (original + 2 backups)
- **2 different media** types (local disk + optional remote)
- **1 offsite** copy (user-managed via rsync/S3)

## Security

- HTTPS automatically enabled for all services
- Cloudflare DNS challenge for certificates
- Service passwords auto-generated
- Environment files excluded from version control

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- TypeScript compilation passes (`bun run lint`)
- Follow existing code style
- Add tests for new features
- Update documentation
