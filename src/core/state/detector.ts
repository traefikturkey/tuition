/**
 * State detector
 * Determines actual service state by querying Docker, not marker files
 */

import { docker } from "../../services/docker/client.js";
import type { ServiceState, ServiceStatus } from "../../types/index.js";
import type { ConfigManager } from "../config/manager.js";

export class StateDetector {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Detect the actual state of a service by checking config and Docker
   */
  async detect(name: string): Promise<ServiceStatus> {
    const config = await this.configManager.loadService(name);
    const container = await this.getContainerState(name);

    let state: ServiceState;

    if (!config) {
      // No config = not enabled
      state = "available";
    } else if (!config.enabled) {
      state = "disabled";
    } else if (container && container.running) {
      state = "running";
    } else if (config.enabled && container && !container.running) {
      state = "stopped";
    } else if (config.enabled) {
      // Enabled but no container exists yet
      state = "enabled";
    } else {
      state = "available";
    }

    return {
      name,
      state,
      containerId: container?.id,
      health: container?.health,
      uptime: container?.uptime,
      ports: container?.ports,
    };
  }

  /**
   * Detect states for all known services
   */
  async detectAll(names: string[]): Promise<ServiceStatus[]> {
    const results: ServiceStatus[] = [];

    for (const name of names) {
      results.push(await this.detect(name));
    }

    return results;
  }

  /**
   * Query Docker for a container matching the service name
   */
  private async getContainerState(name: string): Promise<{
    id: string;
    running: boolean;
    health?: "healthy" | "unhealthy" | "starting" | "unknown";
    uptime?: number;
    ports: number[];
  } | null> {
    try {
      const container = await docker.getContainer(name);

      if (!container) {
        return null;
      }

      return {
        id: container.id,
        running: container.state === "running",
        health: container.health,
        uptime: container.uptime,
        ports: container.ports.map((p) => p.privatePort),
      };
    } catch {
      return null;
    }
  }
}
