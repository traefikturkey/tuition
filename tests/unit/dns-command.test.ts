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

  it("passes upstream DNS config to generator on start", async () => {
    let receivedUpstreamDns: { primary: string; backup?: string } | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{
          upstreamDns: {
            primary: string;
            backup?: string;
          };
        }>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        start: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadServices: async () => ({}),
      loadGlobal: async () => ({
        upstreamDns: {
          primary: "1.1.1.1",
          backup: "1.0.0.1",
        },
      }),
    };
    commandMock.dns = {
      generateConfig: async (_enabledServices, _staticHosts, upstreamDns) => {
        receivedUpstreamDns = upstreamDns;
      },
      start: async () => ({ success: true, message: "CoreDNS started successfully" }),
    };

    await command.start({});

    expect(receivedUpstreamDns?.primary).toBe("1.1.1.1");
    expect(receivedUpstreamDns?.backup).toBe("1.0.0.1");

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("CoreDNS started successfully");
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

  it("shows running status details when CoreDNS is up", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      dns: {
        status: () => Promise<{ running: boolean; hosts: number }>;
      };
    };

    commandMock.initialize = async () => undefined;
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
      dns: {
        status: () => Promise<{ running: boolean; hosts: number }>;
      };
    };

    commandMock.initialize = async () => undefined;
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
    let generateConfigArgs:
      | {
          services: unknown[];
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
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
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
      generateConfig: async (enabledServices, _staticHosts, upstreamDns) => {
        generateConfigArgs = { services: enabledServices, upstreamDns };
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
    expect(generateConfigArgs?.services).toHaveLength(1);
    expect(generateConfigArgs?.upstreamDns).toEqual({ primary: "1.1.1.1", backup: "1.0.0.1" });
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
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
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
});
