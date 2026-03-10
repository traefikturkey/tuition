/**
 * CLI command dispatch tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createCli } from "../../src/cli/commands/index.js";
import { InitCommand } from "../../src/cli/commands/init.js";
import { ValidateCommand } from "../../src/cli/commands/validate.js";
import { ConfigCommand } from "../../src/cli/commands/config.js";
import { BackupCommand } from "../../src/cli/commands/backup.js";
import { ServiceCommand } from "../../src/cli/commands/service.js";
import { CaddyCommand } from "../../src/cli/commands/caddy.js";
import { DnsCommand } from "../../src/cli/commands/dns.js";
import { InfraCommand } from "../../src/cli/commands/infra.js";
import { TuiApp } from "../../src/tui/app.js";
import { createPatchSet, stubProcessExit } from "../helpers/test-utils.js";

describe("CLI command dispatch", () => {
  let patchSet: ReturnType<typeof createPatchSet>;
  let exitStub: ReturnType<typeof stubProcessExit> | undefined;

  beforeEach(() => {
    patchSet = createPatchSet();
    exitStub = undefined;
  });

  afterEach(() => {
    exitStub?.restore();
    patchSet.restore();
  });

  it("dispatches init command with parsed path option", async () => {
    let receivedPath: string | undefined;

    patchSet.patch(InitCommand.prototype, "execute", async (options: { path?: string }) => {
      receivedPath = options.path;
    });

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "init", "--path", "/tmp/custom-config"]);

    expect(receivedPath).toBe("/tmp/custom-config");
  });

  it("exits with code 0 when validate succeeds", async () => {
    patchSet.patch(ValidateCommand.prototype, "execute", async () => true);
    exitStub = stubProcessExit();

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "validate"]);

    expect(exitStub.lastCode()).toBe(0);
  });

  it("exits with code 1 when validate fails", async () => {
    patchSet.patch(ValidateCommand.prototype, "execute", async () => false);
    exitStub = stubProcessExit();

    const cli = createCli();
    await cli.parseAsync(["node", "tuition", "validate"]);

    expect(exitStub.lastCode()).toBe(1);
  });

  it("dispatches backup restore with identifier and parsed flags", async () => {
    let receivedIdentifier = "";
    let receivedOptions: { dryRun?: boolean; force?: boolean; path?: string } = {};

    patchSet.patch(
      BackupCommand.prototype,
      "restore",
      async (identifier: string, options: { dryRun?: boolean; force?: boolean; path?: string }) => {
        receivedIdentifier = identifier;
        receivedOptions = options;
      }
    );

    const cli = createCli();
    await cli.parseAsync([
      "node",
      "tuition",
      "backup",
      "restore",
      "my-backup.tar.gz",
      "--dry-run",
      "--force",
      "--path",
      "/tmp/restore-config",
    ]);

    expect(receivedIdentifier).toBe("my-backup.tar.gz");
    expect(receivedOptions.dryRun).toBe(true);
    expect(receivedOptions.force).toBe(true);
    expect(receivedOptions.path).toBe("/tmp/restore-config");
  });

  it("dispatches backup create with parsed compression and volume flags", async () => {
    let receivedOptions: { includeVolumes?: boolean; noCompression?: boolean } = {};

    patchSet.patch(
      BackupCommand.prototype,
      "create",
      async (options: { includeVolumes?: boolean; noCompression?: boolean }) => {
        receivedOptions = options;
      }
    );

    const cli = createCli();
    await cli.parseAsync([
      "node",
      "tuition",
      "backup",
      "create",
      "--include-volumes",
      "--no-compression",
      "--path",
      "/tmp/backup-config",
    ]);

    expect(receivedOptions).toEqual({
      includeVolumes: true,
      noCompression: true,
    });
  });

  it("dispatches service logs with numeric tail parsing and follow flag", async () => {
    let receivedName = "";
    let receivedOptions: { tail?: number; follow?: boolean } = {};

    patchSet.patch(
      ServiceCommand.prototype,
      "logs",
      async (name: string, options: { tail?: number; follow?: boolean; path?: string }) => {
        receivedName = name;
        receivedOptions = options;
      }
    );

    const cli = createCli();
    await cli.parseAsync([
      "node",
      "tuition",
      "service",
      "logs",
      "whoami",
      "--tail",
      "25",
      "--follow",
      "--path",
      "/tmp/service-config",
    ]);

    expect(receivedName).toBe("whoami");
    expect(receivedOptions.tail).toBe(25);
    expect(receivedOptions.follow).toBe(true);
  });

  it("dispatches config commands with parsed arguments", async () => {
    let showPath: string | undefined;
    let setArgs: { key: string; value: string; path?: string } | undefined;

    patchSet.patch(ConfigCommand.prototype, "show", async (options: { path?: string }) => {
      showPath = options.path;
    });
    patchSet.patch(ConfigCommand.prototype, "set", async (key: string, value: string, options: { path?: string }) => {
      setArgs = { key, value, path: options.path };
    });

    let cli = createCli();
    await cli.parseAsync(["node", "tuition", "config", "show", "--path", "/tmp/config-show"]);

    cli = createCli();
    await cli.parseAsync([
      "node",
      "tuition",
      "config",
      "set",
      "global.domain",
      "example.com",
      "--path",
      "/tmp/config-set",
    ]);

    expect(showPath).toBe("/tmp/config-show");
    expect(setArgs).toEqual({ key: "global.domain", value: "example.com", path: "/tmp/config-set" });
  });

  it("dispatches service lifecycle and search commands", async () => {
    const calls: Array<{ method: string; name?: string; path?: string; extra?: Record<string, unknown> }> = [];

    patchSet.patch(
      ServiceCommand.prototype,
      "list",
      async (options: { category?: string; all?: boolean; path?: string }) => {
        calls.push({ method: "list", path: options.path, extra: { category: options.category, all: options.all } });
      }
    );
    patchSet.patch(ServiceCommand.prototype, "show", async (name: string, options: { path?: string }) => {
      calls.push({ method: "show", name, path: options.path });
    });
    patchSet.patch(
      ServiceCommand.prototype,
      "enable",
      async (name: string, options: { noStart?: boolean; start?: boolean; path?: string }) => {
        calls.push({
          method: "enable",
          name,
          path: options.path,
          extra: { noStart: options.noStart, start: options.start },
        });
      }
    );
    patchSet.patch(
      ServiceCommand.prototype,
      "disable",
      async (name: string, options: { removeData?: boolean; path?: string }) => {
        calls.push({ method: "disable", name, path: options.path, extra: { removeData: options.removeData } });
      }
    );
    patchSet.patch(ServiceCommand.prototype, "start", async (name: string, options: { path?: string }) => {
      calls.push({ method: "start", name, path: options.path });
    });
    patchSet.patch(ServiceCommand.prototype, "stop", async (name: string, options: { path?: string }) => {
      calls.push({ method: "stop", name, path: options.path });
    });
    patchSet.patch(ServiceCommand.prototype, "restart", async (name: string, options: { path?: string }) => {
      calls.push({ method: "restart", name, path: options.path });
    });
    patchSet.patch(ServiceCommand.prototype, "update", async (name: string, options: { path?: string }) => {
      calls.push({ method: "update", name, path: options.path });
    });
    patchSet.patch(ServiceCommand.prototype, "search", async (query: string, options: { path?: string }) => {
      calls.push({ method: "search", name: query, path: options.path });
    });

    const invocations: string[][] = [
      ["node", "tuition", "service", "list", "--category", "dns", "--all", "--path", "/tmp/service-list"],
      ["node", "tuition", "service", "show", "whoami", "--path", "/tmp/service-show"],
      ["node", "tuition", "service", "enable", "whoami", "--no-start", "--path", "/tmp/service-enable"],
      ["node", "tuition", "service", "disable", "whoami", "--remove-data", "--path", "/tmp/service-disable"],
      ["node", "tuition", "service", "start", "whoami", "--path", "/tmp/service-start"],
      ["node", "tuition", "service", "stop", "whoami", "--path", "/tmp/service-stop"],
      ["node", "tuition", "service", "restart", "whoami", "--path", "/tmp/service-restart"],
      ["node", "tuition", "service", "update", "whoami", "--path", "/tmp/service-update"],
      ["node", "tuition", "service", "search", "media", "--path", "/tmp/service-search"],
    ];

    for (const args of invocations) {
      const cli = createCli();
      await cli.parseAsync(args);
    }

    expect(calls).toEqual([
      { method: "list", path: "/tmp/service-list", extra: { category: "dns", all: true } },
      { method: "show", name: "whoami", path: "/tmp/service-show" },
      { method: "enable", name: "whoami", path: "/tmp/service-enable", extra: { noStart: undefined, start: false } },
      { method: "disable", name: "whoami", path: "/tmp/service-disable", extra: { removeData: true } },
      { method: "start", name: "whoami", path: "/tmp/service-start" },
      { method: "stop", name: "whoami", path: "/tmp/service-stop" },
      { method: "restart", name: "whoami", path: "/tmp/service-restart" },
      { method: "update", name: "whoami", path: "/tmp/service-update" },
      { method: "search", name: "media", path: "/tmp/service-search" },
    ]);
  });

  it("dispatches caddy, dns, backup, and tui commands", async () => {
    const calls: string[] = [];

    patchSet.patch(CaddyCommand.prototype, "start", async () => {
      calls.push("caddy:start");
    });
    patchSet.patch(CaddyCommand.prototype, "stop", async () => {
      calls.push("caddy:stop");
    });
    patchSet.patch(CaddyCommand.prototype, "restart", async () => {
      calls.push("caddy:restart");
    });
    patchSet.patch(CaddyCommand.prototype, "reload", async () => {
      calls.push("caddy:reload");
    });
    patchSet.patch(CaddyCommand.prototype, "status", async () => {
      calls.push("caddy:status");
    });
    patchSet.patch(CaddyCommand.prototype, "regenerate", async () => {
      calls.push("caddy:regenerate");
    });
    patchSet.patch(CaddyCommand.prototype, "hashPassword", async () => {
      calls.push("caddy:hash-password");
    });
    patchSet.patch(CaddyCommand.prototype, "setPassword", async () => {
      calls.push("caddy:set-password");
    });
    patchSet.patch(DnsCommand.prototype, "start", async () => {
      calls.push("dns:start");
    });
    patchSet.patch(DnsCommand.prototype, "stop", async () => {
      calls.push("dns:stop");
    });
    patchSet.patch(DnsCommand.prototype, "status", async () => {
      calls.push("dns:status");
    });
    patchSet.patch(DnsCommand.prototype, "regenerate", async () => {
      calls.push("dns:regenerate");
    });
    patchSet.patch(DnsCommand.prototype, "configure", async () => {
      calls.push("dns:configure");
    });
    patchSet.patch(DnsCommand.prototype, "cluster", async () => {
      calls.push("dns:cluster");
    });
    patchSet.patch(BackupCommand.prototype, "create", async () => {
      calls.push("backup:create");
    });
    patchSet.patch(BackupCommand.prototype, "list", async () => {
      calls.push("backup:list");
    });
    patchSet.patch(BackupCommand.prototype, "delete", async () => {
      calls.push("backup:delete");
    });
    patchSet.patch(TuiApp.prototype, "run", async () => {
      calls.push("tui:run");
    });

    const invocations: string[][] = [
      ["node", "tuition", "caddy", "start"],
      ["node", "tuition", "caddy", "stop"],
      ["node", "tuition", "caddy", "restart"],
      ["node", "tuition", "caddy", "reload"],
      ["node", "tuition", "caddy", "status"],
      ["node", "tuition", "caddy", "regenerate"],
      ["node", "tuition", "caddy", "hash-password"],
      ["node", "tuition", "caddy", "set-password"],
      ["node", "tuition", "dns", "start"],
      ["node", "tuition", "dns", "stop"],
      ["node", "tuition", "dns", "status"],
      ["node", "tuition", "dns", "regenerate"],
      ["node", "tuition", "dns", "configure"],
      ["node", "tuition", "dns", "cluster"],
      ["node", "tuition", "backup", "create"],
      ["node", "tuition", "backup", "list"],
      ["node", "tuition", "backup", "delete", "backup.tar.gz"],
      ["node", "tuition", "tui"],
    ];

    for (const args of invocations) {
      const cli = createCli();
      await cli.parseAsync(args);
    }

    expect(calls).toEqual([
      "caddy:start",
      "caddy:stop",
      "caddy:restart",
      "caddy:reload",
      "caddy:status",
      "caddy:regenerate",
      "caddy:hash-password",
      "caddy:set-password",
      "dns:start",
      "dns:stop",
      "dns:status",
      "dns:regenerate",
      "dns:configure",
      "dns:cluster",
      "backup:create",
      "backup:list",
      "backup:delete",
      "tui:run",
    ]);
  });

  it("dispatches infra nfs sub-commands with correct arguments", async () => {
    const calls: Array<{ method: string; name?: string; path?: string; opts?: Record<string, unknown> }> = [];

    patchSet.patch(InfraCommand.prototype, "nfsList", async (options: { path?: string }) => {
      calls.push({ method: "nfs:list", path: options.path });
    });
    patchSet.patch(InfraCommand.prototype, "nfsShow", async (name: string, options: { path?: string }) => {
      calls.push({ method: "nfs:show", name, path: options.path });
    });
    patchSet.patch(
      InfraCommand.prototype,
      "nfsAdd",
      async (options: { name: string; server: string; path: string; options?: string; path_config?: string }) => {
        calls.push({ method: "nfs:add", opts: { name: options.name, server: options.server, path: options.path } });
      }
    );
    patchSet.patch(InfraCommand.prototype, "nfsRemove", async (name: string, options: { path?: string }) => {
      calls.push({ method: "nfs:remove", name, path: options.path });
    });

    const invocations: string[][] = [
      ["node", "tuition", "infra", "nfs", "list", "--path", "/tmp/infra-config"],
      ["node", "tuition", "infra", "nfs", "show", "media", "--path", "/tmp/infra-config"],
      [
        "node",
        "tuition",
        "infra",
        "nfs",
        "add",
        "--name",
        "media",
        "--server",
        "192.168.1.10",
        "--path",
        "/export/media",
      ],
      ["node", "tuition", "infra", "nfs", "remove", "media", "--path", "/tmp/infra-config"],
    ];

    for (const args of invocations) {
      const cli = createCli();
      await cli.parseAsync(args);
    }

    expect(calls[0]).toEqual({ method: "nfs:list", path: "/tmp/infra-config" });
    expect(calls[1]).toEqual({ method: "nfs:show", name: "media", path: "/tmp/infra-config" });
    expect(calls[2]).toEqual({
      method: "nfs:add",
      opts: { name: "media", server: "192.168.1.10", path: "/export/media" },
    });
    expect(calls[3]).toEqual({ method: "nfs:remove", name: "media", path: "/tmp/infra-config" });
  });
});
