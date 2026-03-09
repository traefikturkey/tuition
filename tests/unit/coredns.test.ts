/**
 * CoreDNS manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { CoreDnsManager } from "../../src/services/dns/coredns.js";
import { mkdtemp, rm, readFile, access, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { ServiceDefinition } from "../../src/types/index.js";
import { docker } from "../../src/services/docker/client.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("CoreDnsManager", () => {
  let tempDir: string;
  let manager: CoreDnsManager;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-coredns-test-"));
    manager = new CoreDnsManager(tempDir);
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create config and data directories", async () => {
      await manager.initialize();

      const configDir = join(tempDir, "coredns-config");
      const dataDir = join(tempDir, "coredns-data");

      // Check directories exist (access returns undefined/null on success)
      const configExists = await access(configDir)
        .then(() => true)
        .catch(() => false);
      const dataExists = await access(dataDir)
        .then(() => true)
        .catch(() => false);

      expect(configExists).toBe(true);
      expect(dataExists).toBe(true);
    });

    it("should not fail if directories already exist", async () => {
      await manager.initialize();
      await expect(manager.initialize()).resolves.toBeUndefined();
    });
  });

  describe("generateConfig", () => {
    it("should generate Corefile with default upstream DNS", async () => {
      await manager.initialize();

      const services: ServiceDefinition[] = [];
      const corefile = await manager.generateConfig(services);

      expect(corefile).toContain("# Tuition CoreDNS Configuration");
      expect(corefile).toContain("bind 0.0.0.0");
      expect(corefile).toContain("forward . 8.8.8.8 8.8.4.4");
      expect(corefile).toContain("health_check 5s");
      expect(corefile).toContain("cache 30");
    });

    it("should use custom upstream DNS when provided", async () => {
      await manager.initialize();

      const services: ServiceDefinition[] = [];
      const upstreamDns = {
        primary: "1.1.1.1",
        backup: "1.0.0.1",
      };

      const corefile = await manager.generateConfig(services, {}, upstreamDns);

      expect(corefile).toContain("forward . 1.1.1.1 1.0.0.1");
    });

    it("should generate hosts file with static entries", async () => {
      await manager.initialize();

      const staticHosts = {
        "test.example.com": "10.0.0.1",
        "another.example.com": "10.0.0.2",
      };

      await manager.generateConfig([], staticHosts);

      const hostsPath = join(tempDir, "coredns-config", "hosts");
      const hostsContent = await readFile(hostsPath, "utf-8");

      expect(hostsContent).toContain("10.0.0.1 test.example.com");
      expect(hostsContent).toContain("10.0.0.2 another.example.com");
    });

    it("should include service entries in hosts file", async () => {
      await manager.initialize();

      const services: ServiceDefinition[] = [
        {
          name: "pihole",
          category: "dns",
          description: "DNS server",
          image: "pihole/pihole",
          labels: { "dns.hostname": "dns.internal" },
        },
      ];

      await manager.generateConfig(services);

      const hostsPath = join(tempDir, "coredns-config", "hosts");
      const hostsContent = await readFile(hostsPath, "utf-8");

      expect(hostsContent).toContain("# dns.internal -> pihole (container DNS, no static IP)");
    });
  });

  describe("status", () => {
    it("should return hosts count from file", async () => {
      await manager.initialize();

      // Create a hosts file with entries
      const hostsContent = `10.0.0.1 test1.example.com
10.0.0.2 test2.example.com
# This is a comment
`;
      await writeFile(join(tempDir, "coredns-config", "hosts"), hostsContent, "utf-8");

      const status = await manager.status();
      expect(status.hosts).toBe(2); // Only the two non-comment lines
    });

    it("should return zero hosts when no hosts file exists", async () => {
      await manager.initialize();

      const status = await manager.status();
      expect(status.hosts).toBe(0);
    });

    it("should return zero hosts when no hosts file exists", async () => {
      await manager.initialize();

      const status = await manager.status();
      expect(status.hosts).toBe(0);
    });

    it("should count hosts from hosts file", async () => {
      await manager.initialize();

      // Create a hosts file with entries
      const hostsContent = `10.0.0.1 test1.example.com
10.0.0.2 test2.example.com
# This is a comment
`;
      await writeFile(join(tempDir, "coredns-config", "hosts"), hostsContent, "utf-8");

      const status = await manager.status();
      expect(status.hosts).toBe(2); // Only the two non-comment lines
    });

    it("should return running false when Docker inspection throws", async () => {
      patchSet.patch(docker, "getContainer", async () => {
        throw new Error("docker unavailable");
      });

      const status = await manager.status();

      expect(status.running).toBe(false);
    });
  });

  describe("start", () => {
    it("returns early when CoreDNS is already running", async () => {
      patchSet.patch(docker, "networkExists", async () => true);
      patchSet.patch(docker, "getContainer", async () => ({
        id: "coredns-id",
        name: "coredns",
        image: "coredns/coredns:latest",
        state: "running",
        status: "Up",
        ports: [],
        labels: {},
      }));

      const result = await manager.start();

      expect(result).toEqual({ success: true, message: "CoreDNS is already running" });
    });

    it("starts CoreDNS when the network already exists", async () => {
      patchSet.patch(docker, "networkExists", async () => true);
      patchSet.patch(docker, "getContainer", async () => null);
      patchSet.patch(
        manager as unknown as { generateComposeFile: () => Promise<void> },
        "generateComposeFile",
        async () => undefined
      );
      patchSet.patch(
        manager as unknown as {
          composeManager: {
            up: (name: string, options?: Record<string, unknown>) => Promise<{ success: boolean; output: string }>;
          };
        },
        "composeManager",
        {
          up: async (name: string, options?: Record<string, unknown>) => {
            expect(name).toBe("coredns");
            expect(options).toEqual({ detached: true });
            return { success: true, output: "started" };
          },
        } as never
      );

      const result = await manager.start();

      expect(result).toEqual({ success: true, message: "CoreDNS started successfully" });
    });

    it("reports compose startup failures", async () => {
      patchSet.patch(docker, "networkExists", async () => true);
      patchSet.patch(docker, "getContainer", async () => null);
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

      const result = await manager.start();

      expect(result.success).toBe(false);
      expect(result.message).toContain("compose failed");
    });
  });

  describe("stop", () => {
    it("returns a success message when compose down succeeds", async () => {
      patchSet.patch(
        manager as unknown as { composeManager: { down: () => Promise<{ success: boolean; output: string }> } },
        "composeManager",
        {
          down: async () => ({ success: true, output: "ok" }),
        } as never
      );

      const result = await manager.stop();

      expect(result).toEqual({ success: true, message: "CoreDNS stopped" });
    });

    it("reports compose down failures", async () => {
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
    it("returns success when the reload signal succeeds", async () => {
      patchSet.patch(
        manager as unknown as { sendReloadSignal: () => Promise<{ success: boolean; output: string }> },
        "sendReloadSignal",
        async () => ({ success: true, output: "ok" })
      );

      const result = await manager.reload();

      expect(result).toEqual({ success: true, message: "CoreDNS configuration reloaded" });
    });

    it("returns stop failure when graceful reload and fallback stop both fail", async () => {
      patchSet.patch(
        manager as unknown as { sendReloadSignal: () => Promise<{ success: boolean; output: string }> },
        "sendReloadSignal",
        async () => ({ success: false, output: "signal failed" })
      );
      patchSet.patch(manager, "stop", async () => ({ success: false, message: "stop failed" }));

      const result = await manager.reload();

      expect(result).toEqual({ success: false, message: "stop failed" });
    });
  });

  describe("generateComposeFile", () => {
    it("writes a host-networked compose file for CoreDNS", async () => {
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("network_mode: host");
      expect(composeContent).not.toContain("ports:");
      expect(composeContent).toContain("/etc/coredns/Corefile:ro");
      expect(composeContent).toContain("-conf");
    });
  });

  describe("private helpers", () => {
    it("returns trimmed stdout and stderr from sendReloadSignal", async () => {
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
            handlers["stdout:data"]?.(Buffer.from("dns-stdout"));
            handlers["stderr:data"]?.(Buffer.from("dns-stderr"));
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
          sendReloadSignal: () => Promise<{ success: boolean; output: string }>;
        }
      ).sendReloadSignal();

      expect(result).toEqual({
        success: true,
        output: "dns-stdout\ndns-stderr",
      });
    });

    it("returns spawn errors from sendReloadSignal", async () => {
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
          sendReloadSignal: () => Promise<{ success: boolean; output: string }>;
        }
      ).sendReloadSignal();

      expect(result).toEqual({
        success: false,
        output: "spawn boom",
      });
    });
  });
});
