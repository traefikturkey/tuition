/**
 * Service lifecycle management
 * Handles service enable/disable and state transitions
 */

import { mkdir, writeFile, access, readFile, rm } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { ConfigManager } from "../../core/config/manager.js";
import { catalog } from "../../core/catalog/loader.js";
import { ComposeManager } from "../../services/docker/compose.js";
import { docker } from "../../services/docker/client.js";
import { CaddyManager } from "../../services/caddy/manager.js";
import { CoreDnsManager } from "../../services/dns/coredns.js";
import type { ServiceDefinition, ServiceConfig } from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { detectHostIp } from "../../utils/network.js";

export type ServiceState = "available" | "enabled" | "running" | "stopped" | "disabled";

export interface ServiceInfo {
  name: string;
  state: ServiceState;
  definition?: ServiceDefinition;
  config?: ServiceConfig;
  containerStatus?: {
    id: string;
    state: string;
    health?: string;
    uptime?: number;
  } | null;
}

export class LifecycleManager {
  private configManager: ConfigManager;
  private composeManager: ComposeManager;
  private caddyManager: CaddyManager;
  private dnsManager: CoreDnsManager;
  private detectHostIp = detectHostIp;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
    const tuitionDir = this.configManager.getTuitionDir();
    this.composeManager = new ComposeManager(tuitionDir);
    this.caddyManager = new CaddyManager(tuitionDir);
    this.dnsManager = new CoreDnsManager(tuitionDir);
  }

  /**
   * Initialize the lifecycle manager
   */
  async initialize(): Promise<void> {
    await this.configManager.initialize();
    await this.caddyManager.initialize();
    await this.dnsManager.initialize();

    // Ensure data directories exist
    const tuitionDir = this.configManager.getTuitionDir();
    await mkdir(join(tuitionDir, "data"), { recursive: true });
  }

  /**
   * Update CoreDNS configuration for static hosts
   * Docker service DNS is handled by Joyride via coredns.host.name container labels.
   * Only the tuition hostname needs a static hosts file entry.
   */
  private async updateDnsConfig(): Promise<void> {
    const globalConfig = await this.configManager.loadGlobal();

    // Detect the host's LAN IP so external DNS clients can route to it
    const hostIp = this.detectHostIp();
    const staticHosts: Record<string, string> = {};

    if (hostIp) {
      // Register tuition hostname (e.g., nxs-svc-dev.nexus-central.tech)
      const tuitionHostname = `${globalConfig.hostname}.${globalConfig.domain}`;
      staticHosts[tuitionHostname] = hostIp;

      // Service subdomains are handled by Joyride via coredns.host.name labels
      // injected at compose generation time — no static hosts needed
    }

    // Regenerate static hosts file
    await this.dnsManager.generateConfig([], staticHosts);

    // Reload CoreDNS to pick up static hosts changes
    await this.dnsManager.reload();
  }

  /**
   * Update Caddy configuration for all enabled services
   */
  private async updateCaddyConfig(): Promise<void> {
    const globalConfig = await this.configManager.loadGlobal();
    const services = await this.configManager.loadServices();

    // Get enabled services
    const enabledServiceNames = Object.entries(services)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);

    // Load service definitions
    const enabledServices = [];
    for (const name of enabledServiceNames) {
      const def = await catalog.get(name);
      if (def) {
        enabledServices.push(def);
      }
    }

    // Regenerate Caddyfile
    await this.caddyManager.generateConfig(globalConfig, enabledServices);

    // Reload Caddy to apply changes
    await this.caddyManager.reload();
  }

  /**
   * Get service information including current state
   */
  async getService(name: string): Promise<ServiceInfo | null> {
    // Check if service exists in catalog
    const definition = await catalog.get(name);

    if (!definition) {
      return null;
    }

    // Load service config if enabled
    const config = await this.configManager.loadService(name);

    // Determine state
    let state: ServiceState = "available";

    if (config) {
      state = config.enabled ? ((await this.isRunning(name)) ? "running" : "stopped") : "disabled";
    }

    // Get container status if enabled
    let containerStatus = null;
    if (state === "running" || state === "stopped") {
      containerStatus = await this.getContainerStatus(name);
    }

    return {
      name,
      state,
      definition,
      config,
      containerStatus,
    };
  }

  /**
   * Enable a service
   */
  async enable(
    name: string,
    options: {
      autoStart?: boolean;
      customEnv?: Record<string, string>;
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    // Check if service exists in catalog
    const definition = await catalog.get(name);
    if (!definition) {
      return {
        success: false,
        message: `Service '${name}' not found in catalog`,
      };
    }

    // Resolve dependencies — enable required services first
    if (definition.dependsOn && definition.dependsOn.length > 0) {
      for (const depName of definition.dependsOn) {
        const depConfig = await this.configManager.loadService(depName);
        if (!depConfig || !depConfig.enabled) {
          logger.warn("lifecycle.manager", `Auto-enabling dependency '${depName}' for '${name}'`);
          const depResult = await this.enable(depName, { autoStart: options.autoStart });
          if (!depResult.success) {
            return {
              success: false,
              message: `Failed to enable dependency '${depName}': ${depResult.message}`,
            };
          }
        }
      }
    }

    // Load global config for env vars
    const globalConfig = await this.configManager.loadGlobal();
    const infraConfig = await this.configManager.loadInfrastructure();
    const nfsConfigs = infraConfig?.nfs ?? [];

    // Build environment variables
    const envVars: Record<string, string> = {
      DOMAIN: globalConfig.domain,
      HOSTNAME: globalConfig.hostname,
      TZ: globalConfig.timezone,
      PUID: String(globalConfig.puid),
      PGID: String(globalConfig.pgid),
      HOST_IP: this.detectHostIp() ?? "127.0.0.1",
      MEDIA_PATH: "./data/media", // Default media path
      ...options.customEnv,
    };

    // Generate service-specific secrets if needed
    if (definition.environment) {
      for (const [key, value] of Object.entries(definition.environment)) {
        if (value.includes("${") && value.includes("PASSWORD")) {
          const varName = value.replace(/\$\{(\w+)\}/, "$1");
          if (!envVars[varName]) {
            envVars[varName] = this.configManager.generatePassword(32);
          }
        }
      }
    }

    // Create data directories for service
    await this.createServiceDirectories(name, definition);

    // Generate compose file (pass NFS configs for Docker-managed volume resolution)
    const composePath = await this.composeManager.generateCompose(name, definition, envVars, nfsConfigs);

    // Save service config
    const serviceConfig: ServiceConfig = {
      enabled: true,
      imageTag: "latest",
      environment: envVars,
    };

    await this.configManager.saveService(name, serviceConfig);

    // Auto-start if requested
    if (options.autoStart !== false) {
      const result = await this.start(name);
      if (!result.success) {
        return {
          success: false,
          message: `Service enabled but failed to start: ${result.message}`,
        };
      }
    }

    // Update Caddy configuration
    try {
      await this.updateCaddyConfig();
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to update Caddy configuration: ${error}`);
    }

    // Update CoreDNS configuration
    try {
      await this.updateDnsConfig();
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to update CoreDNS configuration: ${error}`);
    }

    return {
      success: true,
      message:
        options.autoStart !== false
          ? `Service '${name}' enabled and started`
          : `Service '${name}' enabled (start with: tuition service start ${name})`,
    };
  }

  /**
   * Disable a service
   */
  async disable(
    name: string,
    options: {
      removeData?: boolean;
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    const config = await this.configManager.loadService(name);

    if (!config) {
      return {
        success: false,
        message: `Service '${name}' is not enabled`,
      };
    }

    // Stop the service first
    const stopResult = await this.stop(name);
    if (!stopResult.success) {
      return {
        success: false,
        message: `Failed to stop service: ${stopResult.message}`,
      };
    }

    // Update config to disabled
    config.enabled = false;
    await this.configManager.saveService(name, config);

    // Remove data if requested (destructive!)
    if (options.removeData) {
      const dataDir = join(this.configManager.getTuitionDir(), "data", name);
      try {
        await rm(dataDir, { recursive: true, force: true });
        logger.warn("lifecycle.manager", `Removed data directory for service '${name}'`);
      } catch (error) {
        logger.warn("lifecycle.manager", `Failed to remove data for '${name}': ${error}`);
      }
    }

    // Update Caddy configuration to remove route
    try {
      await this.updateCaddyConfig();
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to update Caddy configuration: ${error}`);
    }

    // Update CoreDNS configuration
    try {
      await this.updateDnsConfig();
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to update CoreDNS configuration: ${error}`);
    }

    return {
      success: true,
      message: options.removeData
        ? `Service '${name}' disabled (data removed)`
        : `Service '${name}' disabled (data preserved)`,
    };
  }

  /**
   * Remove a service completely, returning it to 'available' state.
   * Stops the container, deletes the config file, removes the compose file,
   * and by default removes service data (override with keepData).
   */
  async remove(
    name: string,
    options: {
      keepData?: boolean;
    } = {}
  ): Promise<{ success: boolean; message: string }> {
    const config = await this.configManager.loadService(name);

    if (!config) {
      return {
        success: false,
        message: `Service '${name}' has no configuration to remove`,
      };
    }

    // Stop the service if it's running
    const stopResult = await this.stop(name);
    if (!stopResult.success && !stopResult.message.includes("Failed to stop")) {
      // Ignore stop failures (service may already be stopped)
    }

    // Remove service data unless keepData is set
    if (!options.keepData) {
      const dataDir = join(this.configManager.getTuitionDir(), "data", name);
      try {
        await rm(dataDir, { recursive: true, force: true });
        logger.info("lifecycle.manager", `Removed data directory for service '${name}'`);
      } catch (error) {
        logger.warn("lifecycle.manager", `Failed to remove data for '${name}': ${error}`);
      }
    }

    // Remove compose file
    const composePath = join(this.configManager.getTuitionDir(), `${name}.docker-compose.yaml`);
    try {
      await rm(composePath, { force: true });
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to remove compose file for '${name}': ${error}`);
    }

    // Delete the service config file
    await this.configManager.deleteService(name);

    // Update Caddy configuration to remove route
    try {
      await this.updateCaddyConfig();
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to update Caddy configuration: ${error}`);
    }

    // Update CoreDNS configuration
    try {
      await this.updateDnsConfig();
    } catch (error) {
      logger.warn("lifecycle.manager", `Failed to update CoreDNS configuration: ${error}`);
    }

    return {
      success: true,
      message: options.keepData ? `Service '${name}' removed (data preserved)` : `Service '${name}' removed`,
    };
  }

  /**
   * Start a service
   */
  async start(name: string): Promise<{ success: boolean; message: string }> {
    // Ensure Docker network exists before starting
    const networkExists = await docker.networkExists("tuition");
    if (!networkExists) {
      try {
        await docker.createNetwork("tuition");
      } catch (error) {
        return {
          success: false,
          message: `Failed to create Docker network: ${error}`,
        };
      }
    }

    const result = await this.composeManager.up(name);

    return {
      success: result.success,
      message: result.success ? `Service '${name}' started` : `Failed to start '${name}': ${result.output}`,
    };
  }

  /**
   * Stop a service
   */
  async stop(name: string): Promise<{ success: boolean; message: string }> {
    const result = await this.composeManager.down(name);

    return {
      success: result.success,
      message: result.success ? `Service '${name}' stopped` : `Failed to stop '${name}': ${result.output}`,
    };
  }

  /**
   * Restart a service
   */
  async restart(name: string): Promise<{ success: boolean; message: string }> {
    const stopResult = await this.stop(name);
    if (!stopResult.success) {
      return stopResult;
    }

    // Small delay to ensure clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return this.start(name);
  }

  /**
   * Update service to latest image
   */
  async update(name: string): Promise<{ success: boolean; message: string }> {
    // Pull latest image
    const pullResult = await this.composeManager.pull(name);
    if (!pullResult.success) {
      return {
        success: false,
        message: `Failed to pull latest image: ${pullResult.output}`,
      };
    }

    // Restart with new image
    const stopResult = await this.stop(name);
    if (!stopResult.success) {
      return stopResult;
    }

    return this.start(name);
  }

  /**
   * Get service logs
   */
  async logs(
    name: string,
    options: {
      tail?: number;
      follow?: boolean;
    } = {}
  ): Promise<{ success: boolean; output: string }> {
    const result = await this.composeManager.logs(name, options);
    return result;
  }

  /**
   * List all services and their states
   */
  async listAll(): Promise<ServiceInfo[]> {
    const definitions = await catalog.getAll();
    const services: ServiceInfo[] = [];

    for (const definition of definitions) {
      const info = await this.getService(definition.name);
      if (info) {
        services.push(info);
      }
    }

    return services;
  }

  /**
   * Check if service is running
   */
  private async isRunning(name: string): Promise<boolean> {
    const container = await docker.getContainer(name);
    return container !== null && container.state === "running";
  }

  /**
   * Get container status for a service
   */
  private async getContainerStatus(name: string): Promise<ServiceInfo["containerStatus"]> {
    const container = await docker.getContainer(name);

    if (!container) {
      return null;
    }

    return {
      id: container.id,
      state: container.state,
      health: container.health,
      uptime: container.uptime,
    };
  }

  /**
   * Create necessary directories for a service.
   * Only creates local directories for bind-mount volumes.
   * NFS-backed volumes (type: 'nfs') are managed by Docker at container
   * start time and require no local directory creation.
   */
  private async createServiceDirectories(name: string, definition: ServiceDefinition): Promise<void> {
    const tuitionDir = this.configManager.getTuitionDir();

    if (definition.volumes) {
      for (const volume of definition.volumes) {
        // Skip NFS volumes — Docker manages them
        if (volume.type === "nfs") continue;

        // Parse host path for bind volumes
        let hostPath = volume.host;

        // Replace variables
        hostPath = hostPath.replace(/\$\{(\w+)\}/g, (match, varName) => {
          if (varName === "MEDIA_PATH") {
            return "./data/media";
          }
          return match;
        });

        // Skip if not a relative path
        if (hostPath.startsWith("/")) continue;

        // Create directory
        const fullPath = join(tuitionDir, hostPath.replace(/^\.\//, ""));
        await mkdir(fullPath, { recursive: true });
      }
    }
  }
}
