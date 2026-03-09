/**
 * Lifecycle manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { LifecycleManager } from "../../src/core/lifecycle/manager.js";
import { mkdtemp, rm, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { docker } from "../../src/services/docker/client.js";
import { catalog } from "../../src/core/catalog/loader.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("LifecycleManager", () => {
  let tempDir: string;
  let manager: LifecycleManager;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-lifecycle-test-"));
    manager = new LifecycleManager(join(tempDir, "config"));
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create required base directories", async () => {
      await manager.initialize();

      const dataDir = join(tempDir, "data");
      const caddyDir = join(tempDir, "caddy-data");
      const dnsDir = join(tempDir, "coredns-config");

      const dataExists = await access(dataDir)
        .then(() => true)
        .catch(() => false);
      const caddyExists = await access(caddyDir)
        .then(() => true)
        .catch(() => false);
      const dnsExists = await access(dnsDir)
        .then(() => true)
        .catch(() => false);

      expect(dataExists).toBe(true);
      expect(caddyExists).toBe(true);
      expect(dnsExists).toBe(true);
    });
  });

  describe("getService", () => {
    it("should return null for unknown service", async () => {
      const service = await manager.getService("nonexistent-service");
      expect(service).toBeNull();
    });

    it("should report disabled services without container details", async () => {
      patchSet.patch(
        catalog,
        "get",
        async () =>
          ({
            name: "whoami",
            category: "development",
          }) as never
      );
      patchSet.patch(
        manager as unknown as { configManager: { loadService: (name: string) => Promise<unknown> } },
        "configManager",
        {
          ...((manager as unknown as { configManager: unknown }).configManager as object),
          loadService: async () => ({ enabled: false }),
        } as never
      );

      const service = await manager.getService("whoami");

      expect(service?.state).toBe("disabled");
      expect(service?.containerStatus).toBeNull();
    });

    it("should include container status for enabled but stopped services", async () => {
      patchSet.patch(
        catalog,
        "get",
        async () =>
          ({
            name: "whoami",
            category: "development",
          }) as never
      );
      patchSet.patch(
        (manager as unknown as { configManager: { loadService: (name: string) => Promise<unknown> } }).configManager,
        "loadService",
        async () => ({ enabled: true })
      );
      patchSet.patch(
        docker,
        "getContainer",
        async () =>
          ({
            id: "1234567890abcdef",
            state: "exited",
            health: "unhealthy",
            uptime: 42,
          }) as never
      );

      const service = await manager.getService("whoami");

      expect(service?.state).toBe("stopped");
      expect(service?.containerStatus).toEqual({
        id: "1234567890abcdef",
        state: "exited",
        health: "unhealthy",
        uptime: 42,
      });
    });
  });

  describe("listAll", () => {
    it("should list available catalog services", async () => {
      const services = await manager.listAll();
      expect(services.length).toBeGreaterThan(0);
      expect(services.some((s) => s.name === "whoami")).toBe(true);
      expect(services.some((s) => s.name === "openspeedtest")).toBe(true);
      expect(services.some((s) => s.name === "webtop")).toBe(true);
    });
  });

  describe("enable", () => {
    it("should fail for service not in catalog", async () => {
      const result = await manager.enable("nonexistent-service", { autoStart: false });
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found in catalog");
    });

    it("should enable known service without autostart", async () => {
      await manager.initialize();
      const result = await manager.enable("whoami", { autoStart: false });
      expect(result.success).toBe(true);
      expect(result.message).toContain("enabled");
    });
  });

  describe("disable", () => {
    it("should fail for service that is not enabled", async () => {
      const result = await manager.disable("nonexistent-service");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not enabled");
    });

    it("should disable an enabled service with data preserved", async () => {
      await manager.initialize();
      await manager.enable("whoami", { autoStart: false });
      patchSet.patch(manager, "stop", async () => ({
        success: true,
        message: "stopped",
      }));

      const result = await manager.disable("whoami");
      expect(result.success).toBe(true);
      expect(result.message).toContain("data preserved");
    });

    it("should disable with removeData and report data removed", async () => {
      await manager.initialize();
      await manager.enable("whoami", { autoStart: false });
      patchSet.patch(manager, "stop", async () => ({
        success: true,
        message: "stopped",
      }));

      const result = await manager.disable("whoami", { removeData: true });
      expect(result.success).toBe(true);
      expect(result.message).toContain("data removed");
    });
  });

  describe("start", () => {
    it("should create the Docker network before starting when it does not exist", async () => {
      let createNetworkCalled = false;

      patchSet.patch(docker, "networkExists", async () => false);
      patchSet.patch(docker, "createNetwork", async () => {
        createNetworkCalled = true;
        return undefined;
      });
      (
        manager as unknown as {
          composeManager: { up: (name: string) => Promise<{ success: boolean; output: string }> };
        }
      ).composeManager = {
        up: async (name: string) => ({ success: true, output: `started ${name}` }),
      };

      const result = await manager.start("whoami");

      expect(createNetworkCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.message).toContain("started");
    });

    it("should fail when Docker network creation fails", async () => {
      patchSet.patch(docker, "networkExists", async () => false);
      patchSet.patch(docker, "createNetwork", async () => {
        throw new Error("network boom");
      });

      const result = await manager.start("whoami");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to create Docker network");
      expect(result.message).toContain("network boom");
    });
  });

  describe("stop", () => {
    it("should report compose shutdown failures", async () => {
      (
        manager as unknown as {
          composeManager: { down: (name: string) => Promise<{ success: boolean; output: string }> };
        }
      ).composeManager = {
        down: async () => ({ success: false, output: "down failed" }),
      };

      const result = await manager.stop("whoami");

      expect(result.success).toBe(false);
      expect(result.message).toContain("down failed");
    });
  });

  describe("restart", () => {
    it("should return early when stop fails", async () => {
      let startCalled = false;

      patchSet.patch(manager, "stop", async () => ({ success: false, message: "stop failed" }));
      patchSet.patch(manager, "start", async () => {
        startCalled = true;
        return { success: true, message: "started" };
      });

      const result = await manager.restart("whoami");

      expect(result.success).toBe(false);
      expect(result.message).toContain("stop failed");
      expect(startCalled).toBe(false);
    });
  });

  describe("update", () => {
    it("should fail when pulling the latest image fails", async () => {
      (
        manager as unknown as {
          composeManager: { pull: (name: string) => Promise<{ success: boolean; output: string }> };
        }
      ).composeManager = {
        pull: async () => ({ success: false, output: "pull failed" }),
      };

      const result = await manager.update("whoami");

      expect(result.success).toBe(false);
      expect(result.message).toContain("pull failed");
    });

    it("should restart the service after a successful pull", async () => {
      let stopCalled = false;
      let startCalled = false;

      (
        manager as unknown as {
          composeManager: { pull: (name: string) => Promise<{ success: boolean; output: string }> };
        }
      ).composeManager = {
        pull: async () => ({ success: true, output: "pulled" }),
      };
      patchSet.patch(manager, "stop", async () => {
        stopCalled = true;
        return { success: true, message: "stopped" };
      });
      patchSet.patch(manager, "start", async () => {
        startCalled = true;
        return { success: true, message: "started" };
      });

      const result = await manager.update("whoami");

      expect(result.success).toBe(true);
      expect(result.message).toContain("started");
      expect(stopCalled).toBe(true);
      expect(startCalled).toBe(true);
    });
  });

  describe("logs", () => {
    it("should proxy log requests to the compose manager", async () => {
      let receivedOptions: { tail?: number; follow?: boolean } | undefined;

      (
        manager as unknown as {
          composeManager: {
            logs: (
              name: string,
              options: { tail?: number; follow?: boolean }
            ) => Promise<{ success: boolean; output: string }>;
          };
        }
      ).composeManager = {
        logs: async (_name, options) => {
          receivedOptions = options;
          return { success: true, output: "captured logs" };
        },
      };

      const result = await manager.logs("whoami", { tail: 25, follow: true });

      expect(result.success).toBe(true);
      expect(result.output).toBe("captured logs");
      expect(receivedOptions).toEqual({ tail: 25, follow: true });
    });
  });

  describe("private helpers", () => {
    it("should register only tuition hostname in static hosts (services handled by Joyride labels)", async () => {
      patchSet.patch(
        (manager as unknown as { configManager: Record<string, unknown> }).configManager,
        "loadServices" as keyof Record<string, unknown>,
        (async () => ({
          webtop: { enabled: true },
          whoami: { enabled: true },
          disabled: { enabled: false },
        })) as never
      );
      patchSet.patch(
        (manager as unknown as { configManager: Record<string, unknown> }).configManager,
        "loadGlobal" as keyof Record<string, unknown>,
        (async () => ({
          hostname: "nxs-svc-dev",
          domain: "nexus-central.tech",
          upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
        })) as never
      );
      patchSet.patch(catalog, "get", async (name: string) => {
        if (name === "webtop") {
          return {
            name: "webtop",
            category: "remote-access",
            labels: { caddy: "webtop.${DOMAIN}" },
          } as never;
        }

        if (name === "whoami") {
          return {
            name: "whoami",
            category: "development",
            labels: { caddy: "whoami.${DOMAIN}" },
          } as never;
        }

        return undefined;
      });
      patchSet.patch(
        manager as unknown as { detectHostIp: () => string | null },
        "detectHostIp",
        (() => "172.30.20.50") as never
      );

      let capturedStaticHosts: Record<string, string> | undefined;

      patchSet.patch(
        (manager as unknown as { dnsManager: Record<string, unknown> }).dnsManager,
        "generateConfig" as keyof Record<string, unknown>,
        (async (services: unknown[], staticHosts: Record<string, string>) => {
          capturedStaticHosts = staticHosts;
          return "corefile";
        }) as never
      );
      patchSet.patch(
        (manager as unknown as { dnsManager: Record<string, unknown> }).dnsManager,
        "reload" as keyof Record<string, unknown>,
        (async () => ({ success: true, message: "reloaded" })) as never
      );

      await (
        manager as unknown as {
          updateDnsConfig: () => Promise<void>;
        }
      ).updateDnsConfig();

      // Only tuition hostname — service subdomains handled by Joyride via coredns.host.name labels
      expect(capturedStaticHosts).toEqual({
        "nxs-svc-dev.nexus-central.tech": "172.30.20.50",
      });
    });

    it("should create only relative service directories and expand MEDIA_PATH", async () => {
      await (
        manager as unknown as {
          createServiceDirectories: (
            name: string,
            definition: {
              volumes: Array<{ host: string }>;
            }
          ) => Promise<void>;
        }
      ).createServiceDirectories("whoami", {
        volumes: [
          { host: "./data/whoami/config" },
          { host: "${MEDIA_PATH}/library" },
          { host: "/var/run/docker.sock" },
        ],
      });

      const tuitionDir = (
        manager as unknown as { configManager: { getTuitionDir: () => string } }
      ).configManager.getTuitionDir();
      const relativeDirExists = await access(join(tuitionDir, "data", "whoami", "config"))
        .then(() => true)
        .catch(() => false);
      const mediaDirExists = await access(join(tuitionDir, "data", "media", "library"))
        .then(() => true)
        .catch(() => false);
      const absoluteDirCreated = await access(join(tuitionDir, "var", "run", "docker.sock"))
        .then(() => true)
        .catch(() => false);

      expect(relativeDirExists).toBe(true);
      expect(mediaDirExists).toBe(true);
      expect(absoluteDirCreated).toBe(false);
    });
  });
});
