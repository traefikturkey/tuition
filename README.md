# Tuition - Homelab Management Tool

A terminal-based management tool for self-hosted homelab services. Simplifies Docker container management with automatic HTTPS, internal DNS, and disaster recovery.

## Installation

**One-line install:**
```bash
curl -fsSL https://raw.githubusercontent.com/traefikturkey/tuition/main/scripts/install.sh | bash
```

**Or manually:**
```bash
git clone https://github.com/traefikturkey/tuition.git /apps/tuition
cd /apps/tuition
make install
```

**That's it!** Now you can use `tuition` from anywhere.

## Quick Start

```bash
# Initialize configuration (interactive wizard)
tuition init

# Start infrastructure (Caddy reverse proxy + CoreDNS)
tuition caddy start
tuition dns start

# Deploy your first service
tuition service enable pihole

# Access your service at: https://pihole.yourdomain.com

# Launch interactive TUI for visual management
tuition tui
```

## Requirements

- **Runtime**: Node.js 18+ or Bun 1.0+
- **Docker**: Engine 20.10+, Compose 2.0+
- **OS**: Linux (Debian/Ubuntu recommended)
- **Domain**: A domain name with Cloudflare DNS

## Commands

After installation, use `tuition` from anywhere:

```bash
tuition init                    # Initialize configuration
tuition validate                # Validate configuration
tuition config show             # Show configuration
tuition config set <key> <val>  # Set configuration value

tuition service list            # List all services
tuition service enable <name>   # Enable and start service
tuition service disable <name>  # Disable service
tuition service start <name>    # Start service
tuition service stop <name>     # Stop service
tuition service restart <name>  # Restart service
tuition service update <name>   # Update to latest image
tuition service logs <name>     # View logs
tuition service search <query>  # Search catalog

tuition caddy start             # Start Caddy reverse proxy
tuition caddy stop              # Stop Caddy
tuition caddy restart           # Restart Caddy
tuition caddy reload            # Reload configuration
tuition caddy status            # Show Caddy status

tuition dns start               # Start CoreDNS
tuition dns stop                # Stop CoreDNS
tuition dns status              # Show CoreDNS status

tuition backup create           # Create backup
tuition backup list             # List backups
tuition backup restore <n>      # Restore backup #n
tuition backup delete <n>       # Delete backup #n

tuition tui                     # Launch interactive TUI
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

## Configuration

Configuration is stored in `~/.tuition/config/`:

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

If you're modifying the source code:

```bash
cd /apps/tuition

# Run in development mode
make dev ARGS="init"
make dev ARGS="service list"

# Run tests
make test

# TypeScript check
make lint

# Build for production
make build
```

## Project Structure

```
src/
├── cli/commands/         # CLI implementations
├── core/                # Config, catalog, lifecycle
├── services/            # Docker, Caddy, DNS, backup
├── tui/                 # Terminal UI
└── types/               # TypeScript definitions

catalog/services/        # Service definitions
├── dns/pihole.yaml
├── media/joyride.yaml
└── media/plex.yaml
```

## Testing

```bash
# Run all tests
make test

# Or with Bun (faster)
bun test
```

## Troubleshooting

### "tuition: command not found"

Add to `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="/usr/local/bin:$PATH"
```

Then reload: `source ~/.bashrc`

### Permission denied

The install script uses `/usr/local/bin` by default. If you don't have permission:

```bash
# Install to user directory instead
INSTALL_DIR="$HOME/.local/bin" curl -fsSL ... | bash
export PATH="$HOME/.local/bin:$PATH"
```

### Docker not accessible

Ensure your user is in the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

## Uninstall

```bash
cd /apps/tuition
make uninstall
```

## License

MIT

## Contributing

Pull requests welcome! Please:
- Run `make lint` to check TypeScript
- Run `make test` to verify tests pass
- Follow existing code style

---

**Simple, fast, reliable homelab management.** 🚀
