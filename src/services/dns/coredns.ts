/**
 * CoreDNS manager using Joyride (traefikturkey/joyride)
 * Provides Docker label-based DNS registration with optional clustering
 */

import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { hostname as osHostname } from "os";
import { spawn } from "child_process";
import { ComposeManager } from "../docker/compose.js";
import { docker } from "../docker/client.js";
import type { ServiceDefinition, DnsClusterConfig } from "../../types/index.js";
import { detectHostIp } from "../../utils/network.js";

export interface DnsRecord {
  hostname: string;
  ip: string;
  type: "A" | "AAAA" | "CNAME";
  source: "container" | "static";
  containerId?: string;
}

export class CoreDnsManager {
  private projectPath: string;
  private composeManager: ComposeManager;
  private configPath: string;
  private dataPath: string;
  private spawnProcess = spawn;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.composeManager = new ComposeManager(projectPath);
    this.configPath = join(projectPath, "coredns-config");
    this.dataPath = join(projectPath, "coredns-data");
  }

  /**
   * Initialize CoreDNS directories
   */
  async initialize(): Promise<void> {
    await mkdir(this.configPath, { recursive: true });
    await mkdir(this.dataPath, { recursive: true });
  }

  /**
   * Generate Corefile and static hosts file
   * Joyride handles Docker service DNS via container labels automatically.
   * Only static hosts (non-Docker entries like tuition hostname) go in the hosts file.
   */
  async generateConfig(
    enabledServices: ServiceDefinition[],
    staticHosts: Record<string, string> = {}
  ): Promise<string> {
    const corefile = this.buildCorefile();

    await writeFile(join(this.configPath, "Corefile"), corefile, "utf-8");

    // Only static hosts — Docker service DNS is handled by Joyride via labels
    const hosts = this.buildHostsFile(staticHosts);
    await writeFile(join(this.configPath, "hosts"), hosts, "utf-8");

    return corefile;
  }

  /**
   * Build Corefile for Joyride with docker-cluster plugin
   * Uses split DNS (drop unknown queries) so Pi-hole/EdgeRouter handles upstream
   */
  private buildCorefile(): string {
    const lines: string[] = [];

    lines.push("# Tuition DNS Configuration (Joyride)");
    lines.push("# Auto-generated - do not edit manually");
    lines.push("");
    lines.push("# Listen on port 54 to avoid conflict with systemd-resolved on port 53");
    lines.push(".:54 {");
    lines.push("    # Bind explicitly to IPv4 on all interfaces for external accessibility");
    lines.push("    bind 0.0.0.0");
    lines.push("");
    lines.push("    # Docker label-based DNS — watches containers for coredns.host.name labels");
    lines.push("    docker-cluster {");
    lines.push("    }");
    lines.push("");
    lines.push("    # Static hosts for non-Docker entries (tuition hostname, NAS, printers)");
    lines.push("    hosts /etc/hosts.d/hosts {");
    lines.push("        fallthrough");
    lines.push("    }");
    lines.push("");
    lines.push("    # Cache responses");
    lines.push("    cache 30");
    lines.push("");
    lines.push("    # Logging");
    lines.push("    log");
    lines.push("    errors");
    lines.push("}");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Build hosts file with only static (non-Docker) entries
   * Docker service DNS is handled by Joyride via coredns.host.name container labels
   */
  private buildHostsFile(staticHosts: Record<string, string>): string {
    const lines: string[] = [];

    lines.push("# Tuition Static DNS Hosts");
    lines.push("# Auto-generated - do not edit manually");
    lines.push("# Docker service DNS is handled by Joyride via container labels");
    lines.push("");

    for (const [hostname, ip] of Object.entries(staticHosts)) {
      lines.push(`${ip} ${hostname}`);
    }

    return lines.join("\n");
  }

  /**
   * Start CoreDNS container
   */
  async start(dnsCluster?: DnsClusterConfig): Promise<{ success: boolean; message: string }> {
    // Ensure Docker network exists
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

    // Generate compose file with optional cluster configuration
    await this.generateComposeFile(dnsCluster);

    // Check if already running
    const container = await docker.getContainer("coredns");
    if (container && container.state === "running") {
      return { success: true, message: "CoreDNS is already running" };
    }

    // Start via docker-compose
    const result = await this.composeManager.up("coredns", { detached: true });

    if (result.success) {
      return { success: true, message: "CoreDNS started successfully" };
    } else {
      return { success: false, message: `Failed to start CoreDNS: ${result.output}` };
    }
  }

  /**
   * Stop CoreDNS container
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    const result = await this.composeManager.down("coredns");

    if (result.success) {
      return { success: true, message: "CoreDNS stopped" };
    } else {
      return { success: false, message: `Failed to stop CoreDNS: ${result.output}` };
    }
  }

  /**
   * Reload CoreDNS configuration
   */
  async reload(): Promise<{ success: boolean; message: string }> {
    // CoreDNS supports graceful reload with SIGUSR1
    const result = await this.sendReloadSignal();

    if (result.success) {
      return { success: true, message: "CoreDNS configuration reloaded" };
    } else {
      // Fallback to restart
      const stopResult = await this.stop();
      if (!stopResult.success) {
        return stopResult;
      }
      return this.start();
    }
  }

  /**
   * Get CoreDNS status
   */
  async status(): Promise<{
    running: boolean;
    hosts: number;
  }> {
    let running = false;
    try {
      const container = await docker.getContainer("coredns");
      running = container !== null && container.state === "running";
    } catch {
      running = false;
    }

    let hosts = 0;
    try {
      const hostsFile = await readFile(join(this.configPath, "hosts"), "utf-8");
      hosts = hostsFile.split("\n").filter((line) => line && !line.startsWith("#")).length;
    } catch {
      // File doesn't exist yet
    }

    return { running, hosts };
  }

  /**
   * Generate docker-compose.yaml for Joyride (CoreDNS fork)
   * Uses host networking to bind directly to host interfaces on port 54
   * Mounts Docker socket for container label discovery
   */
  private async generateComposeFile(dnsCluster?: DnsClusterConfig): Promise<void> {
    const { stringify: stringifyYaml } = await import("yaml");

    const hostIp = detectHostIp() ?? "127.0.0.1";

    const environment: Record<string, string> = {
      HOSTIP: hostIp,
      DNS_UNKNOWN_ACTION: "drop",
      DOCKER_SOCKET: "/var/run/docker.sock",
      CLUSTER_ENABLED: String(dnsCluster?.enabled ?? false),
      NODE_NAME: dnsCluster?.nodeName ?? osHostname(),
    };

    // Only include cluster secrets/seeds when clustering is configured
    if (dnsCluster?.clusterSecret) {
      environment.CLUSTER_SECRET = dnsCluster.clusterSecret;
    }
    if (dnsCluster?.clusterSeeds && dnsCluster.clusterSeeds.length > 0) {
      environment.CLUSTER_SEEDS = dnsCluster.clusterSeeds.join(",");
    }

    const compose = {
      services: {
        coredns: {
          image: "ghcr.io/traefikturkey/joyride:latest",
          container_name: "coredns",
          restart: "unless-stopped",
          // Host networking for direct port 54 binding and HOSTIP auto-detection
          network_mode: "host",
          environment,
          volumes: [
            `${this.configPath}/Corefile:/etc/coredns/Corefile:ro`,
            `${this.configPath}/hosts:/etc/hosts.d/hosts:ro`,
            "/var/run/docker.sock:/var/run/docker.sock:ro",
          ],
          command: ["-conf", "/etc/coredns/Corefile"],
        },
      },
    };

    const yaml = stringifyYaml(compose);
    await writeFile(join(this.projectPath, "coredns.docker-compose.yaml"), yaml, "utf-8");
  }

  /**
   * Reload CoreDNS via docker kill
   */
  private async sendReloadSignal(): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const proc = this.spawnProcess("docker", ["kill", "-s", "USR1", "coredns"], {
        cwd: this.projectPath,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString("utf-8");
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString("utf-8");
      });

      proc.on("close", (code: number | null) => {
        const output = stdout + (stderr ? `\n${stderr}` : "");
        resolve({
          success: code === 0,
          output: output.trim(),
        });
      });

      proc.on("error", (error: Error) => {
        resolve({
          success: false,
          output: error.message,
        });
      });
    });
  }
}
