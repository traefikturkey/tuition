/**
 * Config command behavior tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ConfigCommand } from "../../src/cli/commands/config.js";
import { ConfigManager } from "../../src/core/config/manager.js";

describe("ConfigCommand behavior", () => {
  let captured: string[];
  let originalLog: typeof console.log;

  const originalExists = ConfigManager.prototype.exists;
  const originalLoad = ConfigManager.prototype.load;
  const originalLoadGlobal = ConfigManager.prototype.loadGlobal;
  const originalSaveGlobal = ConfigManager.prototype.saveGlobal;

  beforeEach(() => {
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    ConfigManager.prototype.exists = originalExists;
    ConfigManager.prototype.load = originalLoad;
    ConfigManager.prototype.loadGlobal = originalLoadGlobal;
    ConfigManager.prototype.saveGlobal = originalSaveGlobal;
  });

  afterEach(() => {
    console.log = originalLog;

    ConfigManager.prototype.exists = originalExists;
    ConfigManager.prototype.load = originalLoad;
    ConfigManager.prototype.loadGlobal = originalLoadGlobal;
    ConfigManager.prototype.saveGlobal = originalSaveGlobal;
  });

  it("shows not initialized message for show command", async () => {
    ConfigManager.prototype.exists = async () => false;

    const command = new ConfigCommand();
    await command.show({});

    const output = captured.join("\n");
    expect(output).toContain("Tuition is not initialized");
  });

  it("redacts sensitive values in show output", async () => {
    ConfigManager.prototype.exists = async () => true;
    ConfigManager.prototype.load = async () => ({
      global: {
        hostname: "test-host",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "top-secret",
        adminPasswordHash: "$2b$10$hash",
        upstreamDns: {
          primary: "1.1.1.1",
          backup: "1.0.0.1",
        },
      },
      infrastructure: {},
      services: {
        demo: {
          enabled: true,
          imageTag: "latest",
          environment: {
            apiToken: "token-123",
          },
        },
      },
    });

    const command = new ConfigCommand();
    await command.show({});

    const output = captured.join("\n");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("top-secret");
    expect(output).not.toContain("token-123");
  });

  it("shows only the global section when infrastructure and services are empty", async () => {
    ConfigManager.prototype.exists = async () => true;
    ConfigManager.prototype.load = async () => ({
      global: {
        hostname: "test-host",
        domain: "example.com",
      },
      infrastructure: undefined,
      services: {},
    } as never);

    const command = new ConfigCommand();
    await command.show({});

    const output = captured.join("\n");
    expect(output).toContain("Global Configuration:");
    expect(output).not.toContain("Infrastructure Configuration:");
    expect(output).not.toContain("Service Configurations:");
  });

  it("shows infrastructure and multiple service configurations when present", async () => {
    ConfigManager.prototype.exists = async () => true;
    ConfigManager.prototype.load = async () => ({
      global: {
        hostname: "test-host",
        domain: "example.com",
      },
      infrastructure: {
        reverseProxy: "caddy",
      },
      services: {
        whoami: {
          enabled: true,
        },
        redis: {
          enabled: false,
        },
      },
    } as never);

    const command = new ConfigCommand();
    await command.show({});

    const output = captured.join("\n");
    expect(output).toContain("Infrastructure Configuration:");
    expect(output).toContain("Service Configurations:");
    expect(output).toContain("whoami:");
    expect(output).toContain("redis:");
  });

  it("prints invalid key format for malformed set key", async () => {
    ConfigManager.prototype.exists = async () => true;

    const command = new ConfigCommand();
    await command.set("global", "value", {});

    const output = captured.join("\n");
    expect(output).toContain("Invalid key format");
  });

  it("prints not initialized when set is called before init", async () => {
    ConfigManager.prototype.exists = async () => false;

    const command = new ConfigCommand();
    await command.set("global.domain", "example.com", {});

    expect(captured.join("\n")).toContain("Tuition is not initialized");
  });

  it("sets global boolean and saves config", async () => {
    ConfigManager.prototype.exists = async () => true;

    const globalConfig = {
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      cloudflareToken: "token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    };

    let saved: unknown;

    ConfigManager.prototype.loadGlobal = async () => ({ ...globalConfig });
    ConfigManager.prototype.saveGlobal = async (config) => {
      saved = config;
    };

    const command = new ConfigCommand();
    await command.set("global.puid", "2000", {});

    expect((saved as { puid: number }).puid).toBe(2000);
    expect(captured.join("\n")).toContain("Set global.puid = 2000");
  });

  it("sets global boolean false values and preserves plain strings", async () => {
    ConfigManager.prototype.exists = async () => true;

    const globalConfig = {
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      cloudflareToken: "token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    };

    const saves: unknown[] = [];

    ConfigManager.prototype.loadGlobal = async () => ({ ...globalConfig });
    ConfigManager.prototype.saveGlobal = async (config) => {
      saves.push(config);
    };

    const command = new ConfigCommand();
    await command.set("global.puid", "false", {});
    await command.set("global.domain", "example.internal", {});

    expect((saves[0] as { puid: boolean }).puid).toBe(false);
    expect((saves[1] as { domain: string }).domain).toBe("example.internal");
  });

  it("sets global true values as booleans", async () => {
    ConfigManager.prototype.exists = async () => true;

    ConfigManager.prototype.loadGlobal = async () => ({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      cloudflareToken: "token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    let saved: unknown;
    ConfigManager.prototype.saveGlobal = async (config) => {
      saved = config;
    };

    const command = new ConfigCommand();
    await command.set("global.puid", "true", {});

    expect((saved as { puid: boolean }).puid).toBe(true);
    expect(captured.join("\n")).toContain("Set global.puid = true");
  });

  it("prints unknown section for unsupported config section", async () => {
    ConfigManager.prototype.exists = async () => true;

    const command = new ConfigCommand();
    await command.set("services.demo.enabled", "true", {});

    const output = captured.join("\n");
    expect(output).toContain("Unknown configuration section: services");
  });

  it("rejects unsafe global key names", async () => {
    ConfigManager.prototype.exists = async () => true;

    const command = new ConfigCommand();
    await command.set("global.__proto__", "pollute", {});

    const output = captured.join("\n");
    expect(output).toContain("Unsafe configuration key");
  });

  it("rejects nested global key paths", async () => {
    ConfigManager.prototype.exists = async () => true;

    const command = new ConfigCommand();
    await command.set("global.hostname.extra", "value", {});

    const output = captured.join("\n");
    expect(output).toContain("Invalid key format");
  });

  it("prints failures thrown while saving configuration", async () => {
    ConfigManager.prototype.exists = async () => true;
    ConfigManager.prototype.loadGlobal = async () => ({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      cloudflareToken: "token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });
    ConfigManager.prototype.saveGlobal = async () => {
      throw new Error("save boom");
    };

    const command = new ConfigCommand();
    await command.set("global.domain", "example.org", {});

    expect(captured.join("\n")).toContain("Failed to set configuration");
  });
});
