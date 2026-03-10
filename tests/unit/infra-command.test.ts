/**
 * InfraCommand unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigManager } from "../../src/core/config/manager.js";
import { InfraCommand } from "../../src/cli/commands/infra.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function captureConsole(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  return {
    lines,
    restore: () => {
      console.log = origLog;
    },
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

async function makeInitializedConfigPath(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "tuition-infra-test-"));
  const configPath = join(tempDir, "config");
  const manager = new ConfigManager(configPath);
  await manager.initialize();
  // Write a minimal global.yaml so manager.exists() returns true
  await manager.saveGlobal({
    hostname: "test-host",
    domain: "example.com",
    adminEmail: "admin@example.com",
    timezone: "UTC",
    puid: 1000,
    pgid: 1000,
    dnsProvider: "cloudflare",
    cloudflareToken: "token123",
    upstreamDns: { primary: "1.1.1.1" },
  });
  return configPath;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InfraCommand", () => {
  let configPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-infra-test-"));
    configPath = join(tempDir, "config");
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
      cloudflareToken: "token123",
      upstreamDns: { primary: "1.1.1.1" },
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ── nfsList ────────────────────────────────────────────────────────────────

  it("nfsList reports empty state when no NFS entries are configured", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsList();
    capture.restore();

    expect(capture.lines.join(" ")).toContain("No NFS shares configured");
  });

  it("nfsList lists all configured NFS entries", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      nfs: [
        { name: "media", server: "192.168.1.10", path: "/export/media", mountPoint: "" },
        { name: "backup", server: "192.168.1.20", path: "/backup", mountPoint: "" },
      ],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsList();
    capture.restore();

    const output = capture.lines.join("\n");
    expect(output).toContain("media");
    expect(output).toContain("backup");
    expect(output).toContain("192.168.1.10");
  });

  // ── nfsShow ────────────────────────────────────────────────────────────────

  it("nfsShow displays details for an existing NFS entry", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      nfs: [{ name: "media", server: "10.0.0.1", path: "/export/media", mountPoint: "", options: "rw,soft" }],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsShow("media");
    capture.restore();

    const output = capture.lines.join("\n");
    expect(output).toContain("10.0.0.1");
    expect(output).toContain("/export/media");
    expect(output).toContain("rw,soft");
  });

  it("nfsShow reports not found for an unknown name", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsShow("ghost");
    capture.restore();

    expect(capture.lines.join(" ")).toContain("not found");
  });

  // ── nfsAdd ─────────────────────────────────────────────────────────────────

  it("nfsAdd persists a valid NFS entry to infrastructure config", async () => {
    const cmd = new InfraCommand(configPath);
    await cmd.nfsAdd({ name: "media", server: "192.168.1.10", path: "/export/media" });

    const manager = new ConfigManager(configPath);
    const infra = await manager.loadInfrastructure();
    const entry = infra?.nfs?.find((n) => n.name === "media");

    expect(entry).toBeDefined();
    expect(entry?.server).toBe("192.168.1.10");
    expect(entry?.path).toBe("/export/media");
  });

  it("nfsAdd rejects a duplicate name", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      nfs: [{ name: "media", server: "10.0.0.1", path: "/old", mountPoint: "" }],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsAdd({ name: "media", server: "10.0.0.2", path: "/new" });
    capture.restore();

    expect(capture.lines.join(" ")).toContain("already exists");

    // Existing entry should be unchanged
    const infra = await manager.loadInfrastructure();
    expect(infra?.nfs?.length).toBe(1);
    expect(infra?.nfs?.[0]?.path).toBe("/old");
  });

  it("nfsAdd rejects an entry with an invalid name before saving", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsAdd({ name: "Invalid_Name", server: "10.0.0.1", path: "/share" });
    capture.restore();

    expect(capture.lines.join(" ")).toContain("Invalid NFS configuration");

    const manager = new ConfigManager(configPath);
    const infra = await manager.loadInfrastructure();
    expect(infra?.nfs ?? []).toHaveLength(0);
  });

  it("nfsAdd rejects an entry with a relative export path", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsAdd({ name: "data", server: "10.0.0.1", path: "relative/path" });
    capture.restore();

    expect(capture.lines.join(" ")).toContain("Invalid NFS configuration");
  });

  // ── nfsRemove ──────────────────────────────────────────────────────────────

  it("nfsRemove deletes an existing NFS entry", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      nfs: [
        { name: "media", server: "10.0.0.1", path: "/media", mountPoint: "" },
        { name: "backup", server: "10.0.0.2", path: "/backup", mountPoint: "" },
      ],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsRemove("media");
    capture.restore();

    expect(capture.lines.join(" ")).toContain("removed");

    const infra = await manager.loadInfrastructure();
    expect(infra?.nfs?.map((n) => n.name)).toEqual(["backup"]);
  });

  it("nfsRemove reports not found for an unknown name", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.nfsRemove("ghost");
    capture.restore();

    expect(capture.lines.join(" ")).toContain("not found");
  });
});
