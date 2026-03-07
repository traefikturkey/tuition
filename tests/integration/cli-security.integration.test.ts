/**
 * CLI security integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigCommand } from "../../src/cli/commands/config.js";
import { BackupCommand } from "../../src/cli/commands/backup.js";

describe("CLI security integration", () => {
  let tempDir: string;
  let captured: string[];
  let originalLog: typeof console.log;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-integration-test-"));
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };
  });

  afterEach(async () => {
    console.log = originalLog;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("redacts sensitive values in config show output", async () => {
    const configPath = join(tempDir, "config");
    await mkdir(configPath, { recursive: true });

    await writeFile(
      join(configPath, "global.yaml"),
      [
        "hostname: test-host",
        "domain: example.com",
        "adminEmail: admin@example.com",
        "dnsProvider: cloudflare",
        "cloudflareToken: super-secret-token",
        "adminPasswordHash: hash-value",
      ].join("\n"),
      "utf-8"
    );

    const command = new ConfigCommand();
    await command.show({ path: configPath });

    const output = captured.join("\n");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("super-secret-token");
    expect(output).not.toContain("hash-value");
  });

  it("blocks restore paths outside backup directory", async () => {
    const configPath = join(tempDir, "config");
    const command = new BackupCommand(configPath);

    await command.restore("../../outside.tar.gz", {
      dryRun: true,
      force: true,
    });

    const output = captured.join("\n");
    expect(output).toContain("outside the configured backup directory");
  });
});
