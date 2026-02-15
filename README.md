# Tuition - Homelab Management Tool

A terminal-based management tool for self-hosted homelab services. Simplifies Docker container management with automatic HTTPS, internal DNS, and disaster recovery.

## Quick Start

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/traefikturkey/tuition/feature/initial-implementation/scripts/install.sh | bash
```

That's it! The installer automatically:
- Checks Node.js is installed
- Adds `~/.local/bin` to your PATH
- Downloads and installs tuition
- Installs all dependencies

### Configure

```bash
tuition init  # Interactive setup wizard
```

### Deploy

```bash
tuition caddy start              # Start reverse proxy
tuition dns start                # Start DNS
tuition service enable pihole    # Deploy first service
```

### Manage

```bash
tuition tui                      # Launch interactive UI
```

## Requirements

- **Node.js**: 18+ (will be checked by installer)
- **Docker**: Engine 20.10+, Compose 2.0+
- **OS**: Linux (Debian/Ubuntu recommended)
- **Domain**: With Cloudflare DNS

### Installing Node.js

If you don't have Node.js:

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20

# Or using apt (Ubuntu/Debian)
sudo apt update
sudo apt install nodejs npm
```

## Usage

Once installed, use `tuition` from anywhere:

```bash
tuition init                    # Initialize configuration
tuition config show             # Show configuration
tuition service list            # List all services
tuition service enable <name>   # Enable a service
tuition service disable <name>  # Disable a service
tuition caddy start             # Start Caddy reverse proxy
tuition dns start               # Start CoreDNS
tuition backup create           # Create backup
tuition backup restore <n>      # Restore backup
tuition tui                     # Launch interactive UI
tuition --help                  # Show all commands
```

## Architecture

```
Internet
    ↓
DNS (Cloudflare)
    ↓
Caddy (443/80) ──► Automatic HTTPS
    ↓
Docker Network (tuition)
    ├─ Pi-hole (DNS ad blocking)
    ├─ Plex (Media server)
    ├─ Joyride (Media requests)
    └─ CoreDNS (Internal DNS: 53)
```

## Services

Pre-configured services available:

- **Pi-hole** (`tuition service enable pihole`) - Network-wide ad blocking
- **Plex** (`tuition service enable plex`) - Media server
- **Joyride** (`tuition service enable joyride`) - Media request platform

## Configuration

Stored in `~/.tuition/config/`:

```
~/.tuition/
├── config/
│   ├── global.yaml          # Domain, email, Cloudflare token
│   └── services/
│       └── <name>.yaml      # Per-service config
├── data/                     # Service data
└── backups/                  # Backup archives
```

## Troubleshooting

### "tuition: command not found"

Run:
```bash
source ~/.bashrc  # or ~/.zshrc
which tuition
```

### Permission denied

The installer uses your home directory (`~/.local/bin`), so no sudo needed.

### Docker not working

Add your user to docker group:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

## Development

If you want to modify the source:

```bash
cd ~/.tuition/app
make test     # Run tests
make lint     # TypeScript check
make build    # Build for production
```

## Uninstall

```bash
rm -rf ~/.tuition ~/.local/bin/tuition
```

## License

MIT

---

**One command install. Simple, fast homelab management.** 🚀
