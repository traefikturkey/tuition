# Tuition - Homelab Management Tool

Tuition is a terminal-first homelab manager for self-hosted services. It
provides a curated Docker service catalog, centralized HTTPS through Caddy,
internal DNS through CoreDNS, backup and restore workflows, and an interactive
TUI for day-to-day operations.

## Current Status

Tuition is currently **MVP complete** on the
`feature/initial-implementation` branch.

Implemented now:

- CLI for init, validation, config, service lifecycle, Caddy, DNS, backup,
  and TUI flows
- Curated service catalog with **24 services across 10 categories**
- Service dependency auto-enable during `service enable`
- Caddy-based HTTPS with Cloudflare DNS challenge support
- CoreDNS generation and reload flow for internal DNS on **port 54**
- Backup create, list, restore, and delete flows
- Blessed-based TUI with dashboard, service browser, and service diagnostics views

Still tracked as backlog against the PRD:

- Database dump integration for backups
- Event-driven DNS registration and sync
- Scheduled and offsite backups
- GPU passthrough, SSO-oriented workflows, and external service proxy support
- Expansion from 24 curated services to the PRD target of 30+

See [docs/STATUS.md](docs/STATUS.md) for the current implementation summary and
[docs/PRD/PRD.md](docs/PRD/PRD.md) for the requirements baseline.

## Quick Start

### Install

**One-line install:**

```bash
curl -fsSL https://raw.githubusercontent.com/traefikturkey/tuition/feature/initial-implementation/scripts/install.sh | bash
```

The installer currently:

- checks Node.js 18+
- clones the repository to `~/.tuition/app`
- runs `npm install`
- creates a `tuition` wrapper in `~/.local/bin`

After install, reload your shell:

```bash
source ~/.bashrc  # or ~/.zshrc
```

### Configure

```bash
tuition init
```

Current implementation notes:

- DNS provider support is **Cloudflare-first**
- you need a domain managed by Cloudflare
- you need a Cloudflare API token with `Zone:Read` and `DNS:Edit`

### Deploy

```bash
# 1. Start infrastructure
tuition caddy start
tuition dns start

# 2. Deploy your first service
tuition service enable pihole

# 3. Verify status
tuition caddy status
tuition dns status
```

### Manage

```bash
tuition tui
tuition service list
tuition service show pihole
tuition backup list
```

## Requirements

> **Platform note**: Tuition targets Linux only (Debian/Ubuntu primary). Windows
> and macOS are not supported and the installer will not run on those platforms.

- **OS**: Linux, with Debian or Ubuntu as the primary target
- **Docker**: Engine 20.10+ and Compose 2+
- **Node.js**: 18+ for the installer and generated `tuition` wrapper
- **Domain**: a domain managed in Cloudflare
- **Cloudflare API token**: `Zone:Read` and `DNS:Edit`

Contributor notes:

- the repository entrypoint is [index.ts](index.ts)
- the shebang uses Bun, but the installer wrapper runs `npx tsx index.ts`
- both `package.json` `test` script and `make test` run `bun test`
- `make lint` and `npm run lint` both run `tsc --noEmit`

## Command Reference

### System

```bash
tuition init
tuition validate
tuition config show
tuition config set <key> <value>
```

### Services

```bash
tuition service list
tuition service list --category <category>
tuition service list --all
tuition service search <query>
tuition service show <name>
tuition service enable <name>
tuition service enable <name> --no-start      # enable without starting
tuition service disable <name>
tuition service disable <name> --remove-data  # remove config files
tuition service remove <name>                 # remove config + data
tuition service remove <name> --keep-data     # preserve data directory
tuition service remove <name> --force         # skip confirmation
tuition service start <name>
tuition service stop <name>
tuition service restart <name>
tuition service update <name>
tuition service logs <name>
tuition service logs <name> --tail <lines>    # default 100
tuition service logs <name> --follow
```

### Caddy

```bash
tuition caddy start
tuition caddy stop
tuition caddy restart
tuition caddy reload
tuition caddy status
tuition caddy regenerate
tuition caddy set-password
tuition caddy hash-password   # legacy helper retained for compatibility
```

### DNS

```bash
tuition dns start
tuition dns stop
tuition dns status
tuition dns regenerate
tuition dns configure          # set upstream DNS servers interactively
tuition dns cluster            # configure DNS clustering interactively
```

### Backup

```bash
tuition backup create
tuition backup create --include-volumes   # include Docker volume data
tuition backup create --no-compression   # skip gzip compression
tuition backup list
tuition backup restore <number-or-filename>
tuition backup restore <number-or-filename> --dry-run   # preview only
tuition backup restore <number-or-filename> --force     # skip confirmation
tuition backup delete <number-or-filename>
```

### Interactive UI

```bash
tuition tui
tuition --help
```

## What Is Implemented Now

### Configuration and Validation

- interactive initialization for global configuration
- layered config loading and validation
- sensitive value redaction in `tuition config show`
- generated secrets for service environments
- restrictive config file permissions where supported

### Service Catalog and Lifecycle

- bundled catalog in `catalog/services/`
- list, show, and search flows
- enable, disable, start, stop, restart, update, and logs commands
- automatic dependency enablement during service activation
- optional data removal on disable with `--remove-data`

### Reverse Proxy and HTTPS

- centralized Caddy management
- generated Caddyfile from enabled services
- admin password setup and status reporting
- Cloudflare DNS challenge integration for certificate management

### Internal DNS

- generated CoreDNS config and hosts file
- static host registration for the Tuition hostname
- start, stop, status, regenerate, and upstream configuration flows
- CoreDNS bound to **port 54** to avoid conflict with system DNS on port 53

### Backup and Restore

- backup archive creation for config and generated infrastructure state
- optional inclusion of service data volumes
- restore and delete by list index or filename
- path containment checks for restore and delete operations

Current backup limitations:

- `includeDatabases` exists as an option, but database dump automation is not
  implemented yet
- offsite destinations and scheduling are not implemented yet

### Terminal UI

- dashboard view with infrastructure status overview
- service browser for browsing and managing catalog entries
- service diagnostics view for inspecting individual service state
- keyboard navigation across all views (Tab, Shift-Tab, q / Ctrl-C to exit)

## Catalog Coverage

The current catalog includes services in these categories:

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

Examples already included:

- `pihole`
- `plex`
- `jellyfin`
- `nextcloud`
- `grafana`
- `prometheus`
- `uptime-kuma`
- `authelia`
- `ollama`
- `open-webui`

## Architecture Snapshot

```text
Internet
    ↓
DNS (Cloudflare)
    ↓
Caddy (443/80)
    ↓
Docker network (tuition)
    ├─ application services
    ├─ Caddy admin route
    └─ CoreDNS (port 54)
```

## Development Commands

```bash
# TypeScript check
npm run lint
make lint

# Tests
npm test
make test

# Run the CLI from the repo
npx tsx index.ts --help
bun run index.ts --help
```

## Documentation

- [README.md](README.md) - project overview and command reference
- [docs/STATUS.md](docs/STATUS.md) - delivered scope and backlog gaps
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) - current plan and
  remaining work
- [docs/PRD/PRD.md](docs/PRD/PRD.md) - product requirements and alignment review

## License

MIT License
