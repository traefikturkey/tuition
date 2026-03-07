/**
 * Caddy command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { catalog } from "../../src/core/catalog/loader.js";
import { CaddyCommand } from "../../src/cli/commands/caddy.js";
import { captureConsoleLog, createPatchSet } from "../helpers/test-utils.js";

describe("CaddyCommand", () => {
  let command: CaddyCommand;
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(() => {
    consoleCapture = captureConsoleLog();
    patchSet = createPatchSet();
    command = new CaddyCommand();
  });

  afterEach(() => {
    patchSet.restore();
    consoleCapture.restore();
  });

  const setupPasswordPromptIo = () => {
    patchSet.patch(process.stdout, "write", ((_: string | Uint8Array) => true) as typeof process.stdout.write);
    patchSet.patch(process.stdin, "resume", (() => process.stdin) as typeof process.stdin.resume);
    patchSet.patch(process.stdin, "pause", (() => process.stdin) as typeof process.stdin.pause);
    patchSet.patch(process.stdin, "setRawMode", ((_: boolean) => process.stdin) as typeof process.stdin.setRawMode);
  };

  const submitPassword = async (value: string) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const character of value) {
      process.stdin.emit("data", Buffer.from(character));
    }
    process.stdin.emit("data", Buffer.from("\r"));
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

  it("initializes the underlying Caddy manager", async () => {
    let initializeCalls = 0;
    (
      command as unknown as {
        caddy: { initialize: () => Promise<void> };
      }
    ).caddy = {
      initialize: async () => {
        initializeCalls += 1;
      },
    };

    await command.initialize();

    expect(initializeCalls).toBe(1);
  });

  it("passes cloudflare token as CF_API_TOKEN when starting caddy", async () => {
    let receivedEnv: Record<string, string> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
          cloudflareToken?: string;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        start: (env: Record<string, string>) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        cloudflareToken: "token-123",
      }),
      loadServices: async () => ({}),
    };
    commandMock.caddy = {
      generateConfig: async () => undefined,
      start: async (env) => {
        receivedEnv = env;
        return { success: true, message: "Caddy started successfully" };
      },
    };

    await command.start({});

    expect(receivedEnv).toBeDefined();
    expect(receivedEnv?.CF_API_TOKEN).toBe("token-123");

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Caddy started successfully");
  });

  it("loads enabled service definitions before starting caddy", async () => {
    let generatedServices: Array<{ name: string }> | undefined;
    let receivedEnv: Record<string, string> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
          cloudflareToken?: string;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: Array<{ name: string }>) => Promise<void>;
        start: (env: Record<string, string>) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
      }),
      loadServices: async () => ({
        whoami: { enabled: true },
        redis: { enabled: false },
        missing: { enabled: true },
      }),
    };
    commandMock.caddy = {
      generateConfig: async (_config, services) => {
        generatedServices = services;
      },
      start: async (env) => {
        receivedEnv = env;
        return { success: true, message: "started" };
      },
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
    expect(receivedEnv).toEqual({
      DOMAIN: "example.com",
      HOSTNAME: "host",
      TZ: "UTC",
      PUID: "1000",
      PGID: "1000",
    });
    expect(consoleCapture.output.join("\n")).toContain("Generated Caddyfile with 1 routes");
  });

  it("shows failure output when stop fails", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      caddy: {
        stop: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.caddy = {
      stop: async () => ({ success: false, message: "failed to stop caddy" }),
    };

    await command.stop({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("failed to stop caddy");
  });

  it("passes cloudflare token as CF_API_TOKEN when restarting caddy", async () => {
    let receivedEnv: Record<string, string> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
          cloudflareToken?: string;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        restart: (env: Record<string, string>) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        cloudflareToken: "token-xyz",
      }),
      loadServices: async () => ({}),
    };
    commandMock.caddy = {
      generateConfig: async () => undefined,
      restart: async (env) => {
        receivedEnv = env;
        return { success: true, message: "restarted" };
      },
    };

    await command.restart({});

    expect(receivedEnv?.CF_API_TOKEN).toBe("token-xyz");
    expect(consoleCapture.output.join("\n")).toContain("restarted");
  });

  it("reload regenerates config using enabled service definitions", async () => {
    let generatedServices: Array<{ name: string }> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: Array<{ name: string }>) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
      }),
      loadServices: async () => ({
        whoami: { enabled: true },
        redis: { enabled: false },
      }),
    };
    commandMock.caddy = {
      generateConfig: async (_config, services) => {
        generatedServices = services;
      },
      reload: async () => ({ success: true, message: "reloaded" }),
    };
    patchSet.patch(catalog, "get", async (name: string) => ({
      name,
      category: "development",
      description: "service",
      image: "test:latest",
    }) as never);

    await command.reload({});

    expect(generatedServices).toHaveLength(1);
    expect(generatedServices?.[0]?.name).toBe("whoami");
    expect(consoleCapture.output.join("\n")).toContain("reloaded");
  });

  it("restart regenerates config using enabled service definitions", async () => {
    let generatedServices: Array<{ name: string }> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: Array<{ name: string }>) => Promise<void>;
        restart: (env: Record<string, string>) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
      }),
      loadServices: async () => ({
        whoami: { enabled: true },
        redis: { enabled: false },
      }),
    };
    commandMock.caddy = {
      generateConfig: async (_config, services) => {
        generatedServices = services;
      },
      restart: async () => ({ success: true, message: "restarted with routes" }),
    };
    patchSet.patch(catalog, "get", async (name: string) => ({
      name,
      category: "development",
      description: "service",
      image: "test:latest",
    }) as never);

    await command.restart({});

    expect(generatedServices).toHaveLength(1);
    expect(generatedServices?.[0]?.name).toBe("whoami");
    expect(consoleCapture.output.join("\n")).toContain("restarted with routes");
  });

  it("shows failure output when reload fails", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
      }),
      loadServices: async () => ({}),
    };
    commandMock.caddy = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: false, message: "reload failed" }),
    };

    await command.reload({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("reload failed");
  });

  it("shows status warning when admin password is not configured", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      caddy: {
        status: () => Promise<{ running: boolean; configValid: boolean; routes: number }>;
      };
      config: {
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
        }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.caddy = {
      status: async () => ({ running: true, configValid: true, routes: 2 }),
    };
    commandMock.config = {
      loadGlobal: async () => ({
        domain: "example.com",
        hostname: "host",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
      }),
    };

    await command.status({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("No password configured");
    expect(output).toContain("tuition caddy set-password");
  });

  it("shows the protected status when an admin password exists", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      caddy: {
        status: () => Promise<{ running: boolean; routes: number }>;
      };
      config: {
        loadGlobal: () => Promise<{
          domain: string;
          adminPasswordHash: string;
        }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.caddy = {
      status: async () => ({ running: true, routes: 3 }),
    };
    commandMock.config = {
      loadGlobal: async () => ({
        domain: "example.com",
        adminPasswordHash: "existing-hash",
      }),
    };

    await command.status({});

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("https://tuition.example.com");
    expect(output).toContain("Password protected");
  });

  it("reports regenerate success after reloading Caddy", async () => {
    let generatedServices: unknown[] | undefined;
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<Record<string, unknown>>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({ domain: "example.com" }),
      loadServices: async () => ({ whoami: { enabled: true } }),
    };
    commandMock.caddy = {
      generateConfig: async (_config, services) => {
        generatedServices = services;
      },
      reload: async () => ({ success: true, message: "ok" }),
    };
    patchSet.patch(catalog, "get", async (name: string) => ({
      name,
      category: "development",
      description: "service",
      image: "test:latest",
    }));

    await command.regenerate({});

    expect(generatedServices).toHaveLength(1);
    expect(consoleCapture.output.join("\n")).toContain("Caddyfile regenerated and applied");
  });

  it("reports regenerate failures when reload does not apply changes", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<Record<string, unknown>>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({ domain: "example.com" }),
      loadServices: async () => ({}),
    };
    commandMock.caddy = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: false, message: "reload failed" }),
    };

    await command.regenerate({});

    expect(consoleCapture.output.join("\n")).toContain("Failed to apply changes: reload failed");
  });

  it("does not save anything when set-password receives mismatched values", async () => {
    setupPasswordPromptIo();
    let saveCalled = false;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<{ domain: string }>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({ domain: "example.com" }),
      saveGlobal: async () => {
        saveCalled = true;
      },
    };

    const pending = command.setPassword({});
    await submitPassword("secret-one");
    await submitPassword("secret-two");
    await pending;

    expect(saveCalled).toBe(false);
    expect(consoleCapture.output.join("\n")).toContain("Passwords do not match");
  });

  it("rejects empty passwords during set-password", async () => {
    setupPasswordPromptIo();
    let saveCalled = false;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<{ domain: string }>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({ domain: "example.com" }),
      saveGlobal: async () => {
        saveCalled = true;
      },
    };

    const pending = command.setPassword({});
    await submitPassword("");
    await submitPassword("");
    await pending;

    expect(saveCalled).toBe(false);
    expect(consoleCapture.output.join("\n")).toContain("Password cannot be empty");
  });

  it("saves the hashed password, regenerates config, and reloads Caddy", async () => {
    let savedConfig: Record<string, unknown> | undefined;
    let generatedServices: unknown[] | undefined;
    setupPasswordPromptIo();

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({ domain: "example.com" }),
      saveGlobal: async (config) => {
        savedConfig = config;
      },
      loadServices: async () => ({ whoami: { enabled: true } }),
    };
    commandMock.caddy = {
      generateConfig: async (_config, services) => {
        generatedServices = services;
      },
      reload: async () => ({ success: true, message: "reloaded" }),
    };
    patchSet.patch(catalog, "get", async (name: string) => ({
      name,
      category: "development",
      description: "service",
      image: "test:latest",
    }));

    const pending = command.setPassword({});
    await submitPassword("secret");
    await submitPassword("secret");
    await pending;

    expect(typeof savedConfig?.adminPasswordHash).toBe("string");
    expect(String(savedConfig?.adminPasswordHash)).toContain("$2b$");
    expect(generatedServices).toHaveLength(1);
    expect(consoleCapture.output.join("\n")).toContain("Admin password updated successfully");
    expect(consoleCapture.output.join("\n")).toContain("https://tuition.example.com");
  });

  it("warns when the password is saved but Caddy reload fails", async () => {
    setupPasswordPromptIo();

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadGlobal: () => Promise<Record<string, unknown>>;
        saveGlobal: (config: Record<string, unknown>) => Promise<void>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadGlobal: async () => ({ domain: "example.com" }),
      saveGlobal: async () => undefined,
      loadServices: async () => ({}),
    };
    commandMock.caddy = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: false, message: "reload failed" }),
    };

    const pending = command.setPassword({});
    await submitPassword("secret");
    await submitPassword("secret");
    await pending;

    expect(consoleCapture.output.join("\n")).toContain("Password saved but Caddy could not reload");
    expect(consoleCapture.output.join("\n")).toContain("tuition caddy restart");
  });

  it("routes the legacy hash-password command to set-password", async () => {
    let called = false;
    patchSet.patch(
      command as unknown as { setPassword: (options: { path?: string }) => Promise<void> },
      "setPassword",
      async () => {
        called = true;
      }
    );

    await command.hashPassword({ path: "/tmp/config" });

    expect(called).toBe(true);
    expect(consoleCapture.output.join("\n")).toContain('Use "tuition caddy set-password" instead');
  });
});
