/**
 * Docker Compose operations
 * Manages docker-compose files and container orchestration
 */

import { spawn, type ChildProcess } from "child_process";
import { writeFile, mkdir, access } from "fs/promises";
import { constants } from "fs";
import { join, dirname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ServiceDefinition, PortMapping, VolumeMapping } from "../../types/index.js";

export interface ComposeService {
  image: string;
  container_name?: string;
  environment?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  labels?: Record<string, string>;
  networks?: string[];
  restart?: string;
  healthcheck?: {
    test: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
  };
  deploy?: {
    resources?: {
      limits?: {
        cpus?: string;
        memory?: string;
      };
    };
  };
}

export interface ComposeFile {
  version?: string;
  services: Record<string, ComposeService>;
  networks?: Record<string, { driver: string; external?: boolean }>;
  volumes?: Record<string, { driver: string }>;
}

export class ComposeManager {
  private projectPath: string;
  private spawnProcess = spawn;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Generate docker-compose.yaml from service definition
   */
  async generateCompose(name: string, definition: ServiceDefinition, envVars: Record<string, string>): Promise<string> {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);

    // Resolve environment variables
    const resolvedEnv = this.resolveEnvironment(definition.environment || {}, envVars);
    const resolvedVolumes = this.resolveVolumes(definition.volumes || [], envVars);

    const service: ComposeService = {
      image: definition.image,
      container_name: name,
      environment: resolvedEnv,
      ports: this.formatPorts(definition.ports || []),
      volumes: resolvedVolumes,
      labels: this.buildLabels(definition.labels, envVars),
      networks: ["tuition"],
      restart: "unless-stopped",
      deploy: definition.resourceLimits
        ? {
            resources: {
              limits: {
                cpus: String(definition.resourceLimits.cpus || 1),
                memory: definition.resourceLimits.memory || "1G",
              },
            },
          }
        : undefined,
    };

    // Add health check if service exposes ports
    if (definition.ports && definition.ports.length > 0) {
      const firstPort = definition.ports[0];
      if (firstPort) {
        service.healthcheck = {
          test: ["CMD", "nc", "-z", "localhost", String(firstPort.container)],
          interval: "30s",
          timeout: "10s",
          retries: 3,
        };
      }
    }

    const compose: ComposeFile = {
      services: { [name]: service },
      networks: {
        tuition: {
          driver: "bridge",
          external: true,
        },
      },
    };

    const yaml = stringifyYaml(compose);
    await writeFile(composePath, yaml, "utf-8");

    return composePath;
  }

  /**
   * Run docker-compose up for a service
   */
  async up(
    name: string,
    options: {
      detached?: boolean;
      build?: boolean;
      env?: Record<string, string>;
    } = {}
  ): Promise<{ success: boolean; output: string }> {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);

    // Check if compose file exists
    try {
      await access(composePath, constants.F_OK);
    } catch {
      return {
        success: false,
        output: `Compose file not found: ${composePath}`,
      };
    }

    const args = ["compose", "-f", composePath, "-p", name, "up"];

    if (options.detached !== false) {
      args.push("-d");
    }

    if (options.build) {
      args.push("--build");
    }

    return this.execDocker(args, options.env);
  }

  /**
   * Run docker-compose down for a service
   */
  async down(
    name: string,
    options: {
      removeVolumes?: boolean;
      removeImages?: boolean;
    } = {}
  ): Promise<{ success: boolean; output: string }> {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);

    const args = ["compose", "-f", composePath, "-p", name, "down"];

    if (options.removeVolumes) {
      args.push("-v");
    }

    if (options.removeImages) {
      args.push("--rmi", "all");
    }

    return this.execDocker(args);
  }

  /**
   * Get service status via docker-compose ps
   */
  async ps(name: string): Promise<{ success: boolean; output: string }> {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);

    const args = ["compose", "-f", composePath, "-p", name, "ps"];

    return this.execDocker(args);
  }

  /**
   * Get service logs via docker-compose logs
   */
  async logs(
    name: string,
    options: {
      tail?: number;
      follow?: boolean;
      timestamps?: boolean;
    } = {}
  ): Promise<{ success: boolean; output: string }> {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);

    const args = ["compose", "-f", composePath, "-p", name, "logs"];

    if (options.tail) {
      args.push("--tail", String(options.tail));
    }

    if (options.timestamps) {
      args.push("--timestamps");
    }

    if (options.follow) {
      args.push("-f");
    }

    return this.execDocker(args);
  }

  /**
   * Stream logs from a service via docker compose logs -f.
   * Returns the spawned ChildProcess so the caller can read stdout/stderr
   * and kill the process when done.
   */
  streamLogs(
    name: string,
    options: {
      tail?: number;
    } = {}
  ): ChildProcess {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);
    const args = ["compose", "-f", composePath, "-p", name, "logs", "-f"];

    if (options.tail) {
      args.push("--tail", String(options.tail));
    }

    const proc = this.spawnProcess("docker", args, {
      cwd: this.projectPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return proc;
  }

  /**
   * Pull latest images for a service
   */
  async pull(name: string): Promise<{ success: boolean; output: string }> {
    const composePath = join(this.projectPath, `${name}.docker-compose.yaml`);

    const args = ["compose", "-f", composePath, "-p", name, "pull"];

    return this.execDocker(args);
  }

  /**
   * Execute docker command
   */
  private execDocker(args: string[], env?: Record<string, string>): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const envVars = env ? { ...process.env, ...env } : process.env;
      const proc = this.spawnProcess("docker", args, {
        cwd: this.projectPath,
        stdio: ["pipe", "pipe", "pipe"],
        env: envVars,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString("utf-8");
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString("utf-8");
      });

      proc.on("close", (code) => {
        const output = stdout + (stderr ? `\n${stderr}` : "");
        resolve({
          success: code === 0,
          output: output.trim(),
        });
      });

      proc.on("error", (error) => {
        resolve({
          success: false,
          output: error.message,
        });
      });
    });
  }

  /**
   * Format port mappings for docker-compose
   */
  private formatPorts(ports: PortMapping[]): string[] {
    return ports.map((p) => {
      const protocol = p.protocol || "tcp";
      return `${p.host}:${p.container}/${protocol}`;
    });
  }

  /**
   * Resolve environment variables with substitutions
   */
  private resolveEnvironment(env: Record<string, string>, vars: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      // Replace ${VAR} with actual values
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (match, varName) => {
        return vars[varName] || match;
      });
    }

    return resolved;
  }

  /**
   * Build container labels, auto-generating coredns.host.name from caddy label
   * so Joyride can discover services for DNS registration via Docker labels
   */
  private buildLabels(
    labels: Record<string, string> | undefined,
    envVars: Record<string, string>
  ): Record<string, string> | undefined {
    if (!labels) {
      return undefined;
    }

    const caddyLabel = labels["caddy"];
    if (!caddyLabel) {
      return labels;
    }

    // Resolve ${DOMAIN} placeholder to generate the FQDN for DNS
    const resolvedHostname = caddyLabel.replace(/\$\{(\w+)\}/g, (match, varName) => {
      return envVars[varName] || match;
    });

    return {
      ...labels,
      "coredns.host.name": resolvedHostname,
    };
  }

  /**
   * Resolve volume paths with substitutions
   */
  private resolveVolumes(volumes: VolumeMapping[], vars: Record<string, string>): string[] {
    return volumes.map((v) => {
      let hostPath = v.host;

      // Replace ${VAR} with actual values
      hostPath = hostPath.replace(/\$\{(\w+)\}/g, (match, varName) => {
        return vars[varName] || match;
      });

      // Ensure relative paths are from project directory
      if (!hostPath.startsWith("/") && !hostPath.startsWith("~")) {
        hostPath = `./${hostPath}`;
      }

      const readOnly = v.readOnly ? ":ro" : "";
      return `${hostPath}:${v.container}${readOnly}`;
    });
  }
}
