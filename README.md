# Tuition - Homelab Management Tool

A terminal-based management tool for self-hosted homelab services. Simplifies Docker container management with automatic HTTPS, internal DNS, and disaster recovery.

## Quick Start

### Install

**One-line install:**
```bash
curl -fsSL https://raw.githubusercontent.com/traefikturkey/tuition/feature/initial-implementation/scripts/install.sh | bash
```

The installer automatically:
- ✅ Checks Node.js is installed (18+ required)
- ✅ Detects your shell (bash/zsh) and configures PATH
- ✅ Clones tuition to `~/.tuition/app`
- ✅ Installs all npm dependencies
- ✅ Creates the `tuition` command in `~/.local/bin`

**After install, reload your shell:**
```bash
source ~/.bashrc  # or ~/.zshrc
```

### Configure

```bash
tuition init  # Interactive setup wizard
```

You'll need:
- A domain name (e.g., `example.com`)
- The domain must be managed by Cloudflare
- A Cloudflare API token with `Zone:Read` and `DNS:Edit` permissions

### Deploy

```bash
# 1. Start infrastructure
tuition caddy start              # Start reverse proxy (with automatic HTTPS)
tuition dns start                # Start CoreDNS (internal DNS)

# 2. Deploy your first service
tuition service enable pihole    # Deploy Pi-hole ad blocker

# 3. Access services at:
# https://pihole.example.com
# https://tuition.example.com (Caddy admin UI)
```

### Manage

```bash
tuition tui                      # Launch interactive terminal UI
tuition service list             # List all services
tuition caddy status             # Check Caddy status
```

## Requirements

- **Node.js**: 18+ (required by installer)
- **Docker**: Engine 20.10+, Compose 2.0+
- **OS**: Linux (Debian/Ubuntu recommended)
- **Domain**: Must be managed by Cloudflare DNS
- **Cloudflare API Token**: With Zone:Read and DNS:Edit permissions

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

## Cloudflare Setup

**Your domain MUST be on Cloudflare for automatic HTTPS to work.**

### 1. Add Domain to Cloudflare
- Sign up at https://dash.cloudflare.com
- Add your domain
- Change nameservers at your registrar to Cloudflare's

### 2. Create API Token
Go to https://dash.cloudflare.com/profile/api-tokens → "Create Token"

Use this template:
- **Zone:Read** - For all zones
- **DNS:Edit** - For the specific zone (your domain)

### 3. Verify Setup

```bash
# Check nameservers
dig example.com NS
# Should show: [name].ns.cloudflare.com

# Check tuition config
tuition config show
# Verify cloudflareToken is set
```

## Usage

Once installed, use `tuition` from anywhere:

```bash
# System
tuition init                    # Initialize configuration
tuition config show             # Show configuration
tuition validate                # Validate configuration

# Services
tuition service list            # List all services
tuition service show <name>     # Show service details
tuition service enable <name>   # Enable and start service
tuition service disable <name>  # Disable service
tuition service start <name>    # Start service container
tuition service stop <name>     # Stop service container
tuition service logs <name>     # View service logs

# Infrastructure
tuition caddy start             # Start Caddy reverse proxy
tuition caddy stop              # Stop Caddy
tuition caddy status            # Show Caddy status + admin URL
tuition caddy reload            # Reload Caddy config
tuition dns start               # Start CoreDNS
tuition dns stop                # Stop CoreDNS

# Backup
tuition backup create           # Create backup
tuition backup list             # List backups
tuition backup restore <n>      # Restore backup #n

# Interactive UI
tuition tui                     # Launch interactive terminal UI
tuition --help                  # Show all commands
```

## Architecture

```
Internet
    ↓
DNS (Cloudflare)
    ↓
Caddy (443/80) ──► Automatic HTTPS (Let's Encrypt)
    ↓
Docker Network (tuition)
    ├─ Pi-hole (DNS ad blocking)
    ├─ Plex (Media server)
    ├─ Joyride (Media requests)
    ├─ CoreDNS (Internal DNS: 53)
    └─ Tuition Admin (https://tuition.example.com)
```

## Services

Pre-configured services available:

- **Pi-hole** (`tuition service enable pihole`) - Network-wide ad blocking
- **Plex** (`tuition service enable plex`) - Media server
- **Joyride** (`tuition service enable joyride`) - Media request platform

All services get automatic HTTPS via Caddy.

## Configuration

Stored in `~/.tuition/`:

```
~/.tuition/
├── config/
│   ├── global.yaml          # Domain, email, Cloudflare token
│   └── services/
│       └── <name>.yaml      # Per-service config
├── data/                     # Service data volumes
├── backups/                  # Backup archives
└── app/                      # Tuition application files
```

## Admin UI

Access Caddy's admin interface at:
```
https://tuition.example.com
```

**First time setup:**
1. Generate password: `docker exec -it caddy caddy hash-password`
2. Edit `~/.tuition/Caddyfile` and add the hashed password
3. Reload: `tuition caddy reload`

The admin UI shows:
- Active TLS certificates
- HTTP routes
- Server configuration
- Real-time metrics

## Troubleshooting

### "tuition: command not found"

```bash
source ~/.bashrc  # or ~/.zshrc
which tuition
```

If still not found:
```bash
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

### Cloudflare DNS Error (SERVFAIL)

**Error:** `could not determine zone for domain "_acme-challenge.example.com"`

**Cause:** Domain not properly set up in Cloudflare

**Fix:**
1. Verify domain uses Cloudflare nameservers:
   ```bash
   dig example.com NS
   ```
2. Check Cloudflare token has correct permissions:
   - Zone:Read (all zones)
   - DNS:Edit (your specific zone)
3. Verify token in config: `tuition config show`

### Docker Permission Denied

```bash
sudo usermod -aG docker $USER
# Log out and back in completely
```

### Caddy Won't Start

Check logs:
```bash
docker logs caddy
```

Common issues:
- **Port 80/443 in use**: Stop other web servers
- **Cloudflare token invalid**: Regenerate token with correct permissions
- **Domain not resolving**: Ensure DNS is set up correctly

### Can't Access Admin UI

The admin UI runs at `localhost:2019` inside the container. Access it via:
```bash
# SSH tunnel from your local machine
ssh -L 2019:localhost:2019 user@your-server
# Then open: http://localhost:2019
```

Or use the HTTPS route (once TLS is working):
```
https://tuition.example.com
```

## Development

If you want to modify the source:

```bash
cd ~/.tuition/app

# Run tests
make test

# TypeScript check
make lint

# Build
make build
```

## Uninstall

```bash
rm -rf ~/.tuition ~/.local/bin/tuition
```

## Support

- **Issues:** https://github.com/traefikturkey/tuition/issues
- **Documentation:** See `docs/` directory

## License

MIT

---

**One command install. Simple, fast homelab management.** 🚀
