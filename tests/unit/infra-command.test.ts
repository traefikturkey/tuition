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

  // ── externalList ───────────────────────────────────────────────────────────

  it("externalList reports empty state when no external services are configured", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalList();
    capture.restore();

    expect(capture.lines.join(" ")).toContain("No external services configured");
  });

  it("externalList lists all configured external services", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      externalServices: [
        { name: "nas", url: "http://192.168.1.10:5000" },
        { name: "router", url: "http://192.168.1.1" },
      ],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalList();
    capture.restore();

    const output = capture.lines.join("\n");
    expect(output).toContain("nas");
    expect(output).toContain("router");
    expect(output).toContain("192.168.1.1");
  });

  // ── externalShow ───────────────────────────────────────────────────────────

  it("externalShow displays details for an existing external service", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      externalServices: [{ name: "nas", url: "http://10.0.0.10:5000", subdomain: "synology", description: "My NAS" }],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalShow("nas");
    capture.restore();

    const output = capture.lines.join("\n");
    expect(output).toContain("http://10.0.0.10:5000");
    expect(output).toContain("synology");
    expect(output).toContain("My NAS");
  });

  it("externalShow reports not found for an unknown name", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalShow("ghost");
    capture.restore();

    expect(capture.lines.join(" ")).toContain("not found");
  });

  // ── externalAdd ────────────────────────────────────────────────────────────

  it("externalAdd persists a valid external service to infrastructure config", async () => {
    const cmd = new InfraCommand(configPath);
    await cmd.externalAdd({ name: "nas", url: "http://192.168.1.10:5000" });

    const manager = new ConfigManager(configPath);
    const infra = await manager.loadInfrastructure();
    const entry = infra?.externalServices?.find((s) => s.name === "nas");

    expect(entry).toBeDefined();
    expect(entry?.url).toBe("http://192.168.1.10:5000");
  });

  it("externalAdd rejects a duplicate name", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      externalServices: [{ name: "nas", url: "http://old-url" }],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalAdd({ name: "nas", url: "http://new-url" });
    capture.restore();

    expect(capture.lines.join(" ")).toContain("already exists");

    const infra = await manager.loadInfrastructure();
    expect(infra?.externalServices?.length).toBe(1);
    expect(infra?.externalServices?.[0]?.url).toBe("http://old-url");
  });

  it("externalAdd rejects an entry with an invalid name before saving", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalAdd({ name: "My_NAS!", url: "http://10.0.0.1" });
    capture.restore();

    expect(capture.lines.join(" ")).toContain("Invalid external service configuration");

    const manager = new ConfigManager(configPath);
    const infra = await manager.loadInfrastructure();
    expect(infra?.externalServices ?? []).toHaveLength(0);
  });

  it("externalAdd rejects an entry with a non-http(s) URL", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalAdd({ name: "nas", url: "ftp://10.0.0.1" });
    capture.restore();

    expect(capture.lines.join(" ")).toContain("Invalid external service configuration");
  });

  // ── externalRemove ─────────────────────────────────────────────────────────

  it("externalRemove deletes an existing external service", async () => {
    const manager = new ConfigManager(configPath);
    await manager.saveInfrastructure({
      externalServices: [
        { name: "nas", url: "http://10.0.0.1" },
        { name: "router", url: "http://10.0.0.2" },
      ],
    });

    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalRemove("nas");
    capture.restore();

    expect(capture.lines.join(" ")).toContain("removed");

    const infra = await manager.loadInfrastructure();
    expect(infra?.externalServices?.map((s) => s.name)).toEqual(["router"]);
  });

  it("externalRemove reports not found for an unknown name", async () => {
    const capture = captureConsole();
    const cmd = new InfraCommand(configPath);
    await cmd.externalRemove("ghost");
    capture.restore();

    expect(capture.lines.join(" ")).toContain("not found");
  });
});
