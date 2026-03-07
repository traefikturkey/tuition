/**
 * Caddy manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { CaddyManager } from "../../src/services/caddy/manager.js";
import { mkdtemp, rm, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { ServiceDefinition } from "../../src/types/index.js";
import { docker } from "../../src/services/docker/client.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("CaddyManager", () => {
  let tempDir: string;
  let manager: CaddyManager;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-caddy-test-"));
    manager = new CaddyManager(tempDir);
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create data directories", async () => {
      await manager.initialize();

      // Check directories exist
      const configDir = join(tempDir, "caddy-data", "config");
      const dataDir = join(tempDir, "caddy-data", "data");
      const logsDir = join(tempDir, "caddy-data", "logs");

      const configExists = await access(configDir)
        .then(() => true)
        .catch(() => false);
      const dataExists = await access(dataDir)
        .then(() => true)
        .catch(() => false);
      const logsExists = await access(logsDir)
        .then(() => true)
        .catch(() => false);

      expect(configExists).toBe(true);
      expect(dataExists).toBe(true);
      expect(logsExists).toBe(true);
    });

    it("should not fail if directories already exist", async () => {
      await manager.initialize();
      await expect(manager.initialize()).resolves.toBeUndefined();
    });
  });

  describe("generateConfig", () => {
    it("should generate Caddyfile with basic config", async () => {
      await manager.initialize();

      const globalConfig = {
        domain: "example.com",
        adminEmail: "admin@example.com",
        dnsProvider: "cloudflare" as const,
        cloudflareToken: "test-token",
      };

      const services: ServiceDefinition[] = [];

      const caddyfile = await manager.generateConfig(globalConfig, services);

      expect(caddyfile).toContain("admin@example.com");
      expect(caddyfile).toContain("*.example.com");
      expect(caddyfile).toContain("dns cloudflare");
      expect(caddyfile).toContain("tuition.example.com");
    });

    it("should include service routes", async () => {
      await manager.initialize();

      const globalConfig = {
        domain: "example.com",
        adminEmail: "admin@example.com",
        dnsProvider: "cloudflare" as const,
      };

      const services: ServiceDefinition[] = [
        {
          name: "pihole",
          category: "dns",
          description: "DNS server",
          image: "pihole/pihole",
          labels: {
            caddy: "pihole",
            "caddy.reverse_proxy": "{{upstreams 80}}",
          },
        },
      ];

      const caddyfile = await manager.generateConfig(globalConfig, services);

      expect(caddyfile).toContain("pihole.example.com");
      expect(caddyfile).toContain("reverse_proxy pihole:80");
    });

    it("should include admin password hash when provided", async () => {
      await manager.initialize();

      const globalConfig = {
        domain: "example.com",
        adminEmail: "admin@example.com",
        dnsProvider: "cloudflare" as const,
        adminPasswordHash: "$2b$10$testhash123",
      };

      const services: ServiceDefinition[] = [];

      const caddyfile = await manager.generateConfig(globalConfig, services);

      expect(caddyfile).toContain("admin $2b$10$testhash123");
      expect(caddyfile).not.toContain("# Admin UI password not configured");
    });

    it("should show placeholder when no admin password", async () => {
      await manager.initialize();

      const globalConfig = {
        domain: "example.com",
        adminEmail: "admin@example.com",
        dnsProvider: "cloudflare" as const,
      };

      const services: ServiceDefinition[] = [];

      const caddyfile = await manager.generateConfig(globalConfig, services);

      expect(caddyfile).toContain("# Admin UI password not configured");
      expect(caddyfile).toContain("# Run: tuition caddy set-password");
    });

    it("should write Caddyfile to disk", async () => {
      await manager.initialize();

      const globalConfig = {
        domain: "example.com",
        adminEmail: "admin@example.com",
        dnsProvider: "cloudflare" as const,
      };

      await manager.generateConfig(globalConfig, []);

      const caddyfilePath = join(tempDir, "Caddyfile");
      const content = await readFile(caddyfilePath, "utf-8");
      expect(content).toContain("admin@example.com");
    });
  });

  describe("status", () => {
    it("should return zero routes when Caddyfile does not exist", async () => {
      const status = await manager.status();
      // running state depends on Docker, but routes should be 0
      expect(status.routes).toBe(0);
    });

    it("should count routes correctly", async () => {
      await manager.initialize();

      const globalConfig = {
        domain: "example.com",
        adminEmail: "admin@example.com",
        dnsProvider: "cloudflare" as const,
      };

      const services: ServiceDefinition[] = [
        {
          name: "svc1",
          category: "dns",
          description: "Service 1",
          image: "test",
          labels: { caddy: "svc1.${DOMAIN}" },
        },
        {
          name: "svc2",
          category: "media",
          description: "Service 2",
          image: "test",
          labels: { caddy: "svc2.${DOMAIN}" },
        },
      ];

      await manager.generateConfig(globalConfig, services);
      const status = await manager.status();

      // Should count routes: wildcard cert block + tuition admin + 2 services = 4 total
      // But we subtract 1 for the wildcard cert block in the counting logic
      expect(status.routes).toBeGreaterThanOrEqual(2);
    });

    it("should report running when the caddy container is running", async () => {
      patchSet.patch(docker, "getContainer", async () => ({
        id: "caddy-id",
        name: "caddy",
        image: "caddy:latest",
        state: "running",
        status: "Up 2 minutes",
        ports: [],
        labels: {},
      }));

      const status = await manager.status();

      expect(status.running).toBe(true);
      expect(status.configValid).toBe(true);
    });
  });

  describe("start", () => {
    it("should return early when Caddy is already running", async () => {
      patchSet.patch(docker, "getContainer", async () => ({
        id: "caddy-id",
        name: "caddy",
        image: "caddy:latest",
        state: "running",
        status: "Up",
        ports: [],
        labels: {},
      }));

      const result = await manager.start();

      expect(result).toEqual({ success: true, message: "Caddy is already running" });
    });

    it("should fail when Docker network creation fails", async () => {
      patchSet.patch(docker, "getContainer", async () => null);
      patchSet.patch(docker, "networkExists", async () => false);
      patchSet.patch(docker, "createNetwork", async () => {
        throw new Error("network boom");
      });

      const result = await manager.start();

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to create Docker network");
    });

    it("should report compose startup failures", async () => {
      patchSet.patch(docker, "getContainer", async () => null);
      patchSet.patch(docker, "networkExists", async () => true);
      patchSet.patch(
        manager as unknown as { generateComposeFile: () => Promise<void> },
        "generateComposeFile",
        async () => undefined
      );
      patchSet.patch(
        manager as unknown as { composeManager: { up: () => Promise<{ success: boolean; output: string }> } },
        "composeManager",
        {
          up: async () => ({ success: false, output: "compose failed" }),
        } as never
      );

      const result = await manager.start({ DOMAIN: "example.com" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("compose failed");
    });

    it("should start successfully through compose when prerequisites are satisfied", async () => {
      patchSet.patch(docker, "getContainer", async () => null);
      patchSet.patch(docker, "networkExists", async () => true);
      patchSet.patch(
        manager as unknown as { generateComposeFile: () => Promise<void> },
        "generateComposeFile",
        async () => undefined
      );

      let receivedEnv: Record<string, string> | undefined;
      patchSet.patch(
        manager as unknown as {
          composeManager: {
            up: (
              name: string,
              options?: { detached?: boolean; env?: Record<string, string> }
            ) => Promise<{ success: boolean; output: string }>;
          };
        },
        "composeManager",
        {
          up: async (_name: string, options?: { detached?: boolean; env?: Record<string, string> }) => {
            receivedEnv = options?.env;
            return { success: true, output: "ok" };
          },
        } as never
      );

      const result = await manager.start({ CF_API_TOKEN: "token" });

      expect(result).toEqual({ success: true, message: "Caddy started successfully" });
      expect(receivedEnv).toEqual({ CF_API_TOKEN: "token" });
    });
  });

  describe("stop", () => {
    it("should report success when compose down succeeds", async () => {
      patchSet.patch(
        manager as unknown as { composeManager: { down: () => Promise<{ success: boolean; output: string }> } },
        "composeManager",
        {
          down: async () => ({ success: true, output: "ok" }),
        } as never
      );

      const result = await manager.stop();

      expect(result).toEqual({ success: true, message: "Caddy stopped" });
    });

    it("should report failure when compose down fails", async () => {
      patchSet.patch(
        manager as unknown as { composeManager: { down: () => Promise<{ success: boolean; output: string }> } },
        "composeManager",
        {
          down: async () => ({ success: false, output: "down failed" }),
        } as never
      );

      const result = await manager.stop();

      expect(result.success).toBe(false);
      expect(result.message).toContain("down failed");
    });
  });

  describe("reload", () => {
    it("should return a success message when graceful reload succeeds", async () => {
      patchSet.patch(
        manager as unknown as { execCaddyCommand: (args: string[]) => Promise<{ success: boolean; output: string }> },
        "execCaddyCommand",
        async () => ({
          success: true,
          output: "ok",
        })
      );

      const result = await manager.reload();

      expect(result).toEqual({ success: true, message: "Caddy configuration reloaded" });
    });

    it("should fall back to restart when graceful reload fails", async () => {
      patchSet.patch(
        manager as unknown as { execCaddyCommand: (args: string[]) => Promise<{ success: boolean; output: string }> },
        "execCaddyCommand",
        async () => ({
          success: false,
          output: "reload failed",
        })
      );
      patchSet.patch(manager, "restart", async () => ({
        success: true,
        message: "restarted after reload failure",
      }));

      const result = await manager.reload();

      expect(result.success).toBe(true);
      expect(result.message).toContain("restarted after reload failure");
    });
  });

  describe("restart", () => {
    it("should return early when stop fails", async () => {
      patchSet.patch(manager, "stop", async () => ({
        success: false,
        message: "stop failed",
      }));

      const result = await manager.restart();

      expect(result).toEqual({ success: false, message: "stop failed" });
    });

    it("should restart with the provided environment after a successful stop", async () => {
      patchSet.patch(manager, "stop", async () => ({
        success: true,
        message: "stopped",
      }));
      patchSet.patch(manager, "start", async (envVars?: Record<string, string>) => ({
        success: envVars?.CF_API_TOKEN === "token",
        message: envVars?.CF_API_TOKEN === "token" ? "started" : "missing env",
      }));

      const result = await manager.restart({ CF_API_TOKEN: "token" });

      expect(result).toEqual({ success: true, message: "started" });
    });
  });

  describe("generateComposeFile", () => {
    it("should generate compose file with DNS configuration", async () => {
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const content = await readFile(join(tempDir, "caddy.docker-compose.yaml"), "utf-8");

      expect(content).toContain("iarekylew00t/caddy-cloudflare:latest");
      expect(content).toContain("80:80");
      expect(content).toContain("443:443/udp");
      expect(content).toContain("CF_API_TOKEN: ${CF_API_TOKEN}");
      expect(content).toContain("external: true");
    });
  });

  describe("private helpers", () => {
    it("should return trimmed stdout and stderr from execCaddyCommand", async () => {
      patchSet.patch(
        manager as unknown as {
          spawnProcess: (
            command: string,
            args: string[],
            options: Record<string, unknown>
          ) => {
            stdout: { on: (event: string, handler: (data: Buffer) => void) => void };
            stderr: { on: (event: string, handler: (data: Buffer) => void) => void };
            on: (event: string, handler: (value: unknown) => void) => void;
          };
        },
        "spawnProcess",
        ((_command: string, _args: string[], _options: Record<string, unknown>) => {
          const handlers: Record<string, (value: unknown) => void> = {};

          queueMicrotask(() => {
            handlers["stdout:data"]?.(Buffer.from("caddy-stdout"));
            handlers["stderr:data"]?.(Buffer.from("caddy-stderr"));
            handlers.close?.(0);
          });

          return {
            stdout: {
              on: (event: string, handler: (data: Buffer) => void) => {
                handlers[`stdout:${event}`] = handler as (value: unknown) => void;
              },
            },
            stderr: {
              on: (event: string, handler: (data: Buffer) => void) => {
                handlers[`stderr:${event}`] = handler as (value: unknown) => void;
              },
            },
            on: (event: string, handler: (value: unknown) => void) => {
              handlers[event] = handler;
            },
          };
        }) as never
      );

      const result = await (
        manager as unknown as {
          execCaddyCommand: (args: string[]) => Promise<{ success: boolean; output: string }>;
        }
      ).execCaddyCommand(["version"]);

      expect(result).toEqual({
        success: true,
        output: "caddy-stdout\ncaddy-stderr",
      });
    });

    it("should return spawn errors from execCaddyCommand", async () => {
      patchSet.patch(
        manager as unknown as {
          spawnProcess: (
            command: string,
            args: string[],
            options: Record<string, unknown>
          ) => {
            stdout: { on: () => void };
            stderr: { on: () => void };
            on: (event: string, handler: (value: unknown) => void) => void;
          };
        },
        "spawnProcess",
        ((_command: string, _args: string[], _options: Record<string, unknown>) => {
          const handlers: Record<string, (value: unknown) => void> = {};

          queueMicrotask(() => {
            handlers.error?.(new Error("spawn boom"));
          });

          return {
            stdout: { on: () => undefined },
            stderr: { on: () => undefined },
            on: (event: string, handler: (value: unknown) => void) => {
              handlers[event] = handler;
            },
          };
        }) as never
      );

      const result = await (
        manager as unknown as {
          execCaddyCommand: (args: string[]) => Promise<{ success: boolean; output: string }>;
        }
      ).execCaddyCommand(["version"]);

      expect(result).toEqual({
        success: false,
        output: "spawn boom",
      });
    });
  });
});
