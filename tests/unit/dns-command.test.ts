/**
 * DNS command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import readline from "readline";
import { catalog } from "../../src/core/catalog/loader.js";
import { DnsCommand } from "../../src/cli/commands/dns.js";
import { captureConsoleLog, createPatchSet } from "../helpers/test-utils.js";

describe("DnsCommand", () => {
  let command: DnsCommand;
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(() => {
    consoleCapture = captureConsoleLog();
    patchSet = createPatchSet();
    command = new DnsCommand();
  });

  afterEach(() => {
    patchSet.restore();
    consoleCapture.restore();
  });

  const mockReadlineAnswers = (answers: string[]) => {
    let closed = false;
    patchSet.patch(readline, "createInterface", (() => ({
      question: (_question: string, callback: (answer: string) => void) => {
        callback(answers.shift() ?? "");
      },
      close: () => {
        closed = true;
      },
    })) as unknown as typeof readline.createInterface);

    return {
      wasClosed: () => closed,
    };
  };

  it("shows not initialized message when start is called before init", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { exists: () => Promise<boolean> };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => false,
    };

    await command.start({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Tuition is not initialized");
  });

  it("initializes the underlying CoreDNS manager", async () => {
    let initializeCalls = 0;
    (
      command as unknown as {
        dns: { initialize: () => Promise<void> };
      }
    ).dns = {
      initialize: async () => {
        initializeCalls += 1;
      },
    };

    await command.initialize();

    expect(initializeCalls).toBe(1);
  });

  it("calls generateConfig without upstream DNS on start (Joyride uses drop behavior)", async () => {
    let generateConfigCalled = false;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<Record<string, unknown>>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts?: Record<string, string>
        ) => Promise<void>;
        start: (dnsCluster?: unknown) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadServices: async () => ({}),
      loadGlobal: async () => ({}),
    };
    commandMock.dns = {
      generateConfig: async () => {
        generateConfigCalled = true;
      },
      start: async () => ({ success: true, message: "CoreDNS started successfully" }),
    };

    await command.start({});

    expect(generateConfigCalled).toBe(true);

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("CoreDNS started successfully");
  });

  it("loads enabled service definitions before starting CoreDNS", async () => {
    let generatedServices: Array<{ name: string }> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      };
      dns: {
        generateConfig: (
          enabledServices: Array<{ name: string }>,
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        start: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadServices: async () => ({
        whoami: { enabled: true },
        redis: { enabled: false },
        missing: { enabled: true },
      }),
      loadGlobal: async () => ({
        upstreamDns: {
          primary: "1.1.1.1",
        },
      }),
    };
    commandMock.dns = {
      generateConfig: async (enabledServices) => {
        generatedServices = enabledServices;
      },
      start: async () => ({ success: true, message: "CoreDNS started successfully" }),
    };
    patchSet.patch(catalog, "get", async (name: string) => {
      if (name === "whoami") {
        return {
          name,
          category: "development",
          description: "service",
          image: "test:latest",
        } as never;
      }

      return undefined;
    });

    await command.start({});

    expect(generatedServices).toEqual([
      {
        name: "whoami",
        category: "development",
        description: "service",
        image: "test:latest",
      },
    ]);
    expect(consoleCapture.output.join("\n")).toContain("Generated CoreDNS config for 1 services");
  });

  it("shows reload failure message during regenerate", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadServices: async () => ({}),
      loadGlobal: async () => ({
        upstreamDns: { primary: "8.8.8.8" },
      }),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: false, message: "reload failed" }),
    };

    await command.regenerate({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Failed to reload: reload failed");
  });

  it("shows failure output when stop fails", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      dns: {
        stop: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.dns = {
      stop: async () => ({ success: false, message: "stop failed" }),
    };

    await command.stop({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("stop failed");
  });

  it("shows success output when stop succeeds", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      dns: {
        stop: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.dns = {
      stop: async () => ({ success: true, message: "stopped cleanly" }),
    };

    await command.stop({});

    expect(consoleCapture.output.join("\n")).toContain("stopped cleanly");
  });

  it("shows running status details when CoreDNS is up", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
      };
      dns: {
        status: () => Promise<{ running: boolean; hosts: number }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({}),
    };
    commandMock.dns = {
      status: async () => ({ running: true, hosts: 5 }),
    };

    await command.status({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Running:");
    expect(output).toContain("Host entries: 5");
    expect(output).toContain("Internal DNS available on port 54");
  });

  it("omits running-only hint when CoreDNS is stopped", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
      };
      dns: {
        status: () => Promise<{ running: boolean; hosts: number }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({}),
    };
    commandMock.dns = {
      status: async () => ({ running: false, hosts: 0 }),
    };

    await command.status({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Host entries: 0");
    expect(output).not.toContain("Internal DNS available on port 54");
  });

  it("shows success output when regenerate reload succeeds", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadServices: async () => ({}),
      loadGlobal: async () => ({
        upstreamDns: { primary: "1.1.1.1" },
      }),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: true, message: "ok" }),
    };

    await command.regenerate({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("CoreDNS config regenerated and reloaded");
  });

  it("regenerate uses enabled service definitions from the catalog", async () => {
    let generatedServices: Array<{ name: string }> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      };
      dns: {
        generateConfig: (
          enabledServices: Array<{ name: string }>,
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadServices: async () => ({
        whoami: { enabled: true },
        redis: { enabled: false },
      }),
      loadGlobal: async () => ({
        upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
      }),
    };
    commandMock.dns = {
      generateConfig: async (enabledServices) => {
        generatedServices = enabledServices;
      },
      reload: async () => ({ success: true, message: "reloaded" }),
    };
    patchSet.patch(
      catalog,
      "get",
      async (name: string) =>
        ({
          name,
          category: "development",
          description: "service",
          image: "test:latest",
        }) as never
    );

    await command.regenerate({});

    expect(generatedServices).toHaveLength(1);
    expect(generatedServices?.[0]?.name).toBe("whoami");
    expect(consoleCapture.output.join("\n")).toContain("Regenerating CoreDNS config for 1 services...");
  });

  it("saves the Google preset and reloads CoreDNS", async () => {
    const interfaceMock = mockReadlineAnswers(["1"]);
    let savedConfig:
      | {
          upstreamDns?: { primary: string; backup?: string };
        }
      | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown> & { upstreamDns?: { primary: string; backup?: string } }>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts?: Record<string, string>
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
      }),
      saveGlobal: async (config) => {
        savedConfig = config as typeof savedConfig;
      },
      loadServices: async () => ({}),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: true, message: "reloaded" }),
    };

    await command.configure();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(savedConfig?.upstreamDns).toEqual({ primary: "8.8.8.8", backup: "8.8.4.4" });
  });

  it("shows not initialized message when configure is called before init", async () => {
    const commandMock = command as unknown as {
      config: { exists: () => Promise<boolean> };
    };

    commandMock.config = {
      exists: async () => false,
    };

    await command.configure();

    expect(consoleCapture.output.join("\n")).toContain("Tuition is not initialized");
  });

  it("saves a preset upstream DNS choice and reloads CoreDNS", async () => {
    const interfaceMock = mockReadlineAnswers(["2"]);
    let savedConfig:
      | {
          upstreamDns?: { primary: string; backup?: string };
        }
      | undefined;
    let generateConfigCalled = false;
    let generateConfigServices: unknown[] | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown> & { upstreamDns?: { primary: string; backup?: string } }>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts?: Record<string, string>
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: { primary: "9.9.9.9" },
      }),
      saveGlobal: async (config) => {
        savedConfig = config as typeof savedConfig;
      },
      loadServices: async () => ({
        whoami: { enabled: true },
      }),
    };
    commandMock.dns = {
      generateConfig: async (enabledServices) => {
        generateConfigCalled = true;
        generateConfigServices = enabledServices;
      },
      reload: async () => ({ success: true, message: "reloaded" }),
    };
    patchSet.patch(catalog, "get", async (name: string) => ({
      name,
      category: "development",
      description: "service",
      image: "test:latest",
    }));

    await command.configure();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(savedConfig?.upstreamDns).toEqual({ primary: "1.1.1.1", backup: "1.0.0.1" });
    expect(generateConfigCalled).toBe(true);
    expect(generateConfigServices).toHaveLength(1);
    expect(consoleCapture.output.join("\n")).toContain("Current upstream DNS: 9.9.9.9");
    expect(consoleCapture.output.join("\n")).toContain("CoreDNS reloaded with new upstream DNS");
  });

  it("retries invalid custom primary DNS and allows clearing an invalid backup", async () => {
    const interfaceMock = mockReadlineAnswers(["4", "999.999.999.999", "8.8.8.8", "invalid-backup", ""]);
    let savedConfig:
      | {
          upstreamDns?: { primary: string; backup?: string };
        }
      | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown> & { upstreamDns?: { primary: string; backup?: string } }>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts?: Record<string, string>
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
      }),
      saveGlobal: async (config) => {
        savedConfig = config as typeof savedConfig;
      },
      loadServices: async () => ({}),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: false, message: "reload failed" }),
    };

    await command.configure();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(savedConfig?.upstreamDns).toEqual({ primary: "8.8.8.8", backup: undefined });
    expect(consoleCapture.output.join("\n")).toContain("Invalid IP address. Please try again.");
    expect(consoleCapture.output.join("\n")).toContain("Failed to reload CoreDNS: reload failed");
    expect(consoleCapture.output.join("\n")).toContain("restart CoreDNS manually");
  });

  it("start loads dnsCluster from global config and passes to dns.start", async () => {
    let receivedCluster: unknown;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{
          dnsCluster?: {
            enabled: boolean;
            nodeName?: string;
            clusterSecret?: string;
            clusterSeeds?: string[];
          };
        }>;
      };
      dns: {
        generateConfig: (enabledServices: unknown[]) => Promise<void>;
        start: (dnsCluster?: unknown) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadServices: async () => ({}),
      loadGlobal: async () => ({
        dnsCluster: {
          enabled: true,
          nodeName: "my-node",
          clusterSeeds: ["10.0.0.2"],
        },
      }),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      start: async (dnsCluster) => {
        receivedCluster = dnsCluster;
        return { success: true, message: "CoreDNS started successfully" };
      },
    };

    await command.start({});

    expect(receivedCluster).toEqual({
      enabled: true,
      nodeName: "my-node",
      clusterSeeds: ["10.0.0.2"],
    });
    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Clustering enabled");
    expect(output).toContain("my-node");
  });

  it("start passes undefined cluster config when not configured", async () => {
    let receivedCluster: unknown = "sentinel";

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<Record<string, unknown>>;
      };
      dns: {
        generateConfig: (enabledServices: unknown[]) => Promise<void>;
        start: (dnsCluster?: unknown) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadServices: async () => ({}),
      loadGlobal: async () => ({}),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      start: async (dnsCluster) => {
        receivedCluster = dnsCluster;
        return { success: true, message: "CoreDNS started successfully" };
      },
    };

    await command.start({});

    expect(receivedCluster).toBeUndefined();
    expect(consoleCapture.output.join("\n")).not.toContain("Clustering");
  });

  it("status shows cluster info when clustering is enabled", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<{
          dnsCluster?: {
            enabled: boolean;
            nodeName?: string;
            clusterSeeds?: string[];
          };
        }>;
      };
      dns: {
        status: () => Promise<{ running: boolean; hosts: number }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        dnsCluster: {
          enabled: true,
          nodeName: "test-node",
          clusterSeeds: ["10.0.0.5", "10.0.0.6"],
        },
      }),
    };
    commandMock.dns = {
      status: async () => ({ running: true, hosts: 3 }),
    };

    await command.status({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Cluster: enabled");
    expect(output).toContain("test-node");
    expect(output).toContain("10.0.0.5:7946");
    expect(output).toContain("10.0.0.6:7946");
  });

  it("status shows cluster disabled when not configured", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
      };
      dns: {
        status: () => Promise<{ running: boolean; hosts: number }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({}),
    };
    commandMock.dns = {
      status: async () => ({ running: true, hosts: 1 }),
    };

    await command.status({});

    const output = consoleCapture.output.join("\n");
    expect(output).not.toContain("Cluster:");
  });

  it("cluster command enables clustering with seeds", async () => {
    const interfaceMock = mockReadlineAnswers(["y", "my-node", "shared-secret", "10.0.0.2,10.0.0.3"]);
    let savedConfig: Record<string, unknown> | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: { primary: "1.1.1.1" },
      }),
      saveGlobal: async (config) => {
        savedConfig = config;
      },
    };

    await command.cluster();

    expect(interfaceMock.wasClosed()).toBe(true);
    const cluster = (savedConfig as Record<string, unknown>)?.dnsCluster as {
      enabled: boolean;
      nodeName: string;
      clusterSecret: string;
      clusterSeeds: string[];
    };
    expect(cluster.enabled).toBe(true);
    expect(cluster.nodeName).toBe("my-node");
    expect(cluster.clusterSecret).toBe("shared-secret");
    expect(cluster.clusterSeeds).toEqual(["10.0.0.2", "10.0.0.3"]);
    expect(consoleCapture.output.join("\n")).toContain("DNS cluster configuration saved");
  });

  it("cluster command disables clustering", async () => {
    const interfaceMock = mockReadlineAnswers(["n"]);
    let savedConfig: Record<string, unknown> | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: { primary: "1.1.1.1" },
        dnsCluster: {
          enabled: true,
          nodeName: "old-node",
          clusterSecret: "old-secret",
          clusterSeeds: ["10.0.0.99"],
        },
      }),
      saveGlobal: async (config) => {
        savedConfig = config;
      },
    };

    await command.cluster();

    expect(interfaceMock.wasClosed()).toBe(true);
    const cluster = (savedConfig as Record<string, unknown>)?.dnsCluster as {
      enabled: boolean;
    };
    expect(cluster.enabled).toBe(false);
    expect(consoleCapture.output.join("\n")).toContain("DNS cluster configuration saved");
  });

  it("cluster command shows current cluster config", async () => {
    mockReadlineAnswers(["n"]);

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: { primary: "1.1.1.1" },
        dnsCluster: {
          enabled: true,
          nodeName: "existing-node",
          clusterSeeds: ["10.0.0.5"],
        },
      }),
      saveGlobal: async () => undefined,
    };

    await command.cluster();

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Current: enabled");
    expect(output).toContain("existing-node");
  });

  it("cluster command shows not initialized message", async () => {
    const commandMock = command as unknown as {
      config: { exists: () => Promise<boolean> };
    };

    commandMock.config = {
      exists: async () => false,
    };

    await command.cluster();

    expect(consoleCapture.output.join("\n")).toContain("Tuition is not initialized");
  });

  it("cluster command uses hostname as default node name", async () => {
    const interfaceMock = mockReadlineAnswers(["y", "", "", ""]);
    let savedConfig: Record<string, unknown> | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "nxs-svc-dev",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: { primary: "1.1.1.1" },
      }),
      saveGlobal: async (config) => {
        savedConfig = config;
      },
    };

    await command.cluster();

    expect(interfaceMock.wasClosed()).toBe(true);
    const cluster = (savedConfig as Record<string, unknown>)?.dnsCluster as {
      enabled: boolean;
      nodeName: string;
      clusterSeeds: string[];
    };
    expect(cluster.enabled).toBe(true);
    expect(cluster.nodeName).toBe("nxs-svc-dev");
    expect(cluster.clusterSeeds).toEqual([]);
  });

  it("cluster command validates invalid seed IPs", async () => {
    const interfaceMock = mockReadlineAnswers(["y", "node-1", "", "999.999.999.999", "10.0.0.2"]);
    let savedConfig: Record<string, unknown> | undefined;

    const commandMock = command as unknown as {
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        hostname: "lab",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: { primary: "1.1.1.1" },
      }),
      saveGlobal: async (config) => {
        savedConfig = config;
      },
    };

    await command.cluster();

    expect(interfaceMock.wasClosed()).toBe(true);
    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Invalid IP");
    const cluster = (savedConfig as Record<string, unknown>)?.dnsCluster as {
      enabled: boolean;
      clusterSeeds: string[];
    };
    expect(cluster.clusterSeeds).toEqual(["10.0.0.2"]);
  });
});
