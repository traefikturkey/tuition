/**
 * Integration test for multi-command CLI flow
 * Tests initialize → configure → validate sequence in isolation
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { stringify as stringifyYaml } from "yaml";
import { ConfigManager } from "../../src/core/config/manager.js";
import { ConfigValidator } from "../../src/core/config/validator.js";
import { ValidateCommand } from "../../src/cli/commands/validate.js";
import { ConfigCommand } from "../../src/cli/commands/config.js";
import { BackupCommand } from "../../src/cli/commands/backup.js";
import { ServiceCommand } from "../../src/cli/commands/service.js";
import { CaddyCommand } from "../../src/cli/commands/caddy.js";
import { DnsCommand } from "../../src/cli/commands/dns.js";
import { catalog } from "../../src/core/catalog/loader.js";
import { LifecycleManager } from "../../src/core/lifecycle/manager.js";
import { CaddyManager } from "../../src/services/caddy/manager.js";
import { CoreDnsManager } from "../../src/services/dns/coredns.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("Multi-command flow integration", () => {
  let tempDir: string;
  let configPath: string;
  let manager: ConfigManager;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-flow-test-"));
    configPath = join(tempDir, "config");
    manager = new ConfigManager(configPath);
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("initialize → save config → load → validate round-trip", async () => {
    // Step 1: Initialize (creates directories)
    await manager.initialize();

    // Step 2: Save global config
    const globalConfig = {
      hostname: "homelab",
      domain: "home.example.com",
      timezone: "America/New_York",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      cloudflareToken: "cf-token-abc123",
      upstreamDns: { primary: "1.1.1.1", backup: "8.8.8.8" },
    };
    await manager.saveGlobal(globalConfig);

    // Step 3: Load config back
    const loaded = await manager.load();
    expect(loaded.global.hostname).toBe("homelab");
    expect(loaded.global.domain).toBe("home.example.com");
    expect(loaded.global.adminEmail).toBe("admin@example.com");

    // Step 4: Validate the config
    const validator = new ConfigValidator();
    const result = validator.validateGlobal(loaded.global);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("save service config → load services → verify merged state", async () => {
    await manager.initialize();

    // Save global config first
    await manager.saveGlobal({
      hostname: "test",
      domain: "test.local",
      timezone: "UTC",
      adminEmail: "admin@test.local",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      upstreamDns: { primary: "1.1.1.1" },
    });

    // Save two service configs
    await manager.saveService("whoami", {
      enabled: true,
      imageTag: "latest",
      environment: { DEBUG: "true" },
    });

    await manager.saveService("nginx", {
      enabled: false,
      imageTag: "alpine",
    });

    // Load full config
    const full = await manager.load();
    expect(Object.keys(full.services)).toHaveLength(2);
    expect(full.services["whoami"]?.enabled).toBe(true);
    expect(full.services["nginx"]?.enabled).toBe(false);

    // Verify individual load still works
    const whoami = await manager.loadService("whoami");
    expect(whoami?.environment?.DEBUG).toBe("true");
  });

  it("validate rejects incomplete global config", async () => {
    await manager.initialize();

    // Save an incomplete config (missing required fields)
    const incompletePath = join(configPath, "global.yaml");
    await writeFile(incompletePath, stringifyYaml({ hostname: "x" }));

    const loaded = await manager.load();
    const validator = new ConfigValidator();
    const result = validator.validateGlobal(loaded.global);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("config modification persists across reload", async () => {
    await manager.initialize();

    const config = {
      hostname: "host1",
      domain: "home.local",
      timezone: "UTC",
      adminEmail: "a@b.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      upstreamDns: { primary: "1.1.1.1" },
    };

    await manager.saveGlobal(config);

    // Reload in a new manager instance
    const manager2 = new ConfigManager(configPath);
    const reloaded = await manager2.loadGlobal();

    expect(reloaded.hostname).toBe("host1");
    expect(reloaded.domain).toBe("home.local");
  });

  it("config set persists command-driven changes across reload", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "host1",
      domain: "home.local",
      timezone: "UTC",
      adminEmail: "a@b.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare" as const,
      upstreamDns: { primary: "1.1.1.1" },
    });

    const configCommand = new ConfigCommand();
    await configCommand.set("global.domain", "example.internal", { path: configPath });
    await configCommand.set("global.pgid", "2000", { path: configPath });

    const manager2 = new ConfigManager(configPath);
    const reloaded = await manager2.loadGlobal();

    expect(reloaded.domain).toBe("example.internal");
    expect(reloaded.pgid).toBe(2000);
  });

  it("validate then config show reflects the same saved configuration", async () => {
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

    const validate = new ValidateCommand();
    const show = new ConfigCommand();
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    try {
      const valid = await validate.execute({ path: configPath });
      await show.show({ path: configPath });

      const output = captured.join("\n");
      expect(valid).toBe(true);
      expect(output).toContain("All configurations are valid");
      expect(output).toContain("homelab");
      expect(output).toContain("example.com");
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("super-secret-token");
    } finally {
      console.log = originalLog;
    }
  });

  it("backup create -> list -> restore dry run works against the same initialized config", async () => {
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

    const command = new BackupCommand(configPath);
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    try {
      await command.create({ noCompression: true });

      const backupDir = join(tempDir, "backups");
      const backups = await readdir(backupDir);
      expect(backups.some((name) => name.endsWith(".tar"))).toBe(true);

      await command.list({ path: configPath });
      await command.restore("1", { dryRun: true, force: true, path: configPath });

      const output = captured.join("\n");
      expect(output).toContain("Creating backup...");
      expect(output).toContain("Available Backups:");
      expect(output).toContain("Performing dry run...");
      expect(output).toContain("Dry run: Backup from");
      expect(output).toContain("config");
    } finally {
      console.log = originalLog;
    }
  });

  it("backup restore surfaces manager extraction failures", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "backup-host",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      upstreamDns: { primary: "1.1.1.1" },
    });

    const backupDir = join(tempDir, "backups");
    await mkdir(backupDir, { recursive: true });
    await writeFile(join(backupDir, "broken.tar"), "not a tar archive", "utf-8");

    const command = new BackupCommand(configPath);
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    try {
      await command.restore("broken.tar", { dryRun: true, force: true, path: configPath });

      const output = captured.join("\n");
      expect(output).toContain("Performing dry run...");
      expect(output).toContain("Failed to restore backup:");
    } finally {
      console.log = originalLog;
    }
  });

  it("service enable then caddy and dns regenerate reuse the saved enabled services", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "homelab",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "token-123",
      upstreamDns: { primary: "1.1.1.1", backup: "1.0.0.1" },
    });

    patchSet.patch(catalog, "get", async (name: string) => {
      if (name !== "whoami") {
        return null as never;
      }

      return {
        name,
        category: "development",
        description: "HTTP echo service",
        image: "traefik/whoami:latest",
        labels: {
          caddy: "whoami.${DOMAIN}",
          "caddy.reverse_proxy": "{{upstreams 80}}",
          "dns.hostname": "whoami.internal",
        },
      } as never;
    });

    patchSet.patch(
      LifecycleManager.prototype as unknown as {
        updateCaddyConfig: () => Promise<void>;
        updateDnsConfig: () => Promise<void>;
      },
      "updateCaddyConfig",
      async () => undefined
    );
    patchSet.patch(
      LifecycleManager.prototype as unknown as {
        updateCaddyConfig: () => Promise<void>;
        updateDnsConfig: () => Promise<void>;
      },
      "updateDnsConfig",
      async () => undefined
    );

    let caddyServices: Array<{ name: string }> | undefined;
    let dnsServices: Array<{ name: string }> | undefined;

    patchSet.patch(CaddyManager.prototype, "initialize", async () => undefined);
    patchSet.patch(CaddyManager.prototype, "generateConfig", async (_config, services) => {
      caddyServices = services as Array<{ name: string }>;
      return "generated";
    });
    patchSet.patch(CaddyManager.prototype, "reload", async () => ({
      success: true,
      message: "reloaded",
    }));

    patchSet.patch(CoreDnsManager.prototype, "initialize", async () => undefined);
    patchSet.patch(CoreDnsManager.prototype, "generateConfig", async (services) => {
      dnsServices = services as Array<{ name: string }>;
      return "generated";
    });
    patchSet.patch(CoreDnsManager.prototype, "reload", async () => ({
      success: true,
      message: "reloaded",
    }));

    const service = new ServiceCommand(configPath);
    const caddy = new CaddyCommand(configPath);
    const dns = new DnsCommand(configPath);
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    try {
      await service.enable("whoami", { path: configPath, noStart: true });
      await caddy.regenerate({ path: configPath });
      await dns.regenerate({ path: configPath });

      const savedService = await manager.loadService("whoami");
      const output = captured.join("\n");

      expect(savedService?.enabled).toBe(true);
      expect(caddyServices?.map((entry) => entry.name)).toEqual(["whoami"]);
      expect(dnsServices?.map((entry) => entry.name)).toEqual(["whoami"]);
      expect(output).toContain("Service 'whoami' enabled");
      expect(output).toContain("Caddyfile regenerated and applied");
      expect(output).toContain("CoreDNS config regenerated and reloaded");
    } finally {
      console.log = originalLog;
    }
  });

  it("caddy and dns regenerate surface reload failures from their managers", async () => {
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "homelab",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      upstreamDns: { primary: "1.1.1.1" },
    });
    await manager.saveService("whoami", {
      enabled: true,
      imageTag: "latest",
    });

    patchSet.patch(
      catalog,
      "get",
      async (name: string) =>
        ({
          name,
          category: "development",
          description: "HTTP echo service",
          image: "traefik/whoami:latest",
          labels: {
            caddy: `${name}.${"${DOMAIN}"}`,
          },
        }) as never
    );

    patchSet.patch(CaddyManager.prototype, "initialize", async () => undefined);
    patchSet.patch(CaddyManager.prototype, "generateConfig", async () => "generated");
    patchSet.patch(CaddyManager.prototype, "reload", async () => ({
      success: false,
      message: "caddy reload failed",
    }));

    patchSet.patch(CoreDnsManager.prototype, "initialize", async () => undefined);
    patchSet.patch(CoreDnsManager.prototype, "generateConfig", async () => "generated");
    patchSet.patch(CoreDnsManager.prototype, "reload", async () => ({
      success: false,
      message: "dns reload failed",
    }));

    const caddy = new CaddyCommand(configPath);
    const dns = new DnsCommand(configPath);
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    try {
      await caddy.regenerate({ path: configPath });
      await dns.regenerate({ path: configPath });

      const output = captured.join("\n");
      expect(output).toContain("Failed to apply changes: caddy reload failed");
      expect(output).toContain("Failed to reload: dns reload failed");
    } finally {
      console.log = originalLog;
    }
  });
});
