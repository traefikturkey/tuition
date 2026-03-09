/**
 * CoreDNS manager tests (Joyride-based)
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { CoreDnsManager } from "../../src/services/dns/coredns.js";
import { mkdtemp, rm, readFile, access, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { ServiceDefinition, DnsClusterConfig } from "../../src/types/index.js";
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
    it("should generate Corefile with docker-cluster block", async () => {
      await manager.initialize();

      const corefile = await manager.generateConfig([]);

      expect(corefile).toContain("# Tuition DNS Configuration (Joyride)");
      expect(corefile).toContain("bind 0.0.0.0");
      expect(corefile).toContain("docker-cluster {");
      expect(corefile).toContain("cache 30");
      expect(corefile).not.toContain("forward");
    });

    it("should include static hosts file reference in Corefile", async () => {
      await manager.initialize();

      const corefile = await manager.generateConfig([]);

      expect(corefile).toContain("hosts /etc/hosts.d/hosts");
      expect(corefile).toContain("fallthrough");
    });

    it("should generate hosts file with only static entries", async () => {
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

    it("should not include service dns.hostname entries in hosts file", async () => {
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

      // Joyride handles Docker services via labels — no hosts file entries
      expect(hostsContent).not.toContain("dns.internal");
    });

    it("should not include forward plugin (split DNS via drop)", async () => {
      await manager.initialize();

      const corefile = await manager.generateConfig([]);

      expect(corefile).not.toContain("forward");
      expect(corefile).not.toContain("8.8.8.8");
    });
  });

  describe("status", () => {
    it("should return hosts count from file", async () => {
      await manager.initialize();

      const hostsContent = `10.0.0.1 test1.example.com
10.0.0.2 test2.example.com
# This is a comment
`;
      await writeFile(join(tempDir, "coredns-config", "hosts"), hostsContent, "utf-8");

      const status = await manager.status();
      expect(status.hosts).toBe(2);
    });

    it("should return zero hosts when no hosts file exists", async () => {
      await manager.initialize();

      const status = await manager.status();
      expect(status.hosts).toBe(0);
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
        image: "ghcr.io/traefikturkey/joyride:coredns",
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
    it("writes a host-networked compose file with Joyride image", async () => {
      await manager.initialize();
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("ghcr.io/traefikturkey/joyride:coredns");
      expect(composeContent).toContain("network_mode: host");
      expect(composeContent).not.toContain("ports:");
    });

    it("mounts the Docker socket for container label discovery", async () => {
      await manager.initialize();
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("/var/run/docker.sock:/var/run/docker.sock:ro");
    });

    it("mounts Corefile and static hosts directory", async () => {
      await manager.initialize();
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("/Corefile:/etc/coredns/Corefile:ro");
      expect(composeContent).toContain("/hosts:/etc/hosts.d/hosts:ro");
    });

    it("includes Joyride environment variables", async () => {
      await manager.initialize();
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("DNS_UNKNOWN_ACTION");
      expect(composeContent).toContain("drop");
      expect(composeContent).toContain("DOCKER_SOCKET");
    });

    it("disables clustering by default", async () => {
      await manager.initialize();
      await (manager as unknown as { generateComposeFile: () => Promise<void> }).generateComposeFile();

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("CLUSTER_ENABLED");
      expect(composeContent).toContain("false");
    });

    it("enables clustering when dnsCluster config is provided", async () => {
      await manager.initialize();
      const clusterConfig: DnsClusterConfig = {
        enabled: true,
        nodeName: "node-1",
        clusterSecret: "mysecret",
        clusterSeeds: ["10.0.0.2", "10.0.0.3"],
      };

      await (
        manager as unknown as {
          generateComposeFile: (dnsCluster?: DnsClusterConfig) => Promise<void>;
        }
      ).generateComposeFile(clusterConfig);

      const composeContent = await readFile(join(tempDir, "coredns.docker-compose.yaml"), "utf-8");

      expect(composeContent).toContain("CLUSTER_ENABLED");
      expect(composeContent).toContain("\"true\"");
      expect(composeContent).toContain("NODE_NAME");
      expect(composeContent).toContain("node-1");
      expect(composeContent).toContain("CLUSTER_SECRET");
      expect(composeContent).toContain("mysecret");
      expect(composeContent).toContain("CLUSTER_SEEDS");
      expect(composeContent).toContain("10.0.0.2,10.0.0.3");
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
