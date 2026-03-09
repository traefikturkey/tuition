/**
 * Thin CLI end-to-end smoke tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access, mkdtemp, readdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createCli } from "../../src/cli/commands/index.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { captureConsoleLog, stubProcessExit } from "../helpers/test-utils.js";

describe("CLI e2e smoke", () => {
  let tempDir: string;
  let configPath: string;
  let manager: ConfigManager;
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  let exitStub: ReturnType<typeof stubProcessExit> | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-e2e-cli-"));
    configPath = join(tempDir, "config");
    manager = new ConfigManager(configPath);
    consoleCapture = captureConsoleLog();
    exitStub = undefined;
  });

  afterEach(async () => {
    exitStub?.restore();
    consoleCapture.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("validate exits with code 1 for an uninitialized config path", async () => {
    exitStub = stubProcessExit();

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "validate", "--path", configPath]);

    expect(exitStub.lastCode()).toBe(1);
    expect(consoleCapture.output.join("\n")).toContain("Tuition is not initialized");
  });

  it("config show redacts secrets when invoked through the CLI parser", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "homelab",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "super-secret-token",
      upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
    });

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "config", "show", "--path", configPath]);

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("homelab");
    expect(output).not.toContain("super-secret-token");
  });

  it("config set persists numeric values when invoked through the CLI parser", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "homelab",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "super-secret-token",
      upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
    });

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "config", "set", "global.puid", "2001", "--path", configPath]);

    const updated = await manager.loadGlobal();
    expect(updated.puid).toBe(2001);
    expect(consoleCapture.output.join("\n")).toContain("Set global.puid = 2001");
  });

  it("backup create, list, and dry-run restore work through the CLI parser", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "backup-host",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
    });
    await manager.saveService("whoami", {
      enabled: true,
      imageTag: "latest",
    });

    let cli = createCli();
    await cli.parseAsync(["node", "tuition", "backup", "create", "--no-compression", "--path", configPath]);

    const backups = await readdir(join(tempDir, "backups"));
    expect(backups.some((name) => name.endsWith(".tar"))).toBe(true);

    cli = createCli();
    await cli.parseAsync(["node", "tuition", "backup", "list", "--path", configPath]);

    cli = createCli();
    await cli.parseAsync(["node", "tuition", "backup", "restore", "1", "--dry-run", "--force", "--path", configPath]);

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Creating backup...");
    expect(output).toContain("Available Backups:");
    expect(output).toContain("Performing dry run...");
    expect(output).toContain("Dry run: Backup from");
  });

  it("service enable saves state without starting containers when invoked through the CLI parser", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "service-host",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
    });

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "service", "enable", "whoami", "--no-start", "--path", configPath]);

    const serviceConfig = await manager.loadService("whoami");
    const composePath = join(tempDir, "whoami.docker-compose.yaml");
    const composeExists = await access(composePath)
      .then(() => true)
      .catch(() => false);

    expect(serviceConfig?.enabled).toBe(true);
    expect(composeExists).toBe(true);
    expect(consoleCapture.output.join("\n")).toContain("Enabling service 'whoami'");
  });
});
