# Database Architecture Patterns Deep Dive

## Two Approaches to Database Architecture

### Approach 1: Dedicated Database Per Container
Each Docker container runs its own isolated database instance.

**Example:**
- Container A → Database A (isolated)
- Container B → Database B (isolated)
- Each has independent credentials, configuration, and resources

### Approach 2: Shared Database Instance
One database instance serves multiple containers.

**Example:**
- Single database instance with multiple logical databases
- Containers connect to different logical databases on same instance
- Centralized management and resource allocation

## Evolution: From Shared to Dedicated

The project experimented with both approaches and ultimately chose **dedicated databases**.

### The Consolidation Attempt (What Happened)
- Project attempted to consolidate databases for resource savings
- Multiple cache containers migrated to shared instance
- Multiple relational database containers migrated to shared instance
- Expected savings: significant RAM reduction

### The Reversal (Why It Was Undone)
Within hours of consolidation, the decision was reversed:
- Testing revealed incompatibilities between services
- Scaling limits became apparent
- Operational complexity increased
- Disaster recovery guarantees weakened

## Problems That Drove the Reversal

### 1. Scaling Limits
- Some database types have hard limits on logical databases
- Limited slots remained after initial migration
- Adding more services would hit ceiling
- Future growth constrained by architectural choice

### 2. Testing Revealed Incompatibilities
- Some containers ignored database selection configuration
- Certain containers needed extensions not available in shared instance
- Compatibility couldn't be guaranteed without testing every container

### 3. Operational Complexity
- Required new management tools and scripts
- Added metadata tracking requirements
- More moving parts = more failure modes
- Contradicted goal of operational simplicity

### 4. Disaster Recovery Implications
- Single instance failure impacts ALL dependent containers
- Selective recovery becomes harder
- Recovery time increases (must restore everything)
- Conflicts with "rebuildable in minutes" philosophy

### 5. Independence Philosophy Violated
- Containers should be independently deployable
- Shared databases create tight coupling
- Database issues cascade across unrelated containers
- Resource contention affects multiple containers

## Tradeoffs Comparison

| Factor | Shared Database | Dedicated Database |
|--------|-----------------|-------------------|
| **Resource Usage** | Lower (marginal savings) | Higher per-service overhead |
| **Failure Isolation** | Poor (one down = all down) | Excellent (service-level) |
| **Recovery Granularity** | All-or-nothing | Per-service |
| **Upgrade Independence** | Must coordinate | Independent |
| **Configuration** | Complex (metadata-driven) | Simple (per-service) |
| **Scaling** | Limited (hardcoded limits) | Unlimited |
| **Operational Complexity** | Higher | Lower |

## Decision Criteria for Users

### Choose Dedicated Databases When:
1. **Independence matters** - Container failures should not cascade
2. **Disaster recovery speed is critical** - Rebuild containers in minutes
3. **Operational simplicity is valued** - Each container manages its own database
4. **Resources are available** - RAM/disk not severely constrained
5. **Growing the setup** - Adding containers won't hit limits
6. **Predictability is important** - No shared resource contention

### Consider Shared Databases When:
1. **Severely resource-constrained** - Must save every GB of RAM
2. **Fixed container count** - Won't exceed database limits
3. **Unified management preferred** - Single backup/restore point
4. **Containers are tightly coupled** - They fail together anyway
5. **Skilled operations team** - Can maintain additional tooling

## Impact on Disaster Recovery

### Dedicated Databases (Recommended)
- **Recovery granularity:** Per container
- **Typical restore time:** 2-5 minutes per container
- **Failure scenario:** Database A fails → Restore A's DB → Container A recovers
- **Other containers:** Unaffected, continue operating
- **Rebuild strategy:** Restore containers in any order

### Shared Databases
- **Recovery granularity:** All-or-nothing
- **Typical restore time:** 5-15+ minutes (one operation)
- **Failure scenario:** Shared DB fails → Restore entire DB → All containers recover together
- **Other containers:** All must wait for shared recovery
- **Rebuild strategy:** Restore shared DB first, then all dependents

## Impact on Resource Usage

### Memory Footprint Estimates
- Per dedicated cache database: 50-100 MB idle
- Per dedicated relational database: 100-500 MB idle
- Shared instance: ~200-500 MB (handles multiple services)

### Why Dedicated Was Preferred
- Modern hardware typically has sufficient RAM
- Operational simplicity more valuable than marginal savings
- Disaster recovery guarantees worth the overhead
- Resource savings don't justify complexity increase

## Alignment with Project Philosophy

The project's stated goal: "Disaster Recovery over High Availability. Rebuildable in minutes from backups."

**Dedicated databases support this by:**
- Enabling per-container restoration
- Avoiding cascade failures
- Maintaining container independence
- Simplifying operations

**Shared databases conflict because:**
- Recovery becomes all-or-nothing
- Failure in one affects all
- Containers become coupled
- Complexity increases

## User Decision Framework

### For Most Homelab Users: Dedicated Databases

This is the right choice because:
1. Matches project philosophy (independent, rebuildable containers)
2. Simpler operations (no special management tools)
3. Better disaster recovery (restore containers independently)
4. Future-proof (no architectural limits on container count)
5. Proven approach (current implementation in production)

### Questions to Ask Before Consolidating:
- "How much RAM do I actually need to save?" (likely <5% of total)
- "How complex should operations be?" (dedicated = simpler)
- "What if the shared database fails?" (cascade risk)
- "Can I rebuild containers independently?" (dedicated = yes)

## Key Takeaway

The dedicated database approach sacrifices some resource efficiency for:
- **Operational simplicity**
- **Failure isolation**
- **Recovery speed**
- **Service independence**

For most homelab scenarios, these tradeoffs strongly favor dedicated databases. The resources saved by consolidation rarely justify the complexity and risk introduced.
