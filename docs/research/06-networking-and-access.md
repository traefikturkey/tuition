# Networking & Access

## How Users Access Containers

### Access Layers

| Layer | Description | Use Case |
|-------|-------------|----------|
| **HTTPS via Traefik** | Primary access method for web containers | Web UIs, APIs |
| **Direct Protocols** | Non-HTTP protocols exposed directly | DNS, SSH, SMTP |
| **External/Remote** | Works through DNS from anywhere | Mobile, work access |
| **Internal/Local** | Container-to-container communication | Database connections |
| **External Service Proxy** | Non-containerized services via Traefik | VMs, appliances, external systems |

### Primary Access: HTTPS through Traefik
- All containers accessed via `https://servicename.yourdomain.com`
- Traefik reverse proxy terminates HTTPS/SSL connections
- HTTP automatically redirected to HTTPS
- Users interact via DNS names, not IP:port combinations

### Direct Protocols
- Some services need non-HTTP access (DNS, SSH, SMTP)
- Explicit port mappings in service configuration
- Used when: service needs protocol-specific access

### Internal Communication
- Docker containers reach each other by name
- Happens over Docker internal network
- No external DNS resolution needed
- Much faster than routing through proxy

## Traefik Reverse Proxy Role

Traefik solves the **single-entry-point problem**:

| Function | Problem Solved |
|----------|----------------|
| **HTTP/HTTPS Routing** | No port memorization (8080, 8081, 9090...) |
| **SSL Termination** | All containers get HTTPS without individual certs |
| **Port Consolidation** | Only ports 80/443 exposed externally |
| **Hostname Routing** | `servicename.domain.com` → right container |
| **Middleware Pipeline** | Auth, headers, security at proxy level |

### How It Works

1. **Container Configuration:** Containers declare routing rules via labels
2. **Dynamic Discovery:** Traefik watches for new containers and updates routing
3. **SSL Certificates:** Handles obtaining/renewing certificates
4. **Load Balancing:** Can route to multiple instances (typically single in homelab)

### Network Architecture

```
Internet (user)
    ↓
DNS (resolves domain to server IP)
    ↓
Server Port 80/443 (Traefik listens)
    ↓
Traefik (routes based on hostname)
    ↓
Docker Network
├─ Container A (web-accessible)
├─ Container B (web-accessible)
└─ Database (internal only, not exposed)
```

## SSL/TLS with DNS-Based Validation

### The Certificate Challenge

A certificate authority verifies domain ownership before issuing certificates:

| Method | How It Works | Trade-offs |
|--------|--------------|------------|
| **HTTP-01** | CA visits server on port 80 | Requires port 80 open; no wildcards |
| **TLS-ALPN-01** | CA visits port 443 during handshake | Similar issues |
| **DNS-01** | CA checks DNS records | Works through firewalls; needs DNS API |

### Why DNS-Based Validation is Ideal

1. **Wildcard Certificates:** One cert covers `*.example.com`
   - Instead of individual certs per container
   - Single wildcard covers all subdomains

2. **Works Through Firewalls:** Validation at DNS level
   - No direct server access required
   - Works with restrictive NAT/firewall

3. **Fully Automated:** API-based certificate management (via Traefik)
   - Automatic DNS record creation
   - Automatic cleanup after validation
   - Automatic renewal before expiration
   - Zero manual intervention

4. **Widely Available:** DNS API usage typically included in free DNS plans

### How It Works

```
System starts with certificate configuration
    ↓
Check for existing/expiring certificate
    ↓
If needed:
  - Request challenge from certificate authority
  - CA responds with DNS record requirement
  - System calls DNS provider API
  - DNS provider adds TXT record
  - CA verifies record
  - CA issues certificate
  - System stores and uses certificate
    ↓
All services under *.domain.com have valid HTTPS
```

## Networking Patterns

Users choose patterns based on container type:

### Pattern 1: Traefik Only (Most Common)
- **Use for:** Web UIs, APIs, web applications
- **Access:** HTTPS only via hostname
- **Examples:** Dashboards, media servers, application interfaces

### Pattern 2: Traefik + Direct Ports
- **Use for:** Containers needing non-HTTP protocols
- **Access:** HTTPS for web UI + direct port for protocol
- **Examples:** DNS servers, SSH-enabled containers

### Pattern 3: Internal Docker Networks (Hidden Services)
- **Use for:** Databases, caches, internal components
- **Access:** Only container-to-container
- **Examples:** Data stores, internal workers
- **Benefit:** Not exposed to internet

### Pattern 4: Host Network Mode (Advanced)
- **Use for:** Containers needing full network access
- **Access:** Direct host network
- **Trade-offs:** Maximum performance, less isolation, potential port conflicts
- **Examples:** VPN services, advanced network tools

### Pattern 5: Separate LAN IP
- **Use for:** Containers needing their own IP on local network
- **Access:** Direct LAN access on assigned IP
- **Examples:** DNS/DHCP containers responding on LAN

## Container Exposure Control

### Exposure Mechanisms

| Mechanism | Purpose |
|-----------|---------|
| **Traefik Routing** | Enable/disable web access via Traefik |
| **Network Selection** | Control which Docker networks container joins |
| **Port Mappings** | Expose direct ports (or localhost only) |
| **Middleware** | Add authentication, security checks at Traefik level |

### Exposure Patterns

| Container Type | Pattern | Example |
|---|---|---|
| **Public Web UI** | Traefik only | Dashboards, media servers |
| **Admin Tools** | Traefik + auth middleware | Settings, admin panels |
| **Protocol Services** | Traefik + direct port | DNS, SSH-enabled containers |
| **External Service** | Traefik external proxy | External systems on different networks |
| **Internal Only** | No Traefik, Docker network | Data stores, caches |
| **Localhost Admin** | Local port only | Debug interfaces |

## User Decisions Required

1. **Enable/disable container:** Adds/removes from Traefik
2. **Choose network pattern:** Determined by container needs
3. **Configure subdomain:** Set via environment variables
4. **Add authentication:** Optional Traefik middleware configuration
5. **Expose ports:** For direct protocol access

## Key Technical Insights

### Container-to-Container Communication
- Reach each other by name over Docker networks
- No external DNS resolution needed
- Internal network speed

### External Access
- Always through Traefik reverse proxy at edge
- Traefik handles HTTPS negotiation and certificate presentation

### Certificate Management
- Single wildcard cert covers all subdomains
- Automatic renewal before expiration via Traefik
- Zero user involvement required
