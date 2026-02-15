# Tuition - Homelab Management Tool

A terminal-based management tool for self-hosted homelab services. Simplifies Docker container management with automatic HTTPS, internal DNS, and disaster recovery.

**Works with both Bun and Node.js!**

## Features

- **Service Catalog** - Pre-configured services (Pi-hole, Plex, Joyride) ready to deploy
- **Automatic HTTPS** - Caddy reverse proxy with Let's Encrypt certificates
- **Internal DNS** - CoreDNS for zero-configuration container resolution
- **Service Lifecycle** - Enable, disable, start, stop, and update services
- **Disaster Recovery** - Backup and restore entire homelab setup
- **Interactive TUI** - Blessed-based terminal interface

## Quick Start

### Option 1: Global CLI (Recommended)

Install once, use anywhere:

```bash
# Clone and enter directory
cd /apps/tuition

# Install dependencies and link globally
npm install
npm link          # Creates global 'tuition' command

# Now use tuition anywhere
tuition init
tuition config show
tuition service enable pihole
tuition caddy start
tuition tui
```

**Or with Bun:**
```bash
bun install
bun link          # Creates global 'tuition' command
tuition init
```

### Option 2: Using npx (No Global Install)

```bash
# Initialize
cd /apps/tuition
npx tuition init

# Run any command
npx tuition service list
npx tuition caddy start
```

### Option 3: Local Scripts

If you don't want global installation:

**Using Bun:**
```bash
cd /apps/tuition
bun install
bun run index.ts init
bun run index.ts service enable pihole
```

**Using Node.js:**
```bash
cd /apps/tuition
npm install
npm run dev:node init
npm run dev:node service enable pihole
```

### Option 3: Build and Run

```bash
# Using Bun
bun run build
bun run start init

# Using Node.js
npm run build:node
npm run start:node init
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

## Requirements

- **Runtime**: Bun >=1.0.0 **OR** Node.js >=18.0.0
- **Docker**: Engine 20.10+, Compose 2.0+
- **OS**: Linux (Debian/Ubuntu recommended)
- **Network**: Domain name with Cloudflare DNS

### Installing Bun

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

Add to `~/.bashrc` or `~/.zshrc` to make permanent:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

## Commands

All commands work with both Bun and Node.js:

### Bun Commands
```bash
bun run index.ts init                    # Initialize
bun run index.ts service enable <name>    # Enable service
bun run index.ts caddy start              # Start Caddy
bun run index.ts tui                      # Launch TUI
```

### Node.js Commands
```bash
npm run dev:node init                     # Initialize
npm run dev:node service enable <name>   # Enable service
npm run dev:node caddy start             # Start Caddy
npm run dev:node tui                     # Launch TUI
```

### Full Command Reference

| Command | Bun | Node.js |
|---------|-----|---------|
| Initialize | `bun run index.ts init` | `npm run dev:node init` |
| List services | `bun run index.ts service list` | `npm run dev:node service list` |
| Enable service | `bun run index.ts service enable <name>` | `npm run dev:node service enable <name>` |
| Start Caddy | `bun run index.ts caddy start` | `npm run dev:node caddy start` |
| Start DNS | `bun run index.ts dns start` | `npm run dev:node dns start` |
| Create backup | `bun run index.ts backup create` | `npm run dev:node backup create` |
| Launch TUI | `bun run index.ts tui` | `npm run dev:node tui` |

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

## Development

### Using Bun (Faster, recommended for development)

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

### Using Node.js (Full compatibility)

```bash
# TypeScript check
npm run lint

# Run tests
npm run test:node

# Run CLI in development mode
npm run dev:node <command>

# Run TUI
npm run dev:node tui

# Build for production
npm run build:node

# Run compiled version
npm run start:node <command>
```

### Testing

The project includes comprehensive unit tests covering:

- **Configuration Management** - Config loading, validation, and persistence
- **Service Catalog** - Service discovery and metadata
- **Caddyfile Generator** - Reverse proxy configuration generation
- **Docker Compose** - Compose file generation and environment handling
- **Backup Manager** - Archive creation and restoration

```bash
# Using Bun
bun test

# Using Node.js
npm run test:node
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

## Global CLI Installation

To use `tuition` as a global command (instead of `bun run index.ts` or `npm run dev:node`):

### Method 1: npm link (Recommended)

```bash
cd /apps/tuition
npm install
npm link

# Verify installation
tuition --version
tuition --help

# Use anywhere
tuition init
tuition service list
```

To remove:
```bash
npm unlink -g tuition
```

### Method 2: bun link

```bash
cd /apps/tuition
bun install
bun link

# Use anywhere
tuition init
```

To remove:
```bash
bun unlink tuition
```

### Method 3: npx (No Installation)

```bash
cd /apps/tuition
npx tuition --help
npx tuition init
```

### Method 4: Shell Alias

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias tuition='bun run /apps/tuition/index.ts'
# Or for Node.js:
# alias tuition='npx tsx /apps/tuition/index.ts'
```

Then reload:
```bash
source ~/.bashrc  # or ~/.zshrc
tuition init
```

## Troubleshooting

### "tuition: command not found"

If you get this error after `npm link`:

```bash
# Check if tuition is linked
which tuition
ls -la $(npm bin -g)/tuition

# If not found, your PATH may not include npm's global bin
export PATH="$(npm bin -g):$PATH"

# Or link again with full path
npm link /apps/tuition
```

### Bun crashes with native modules

If you see errors like `panic: unsupported uv function`, use Node.js instead:

```bash
# Switch to Node.js
npm install
npm run dev:node init
```

### Permission denied on Linux

```bash
# Fix ownership
sudo chown -R $USER:$USER ~/.tuition

# Or run with sudo (not recommended for production)
sudo $(which bun) run index.ts init
```

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- TypeScript compilation passes (`bun run lint` or `npm run lint`)
- Tests pass (`bun test` or `npm run test:node`)
- Follow existing code style
- Add tests for new features
- Update documentation
