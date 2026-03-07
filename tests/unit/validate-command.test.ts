/**
 * Validate command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ValidateCommand } from "../../src/cli/commands/validate.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { captureConsoleLog } from "../helpers/test-utils.js";

describe("ValidateCommand", () => {
  let tempDir: string;
  let configPath: string;
  let captured: string[];
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  const originalLoadGlobal = ConfigManager.prototype.loadGlobal;
  const originalLoadInfrastructure = ConfigManager.prototype.loadInfrastructure;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-validate-command-test-"));
    configPath = join(tempDir, "config");

    consoleCapture = captureConsoleLog();
    captured = consoleCapture.output;
  });

  afterEach(async () => {
    ConfigManager.prototype.loadGlobal = originalLoadGlobal;
    ConfigManager.prototype.loadInfrastructure = originalLoadInfrastructure;
    consoleCapture.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns false when tuition is not initialized", async () => {
    const command = new ValidateCommand();

    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join("\n")).toContain("Tuition is not initialized");
  });

  it("returns true for valid global config with no services", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
        backup: "1.0.0.1",
      },
    });

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(true);
    expect(captured.join("\n")).toContain("All configurations are valid");
  });

  it("returns false for invalid global config", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "not-an-email",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "999.999.999.999",
      },
    });

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join("\n")).toContain("Global configuration has errors");
  });

  it("returns false when global configuration cannot be loaded", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    ConfigManager.prototype.loadGlobal = async () => {
      throw new Error("boom");
    };

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join("\n")).toContain("Failed to load global configuration");
  });

  it("returns false when a service config has an invalid service name", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    const servicesPath = join(configPath, "services");
    await mkdir(servicesPath, { recursive: true });
    await writeFile(join(servicesPath, "BadService.yaml"), ["enabled: true", "imageTag: latest"].join("\n"), "utf-8");

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join("\n")).toContain("BadService");
  });

  it("reports valid service configurations individually", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });
    await manager.saveService("whoami", {
      enabled: true,
      imageTag: "latest",
      environment: {
        TZ: "UTC",
      },
    });

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(true);
    expect(captured.join("\n")).toContain("Validating 1 service(s)...");
    expect(captured.join("\n")).toContain("✓ whoami");
  });

  it("reports infrastructure configuration when it can be loaded", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    ConfigManager.prototype.loadInfrastructure = async () =>
      ({
        reverseProxy: "caddy",
      }) as never;

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(true);
    expect(captured.join("\n")).toContain("Infrastructure configuration is valid");
  });

  it("treats missing infrastructure configuration as optional", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    ConfigManager.prototype.loadInfrastructure = async () => undefined as never;

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(true);
    expect(captured.join("\n")).not.toContain("Infrastructure configuration is valid");
  });

  it("returns false when infrastructure configuration cannot be loaded", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "test-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "cf-token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    ConfigManager.prototype.loadInfrastructure = async () => {
      throw new Error("infra boom");
    };

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join("\n")).toContain("Failed to load infrastructure configuration");
  });
});
