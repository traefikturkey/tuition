/**
 * Init command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import readline from "readline";
import { mkdtemp, rm, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { InitCommand } from "../../src/cli/commands/init.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { captureConsoleLog, createPatchSet } from "../helpers/test-utils.js";

describe("InitCommand", () => {
  let tempDir: string;
  let configPath: string;
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-init-command-test-"));
    configPath = join(tempDir, "config");

    consoleCapture = captureConsoleLog();
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
    consoleCapture.restore();
    await rm(tempDir, { recursive: true, force: true });
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

  it("returns early when already initialized", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "existing-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "token",
      upstreamDns: {
        primary: "1.1.1.1",
      },
    });

    const command = new InitCommand();
    await command.execute({ path: configPath });

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("already initialized");
  });

  it("initializes config and generates coredns config with valid prompted data", async () => {
    const command = new InitCommand();
    const commandMock = command as unknown as {
      promptForConfig: () => Promise<{
        hostname: string;
        domain: string;
        adminEmail: string;
        timezone: string;
        puid: number;
        pgid: number;
        dnsProvider: "cloudflare";
        cloudflareToken: string;
        upstreamDns: {
          primary: string;
          backup?: string;
        };
      }>;
    };

    commandMock.promptForConfig = async () => ({
      hostname: "new-host",
      domain: "example.com",
      adminEmail: "admin@example.com",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "token-123",
      upstreamDns: {
        primary: "1.1.1.1",
        backup: "1.0.0.1",
      },
    });

    await command.execute({ path: configPath });

    const manager = new ConfigManager(configPath);
    const loaded = await manager.loadGlobal();
    expect(loaded.hostname).toBe("new-host");
    expect(loaded.domain).toBe("example.com");

    const corednsCorefile = join(tempDir, "coredns-config", "Corefile");
    const exists = await access(corednsCorefile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("initialized successfully");
  });

  it("shows validation failure and does not save invalid config", async () => {
    const command = new InitCommand();
    const commandMock = command as unknown as {
      promptForConfig: () => Promise<{
        hostname: string;
        domain: string;
        adminEmail: string;
        timezone: string;
        puid: number;
        pgid: number;
        dnsProvider: "cloudflare";
        cloudflareToken: string;
        upstreamDns: {
          primary: string;
        };
      }>;
    };

    commandMock.promptForConfig = async () => ({
      hostname: "host",
      domain: "example.com",
      adminEmail: "invalid-email",
      timezone: "UTC",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      cloudflareToken: "token-123",
      upstreamDns: {
        primary: "999.999.999.999",
      },
    });

    await command.execute({ path: configPath });

    const manager = new ConfigManager(configPath);
    const exists = await manager.exists();
    expect(exists).toBe(false);

    const output = consoleCapture.output.join("\n");
    expect(output).toContain("Configuration validation failed");
  });

  it("prompts for config using a preset DNS provider and default timezone", async () => {
    const interfaceMock = mockReadlineAnswers([
      " homelab ",
      " example.com ",
      " admin@example.com ",
      "",
      " cf-token ",
      "2",
      "n",
    ]);
    const command = new InitCommand();

    const result = await (
      command as unknown as {
        promptForConfig: () => Promise<{
          hostname: string;
          domain: string;
          adminEmail: string;
          timezone: string;
          cloudflareToken: string;
          upstreamDns: { primary: string; backup?: string };
          adminPasswordHash?: string;
        }>;
      }
    ).promptForConfig();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(result.hostname).toBe("homelab");
    expect(result.domain).toBe("example.com");
    expect(result.adminEmail).toBe("admin@example.com");
    expect(result.timezone).toBe("UTC");
    expect(result.cloudflareToken).toBe("cf-token");
    expect(result.upstreamDns).toEqual({ primary: "1.1.1.1", backup: "1.0.0.1" });
    expect(result.adminPasswordHash).toBeUndefined();
  });

  it("prompts for custom DNS values when the default option is used", async () => {
    const interfaceMock = mockReadlineAnswers([
      "host",
      "example.com",
      "admin@example.com",
      "America/Chicago",
      "token",
      "",
      "9.9.9.9",
      "149.112.112.112",
      "n",
    ]);
    const command = new InitCommand();

    const result = await (
      command as unknown as {
        promptForConfig: () => Promise<{
          timezone: string;
          upstreamDns: { primary: string; backup?: string };
        }>;
      }
    ).promptForConfig();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(result.timezone).toBe("America/Chicago");
    expect(result.upstreamDns).toEqual({
      primary: "9.9.9.9",
      backup: "149.112.112.112",
    });
  });

  it("supports the Google and OpenDNS preset choices", async () => {
    let interfaceMock = mockReadlineAnswers(["host", "example.com", "admin@example.com", "UTC", "token", "1", "n"]);
    let command = new InitCommand();

    const google = await (
      command as unknown as {
        promptForConfig: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      }
    ).promptForConfig();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(google.upstreamDns).toEqual({ primary: "8.8.8.8", backup: "8.8.4.4" });

    interfaceMock = mockReadlineAnswers(["host", "example.com", "admin@example.com", "UTC", "token", "3", "n"]);
    command = new InitCommand();

    const opendns = await (
      command as unknown as {
        promptForConfig: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      }
    ).promptForConfig();

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(opendns.upstreamDns).toEqual({
      primary: "208.67.222.222",
      backup: "208.67.220.220",
    });
  });

  it("hashes and stores the admin password when setup is enabled and confirmed", async () => {
    const interfaceMock = mockReadlineAnswers(["host", "example.com", "admin@example.com", "UTC", "token", "2", "y"]);
    setupPasswordPromptIo();
    const command = new InitCommand();

    const pending = (
      command as unknown as {
        promptForConfig: () => Promise<{ adminPasswordHash?: string }>;
      }
    ).promptForConfig();
    await submitPassword("secret-password");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await submitPassword("secret-password");
    const result = await pending;

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(typeof result.adminPasswordHash).toBe("string");
    expect(String(result.adminPasswordHash)).toContain("$2b$");
    expect(consoleCapture.output.join("\n")).toContain("Admin password configured");
  });

  it("skips admin password setup when the confirmation does not match", async () => {
    const interfaceMock = mockReadlineAnswers(["host", "example.com", "admin@example.com", "UTC", "token", "2", "y"]);
    setupPasswordPromptIo();
    const command = new InitCommand();

    const pending = (
      command as unknown as {
        promptForConfig: () => Promise<{ adminPasswordHash?: string }>;
      }
    ).promptForConfig();
    await submitPassword("secret-password");
    await submitPassword("different-password");
    const result = await pending;

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(result.adminPasswordHash).toBeUndefined();
    expect(consoleCapture.output.join("\n")).toContain("Passwords did not match");
  });

  it("skips admin password setup when the password is empty", async () => {
    const interfaceMock = mockReadlineAnswers(["host", "example.com", "admin@example.com", "UTC", "token", "2", "y"]);
    setupPasswordPromptIo();
    const command = new InitCommand();

    const pending = (
      command as unknown as {
        promptForConfig: () => Promise<{ adminPasswordHash?: string }>;
      }
    ).promptForConfig();
    await submitPassword("");
    await submitPassword("");
    const result = await pending;

    expect(interfaceMock.wasClosed()).toBe(true);
    expect(result.adminPasswordHash).toBeUndefined();
    expect(consoleCapture.output.join("\n")).toContain("Password cannot be empty");
  });

  it("generates env file content with deterministic manager secrets", () => {
    const command = new InitCommand();
    const manager = new ConfigManager(configPath);
    patchSet.patch(manager, "generatePassword", () => "generated-secret");

    const content = (
      command as unknown as {
        generateEnvFile: (
          config: {
            domain: string;
            hostname: string;
            adminEmail: string;
            timezone: string;
            puid: number;
            pgid: number;
            cloudflareToken?: string;
          },
          manager: ConfigManager
        ) => string;
      }
    ).generateEnvFile(
      {
        domain: "example.com",
        hostname: "homelab",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        cloudflareToken: "cf-token",
      },
      manager
    );

    expect(content).toContain("DOMAIN=example.com");
    expect(content).toContain("HOSTNAME=homelab");
    expect(content).toContain("ADMIN_EMAIL=admin@example.com");
    expect(content).toContain("CF_API_TOKEN=cf-token");
    expect(content).toContain("ADMIN_PASSWORD=generated-secret");
  });
});
