/**
 * Backup command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BackupCommand } from "../../src/cli/commands/backup.js";
import { captureConsoleLog } from "../helpers/test-utils.js";

describe("BackupCommand", () => {
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  let captured: string[];
  let command: BackupCommand;

  beforeEach(() => {
    consoleCapture = captureConsoleLog();
    captured = consoleCapture.output;

    command = new BackupCommand();
  });

  afterEach(() => {
    consoleCapture.restore();
  });

  it("shows not initialized message when create is called before init", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { exists: () => Promise<boolean> };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => false,
    };

    await command.create({});

    const output = captured.join("\n");
    expect(output).toContain("Tuition is not initialized");
  });

  it("passes create options through to backup manager", async () => {
    type CreateOptions = {
      includeConfigs: boolean;
      includeDatabases: boolean;
      includeVolumes: boolean;
      compression: boolean;
    };

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { exists: () => Promise<boolean> };
      backup: {
        createBackup: (options: CreateOptions) => Promise<{
          success: boolean;
          message: string;
          metadata?: {
            createdAt: string;
            services: string[];
          };
        }>;
      };
    };

    let received: CreateOptions | undefined;

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
    };
    commandMock.backup = {
      createBackup: async (options) => {
        received = options;
        return {
          success: true,
          message: "backup created",
          metadata: {
            createdAt: "now",
            services: ["config"],
          },
        };
      },
    };

    await command.create({
      includeVolumes: true,
      noCompression: true,
      path: "/tmp/backups",
    });

    expect(received).toBeDefined();
    expect(received?.includeConfigs).toBe(true);
    expect(received?.includeDatabases).toBe(true);
    expect(received?.includeVolumes).toBe(true);
    expect(received?.compression).toBe(false);
  });

  it("prints invalid backup number for restore index out of range", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      backup: {
        listBackups: () => Promise<Array<{ path: string }>>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [],
    };

    await command.restore("1", { force: true });

    const output = captured.join("\n");
    expect(output).toContain("Invalid backup number: 1");
  });

  it("requires force for non-dry-run restore", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { getTuitionDir: () => string };
      backup: {
        restoreBackup: () => Promise<{ success: boolean; message: string }>;
      };
    };

    let restoreCalled = false;

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      getTuitionDir: () => "/tmp/tuition",
    };
    commandMock.backup = {
      restoreBackup: async () => {
        restoreCalled = true;
        return { success: true, message: "restored" };
      },
    };

    await command.restore("backup.tar.gz", { force: false, dryRun: false });

    const output = captured.join("\n");
    expect(output).toContain("Add --force to skip this confirmation");
    expect(restoreCalled).toBe(false);
  });

  it("prints invalid backup number for delete index out of range", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      backup: {
        listBackups: () => Promise<Array<{ path: string }>>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [],
    };

    await command.delete("1", {});

    const output = captured.join("\n");
    expect(output).toContain("Invalid backup number: 1");
  });

  it("resolves restore index to backup path and calls restore", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      backup: {
        listBackups: () => Promise<Array<{ path: string }>>;
        restoreBackup: (
          path: string,
          options: { dryRun?: boolean; force?: boolean }
        ) => Promise<{ success: boolean; message: string }>;
      };
    };

    let receivedPath = "";
    let receivedOptions: { dryRun?: boolean; force?: boolean } = {};

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [{ path: "/tmp/backups/a.tar.gz" }],
      restoreBackup: async (path, options) => {
        receivedPath = path;
        receivedOptions = options;
        return { success: true, message: "restored" };
      },
    };

    await command.restore("1", { dryRun: true, force: true });

    expect(receivedPath).toBe("/tmp/backups/a.tar.gz");
    expect(receivedOptions.dryRun).toBe(true);
    expect(receivedOptions.force).toBe(true);
  });

  it("resolves delete index to backup path and calls delete", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      backup: {
        listBackups: () => Promise<Array<{ path: string }>>;
        deleteBackup: (path: string) => Promise<{ success: boolean; message: string }>;
      };
    };

    let receivedPath = "";

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [{ path: "/tmp/backups/b.tar.gz" }],
      deleteBackup: async (path) => {
        receivedPath = path;
        return { success: true, message: "deleted" };
      },
    };

    await command.delete("1", {});

    expect(receivedPath).toBe("/tmp/backups/b.tar.gz");
  });

  it("prints backup metadata when list returns entries", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      backup: {
        listBackups: () => Promise<
          Array<{
            name: string;
            createdAt: string;
            size: number;
            services: string[];
          }>
        >;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [
        {
          name: "backup-1.tar.gz",
          createdAt: "2024-01-01T00:00:00.000Z",
          size: 2048,
          services: ["whoami", "pihole"],
        },
      ],
    };

    await command.list({});

    const output = captured.join("\n");
    expect(output).toContain("Available Backups:");
    expect(output).toContain("backup-1.tar.gz");
    expect(output).toContain("2 KB");
    expect(output).toContain("whoami, pihole");
  });

  it("prints the backup directory when no backups exist", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { getTuitionDir: () => string };
      backup: { listBackups: () => Promise<never[]> };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = { getTuitionDir: () => "/tmp/tuition" };
    commandMock.backup = { listBackups: async () => [] };

    await command.list({});

    const output = captured.join("\n");
    expect(output).toContain("No backups found");
    expect(output).toContain("/tmp/tuition/backups");
  });

  it("prints failure output when backup creation fails", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { exists: () => Promise<boolean> };
      backup: {
        createBackup: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = { exists: async () => true };
    commandMock.backup = {
      createBackup: async () => ({ success: false, message: "backup failed" }),
    };

    await command.create({});

    expect(captured.join("\n")).toContain("backup failed");
  });

  it("resolves relative restore paths into the backup directory", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { getTuitionDir: () => string };
      backup: {
        restoreBackup: (
          path: string,
          options: { dryRun?: boolean; force?: boolean }
        ) => Promise<{ success: boolean; message: string; restored?: string[] }>;
      };
    };

    let receivedPath = "";
    commandMock.initialize = async () => undefined;
    commandMock.config = { getTuitionDir: () => "/tmp/tuition" };
    commandMock.backup = {
      restoreBackup: async (path) => {
        receivedPath = path;
        return { success: true, message: "restored", restored: ["config"] };
      },
    };

    await command.restore("backup.tar.gz", { dryRun: true, force: true });

    expect(receivedPath.replace(/\\/g, "/")).toBe("/tmp/tuition/backups/backup.tar.gz");
    expect(captured.join("\n")).toContain("Restored: config");
  });

  it("prints restore failures from the backup manager", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { getTuitionDir: () => string };
      backup: {
        restoreBackup: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = { getTuitionDir: () => "/tmp/tuition" };
    commandMock.backup = {
      restoreBackup: async () => ({ success: false, message: "restore failed" }),
    };

    await command.restore("backup.tar.gz", { force: true });

    expect(captured.join("\n")).toContain("restore failed");
  });

  it("resolves relative delete paths into the backup directory", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { getTuitionDir: () => string };
      backup: {
        deleteBackup: (path: string) => Promise<{ success: boolean; message: string }>;
      };
    };

    let receivedPath = "";
    commandMock.initialize = async () => undefined;
    commandMock.config = { getTuitionDir: () => "/tmp/tuition" };
    commandMock.backup = {
      deleteBackup: async (path) => {
        receivedPath = path;
        return { success: true, message: "deleted" };
      },
    };

    await command.delete("backup.tar.gz", {});

    expect(receivedPath.replace(/\\/g, "/")).toBe("/tmp/tuition/backups/backup.tar.gz");
  });

  it("prints delete failures from the backup manager", async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { getTuitionDir: () => string };
      backup: {
        deleteBackup: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = { getTuitionDir: () => "/tmp/tuition" };
    commandMock.backup = {
      deleteBackup: async () => ({ success: false, message: "delete failed" }),
    };

    await command.delete("backup.tar.gz", {});

    expect(captured.join("\n")).toContain("delete failed");
  });

  it("formats bytes across units", () => {
    const formatBytes = (command as unknown as { formatBytes: (bytes: number) => string }).formatBytes.bind(command);

    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });
});
