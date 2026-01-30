# Configuration Management

## Types of Configuration

### Tier 1: Global Configuration
- **Scope:** All Docker containers
- **Contents:**
  - Host identification (hostname, domain)
  - DNS/SSL provider credentials
  - System basics (timezone, user/group IDs)
  - Common infrastructure settings

### Tier 2: Infrastructure-Specific Configuration
- **NFS Configuration:** Network storage addresses, mount options, backup paths
- **External Services:** Non-containerized service proxying (VMs, appliances)

### Tier 3: Per-Container Configuration
- **Scope:** Individual Docker containers
- **Contents:**
  - Container-specific secrets and passwords
  - Image tags and versions
  - Container names
  - Custom settings

### Tier 4: Container Configuration Files
- **Scope:** Individual container internals
- **Contents:**
  - Application configuration files
  - Generated with variable substitution
  - Persisted for runtime use

## Configuration Decisions Users Must Make

### Required for Initial Setup

| Decision | Purpose |
|----------|---------|
| **Host Identity** | Hostname and domain for SSL certificates and service URLs |
| **DNS Provider Credentials** | Automated certificate management |
| **User/Group IDs** | Container file permissions |
| **Timezone** | Container time synchronization |

### Conditional Decisions

| Decision | When Required |
|----------|---------------|
| **NFS Setup** | Using shared network storage |
| **External Service URLs** | Proxying non-containerized services via Traefik |
| **Container-Specific Options** | Per container when enabled |

### Optional/Advanced

- Logging levels and access logs
- Backup paths and exclusion patterns
- Per-container auto-update settings
- Docker container restart policies

## Sensitive Data Handling

### Generation vs. Specification

| Type | Handling |
|------|----------|
| **Auto-generated** | Passwords and secrets auto-generated when not specified |
| **User-provided** | Credentials entered during setup (DNS tokens, initial passwords) |
| **File-based** | Templates enforce required values; defaults for optional |

### Storage & Access Control

- **Location:** Environment files never committed to version control
- **Permissions:** Restricted to owner read/write only
- **Isolation:** Each Docker container gets its own environment file
- **File-based patterns:** Recommend mounted secret files over embedded secrets in containers

### Protection Mechanisms

- Version control explicitly blocks all sensitive files
- Templates tracked (with placeholders); generated files excluded
- Backup archives excluded from version control
- Archival system preserves credentials when disabling services

## Configuration Generation System

### Source-to-Config Flow

```
Template Source → Variable Substitution → Final Configuration
```

### File Type Handling

| Type | Processing | Use Case |
|---------|-----------|----------|
| **Variable templates** | Substitution applied | Config files with placeholders |
| **Static files** | Copied as-is | Binary or fixed content |
| **Initialization manifests** | Execute operations | Complex setup (key generation) |
| **Documentation** | Ignored | README, help files |

### Configuration Precedence

1. User-provided values
2. Defaults from templates
3. Auto-generate secrets for unset password-like variables

### Complex Initialization

For services requiring more than file templating:
- Create directories with proper permissions
- Generate cryptographic keys
- Download required files
- Set ownership on mounted volumes

## Problems Solved

### 1. Onboarding Complexity
- **Challenge:** New users don't know what to configure
- **Solution:** Interactive setup with help text, sensible defaults

### 2. Disaster Recovery & Reproducibility
- **Challenge:** Can you rebuild from backups?
- **Solution:** All configs auto-regenerated from templates + variables

### 3. Multi-Service Secret Management
- **Challenge:** Dozens of services each needing credentials
- **Solution:** Per-service isolation, auto-generation, no shared secrets

### 4. Configuration Drift
- **Challenge:** Manual edits, per-environment variations
- **Solution:** Regeneration capability, clear precedence rules

### 5. Scaling
- **Challenge:** Adding 31st service shouldn't require system expertise
- **Solution:** Convention-based approach, minimal service-specific setup

### 6. Secrets in Version Control
- **Challenge:** Prevent accidental commits of passwords/tokens
- **Solution:** Aggressive exclusion, templates vs. generated files

### 7. Complex Initialization
- **Challenge:** Some services need key generation, downloads, permissions
- **Solution:** Declarative operation manifests

## Configuration Summary

**On first setup:**
- Server name & domain
- DNS provider credentials
- Timezone
- Network storage (if using)

**Per container:**
- Admin passwords (if not auto-generated)
- Container-specific options
- Port/hostname mappings (if not using Traefik reverse proxy)

**After changes:**
- Regenerate configuration files
- Restart container to pick up changes
