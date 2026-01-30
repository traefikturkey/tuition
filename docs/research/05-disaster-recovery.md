# Disaster Recovery

## Philosophy

> "Disaster Recovery over High Availability"

Instead of investing in redundancy and failover mechanisms, invest in fast recovery:

1. Provision new infrastructure
2. Restore from backup
3. Be back online rapidly

This is more practical for self-hosted homelabs than HA infrastructure.

## What Needs to Be Backed Up

### Tier 1: Configuration (Critical)
- All container configuration files
- Enabled containers and their Docker Compose configurations
- All environment files (the critical piece for rebuild)
- Active container extensions

**Excluded by design:**
- Logs, caches, temporary files (regeneratable)
- Large media library metadata (regeneratable)
- Git pack files (cloned repositories)
- AI model files (downloadable)
- Game server binaries (downloadable)
- Database journals (part of DB backup)

### Tier 2: Database Data
- Database dumps for each container with a database
- Excludes in-memory caches (usually non-critical)

### Tier 3: Volume Data (User-Dependent)
- Docker containers with important persistent data
- Photos, media libraries, application data
- Backup needs vary by container importance

## The Restore Story

### Step 1: Deploy Fresh Infrastructure
- Clone repository
- Install prerequisites
- Run basic setup

### Step 2: Restore Configuration
- Copy backup archive to new server
- Extract and restore all configuration files
- Environment files and service configs immediately available

### Step 3: Restore Databases (If Applicable)
- Start database containers
- Import database dumps
- Verify data integrity

### Step 4: Start Containers
- Restart all Docker containers
- Containers come up with restored configuration

### Emergency Recovery
For severe scenarios (git corruption, force-push damage):
- Back up environment files to temporary location
- Back up modified files
- Reset to known good state
- Auto-restore environment files

## Recovery Time Objectives

**Best case (with preparation):** Minutes

Assumptions:
1. Prepared backup already exists
2. New infrastructure provisioned
3. Fast network for backup transfer

**Realistic timeline:**
- Fresh installation: Few minutes
- Configuration restore: Few minutes
- Database restore: Few minutes (size dependent)
- Service startup: Few minutes
- **Total:** 5-15 minutes for complete recovery

**Without prepared backups:** Hours (manual recreation)

## Data Persistence Patterns

### Database Architecture
- **Dedicated container per service:** Each container with a database runs its own
- **Benefits:**
  - Isolation: One container's failure doesn't cascade
  - Independent backups: Self-contained per container
  - Faster restore: Can restore individually
  - Predictable rollback time

### Environment Variables: The Critical Piece
The environment files are the **single most critical backup component:**
- Global configuration (hostname, domain, credentials)
- Infrastructure configuration (NFS, external services)
- Per-service secrets and settings

**These must be recovered first.** Without them, services won't start.

### Configuration Files: Container-Level State
Generated configuration for each Docker container:
- Traefik route configurations
- Application settings
- SSL certificates

Regeneratable but time-consuming without backups.

### Volumes: Three Categories

| Category | Description | Backup Method |
|----------|-------------|---------------|
| **Database volumes** | Managed by database containers | Database dumps |
| **Application volumes** | Configuration, caches, state | Configuration backup |
| **Media volumes** | User data (photos, media) | Optional, user-dependent |

## User Scenarios

### Hardware Failure
Server dies completely:
- Restore onto new hardware in minutes
- Database intact if dumps exist
- All services immediately accessible

Without DR: Days of manual work

### Software Corruption
Bad update corrupts service config:
- Restore from recent backup
- All configs rolled back in minutes

### Ransomware/Deletion
Critical files deleted or encrypted:
- Restore from off-site backup
- Off-site backups provide ransomware immunity

### Single Container Recovery
Just one container broke:
- Restore only that container's configuration
- Don't touch other containers

## Backup Strategy

### Recommended 3-2-1 Approach
- **3** copies of your data
- **2** different media types (local + network)
- **1** offsite copy (different building/cloud)

### Scheduling Recommendations

| Frequency | What |
|-----------|------|
| **Daily** | Configuration backup |
| **Weekly** | Database dumps |
| **Monthly** | Verify restore procedure |

### Exclusion Strategy
Pattern-based exclusions reduce backup size:
- Large regeneratable directories
- Log files and cache directories
- Database journals (part of DB backup)
- Downloadable model/binary files

## Key Takeaways

1. **You need a backup strategy.** Without it, hardware failure means hours of work.

2. **The three-tier approach matters:**
   - Configuration backups (automatic, quick)
   - Database dumps (essential if your containers have data)
   - Volume backups (optional but important for media)

3. **Off-site backups are your safety net.** Provides immunity to local failures and ransomware.

4. **Rebuild time is measured in minutes, not hours.** By design.

5. **Environment files are your most critical asset.** Harder to recreate than service configs.

6. **Test your restore process.** Don't wait for disaster to discover problems.
