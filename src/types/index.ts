/**
 * Core types for Tuition homelab management tool
 */

// Configuration tiers
export interface UpstreamDnsConfig {
  primary: string;
  backup?: string;
}

export interface DnsClusterConfig {
  enabled: boolean;
  nodeName?: string;
  clusterSecret?: string;
  clusterSeeds?: string[];
}

export interface GlobalConfig {
  hostname: string;
  domain: string;
  timezone: string;
  adminEmail: string;
  puid: number;
  pgid: number;
  dnsProvider: "cloudflare";
  cloudflareToken?: string;
  upstreamDns: UpstreamDnsConfig;
  adminPasswordHash?: string; // bcrypt hash for Caddy admin UI
  dnsCluster?: DnsClusterConfig;
}

export interface InfrastructureConfig {
  nfs?: NfsConfig[];
  externalServices?: ExternalService[];
}

export interface NfsConfig {
  name: string;
  server: string;
  path: string;
  mountPoint: string;
  options?: string;
}

export interface ExternalService {
  name: string;
  url: string;
  description?: string;
}

export interface ServiceConfig {
  enabled: boolean;
  imageTag?: string;
  environment?: Record<string, string>;
  volumes?: string[];
  ports?: string[];
  [key: string]: unknown;
}

export interface FullConfig {
  global: GlobalConfig;
  infrastructure?: InfrastructureConfig;
  services: Record<string, ServiceConfig>;
}

// Service catalog types
export interface ServiceDefinition {
  name: string;
  category: ServiceCategory;
  description: string;
  upstreamUrl?: string;
  image: string;
  ports?: PortMapping[];
  environment?: Record<string, string>;
  volumes?: VolumeMapping[];
  labels?: Record<string, string>;
  dependsOn?: string[];
  database?: DatabaseRequirement;
  resourceLimits?: ResourceLimits;
}

export type ServiceCategory =
  | "dns"
  | "media"
  | "monitoring"
  | "downloads"
  | "auth"
  | "storage"
  | "development"
  | "games"
  | "home-automation"
  | "ai";

export interface PortMapping {
  host: number;
  container: number;
  protocol?: "tcp" | "udp";
}

/**
 * Standard bind-mount volume (host path → container path).
 * `type` field is optional for backward compatibility with catalog YAMLs
 * that predate the discriminated union.
 */
export interface BindVolumeMapping {
  type?: "bind";
  host: string;
  container: string;
  readOnly?: boolean;
}

/**
 * Docker-managed NFS volume.
 * `nfsName` references an entry in InfrastructureConfig.nfs[].name.
 * At service-enable time the matching NfsConfig is looked up and a
 * Docker named volume with driver_opts is generated in the compose file.
 */
export interface NfsVolumeMapping {
  type: "nfs";
  nfsName: string;
  subPath?: string;
  container: string;
  readOnly?: boolean;
  options?: string;
}

/** Union of all supported volume mapping shapes. */
export type VolumeMapping = BindVolumeMapping | NfsVolumeMapping;

export interface DatabaseRequirement {
  type: "postgresql" | "mysql" | "mongodb" | "redis" | "sqlite";
  required: boolean;
}

export interface ResourceLimits {
  cpus?: number;
  memory?: string;
  gpus?: boolean;
}

// Service lifecycle states
export type ServiceState = "available" | "enabled" | "running" | "stopped" | "disabled" | "error";

export interface ServiceStatus {
  name: string;
  state: ServiceState;
  containerId?: string;
  health?: "healthy" | "unhealthy" | "starting" | "unknown";
  uptime?: number;
  ports?: number[];
  lastError?: string;
}

// Backup types
export interface BackupMetadata {
  version: string;
  createdAt: string;
  hostname: string;
  services: string[];
  size: number;
}

export interface BackupOptions {
  includeDatabases: boolean;
  includeVolumes: boolean;
  compress: boolean;
  destination: string;
}

// DNS types
export interface DnsRecord {
  hostname: string;
  ip: string;
  type: "A" | "AAAA" | "CNAME";
  source: "container" | "static";
  containerId?: string;
}

// Caddy types
export interface CaddyRoute {
  domain: string;
  service: string;
  port: number;
  tls: boolean;
  middleware?: string[];
}
