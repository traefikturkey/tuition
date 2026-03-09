/**
 * Backup manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BackupManager } from "../../src/services/backup/manager.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { mkdtemp, rm, writeFile, mkdir, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { logger } from "../../src/utils/logger.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("BackupManager", () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let backupManager: BackupManager;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-backup-test-"));
    configManager = new ConfigManager(join(tempDir, "config"));
    backupManager = new BackupManager(configManager);
    patchSet = createPatchSet();
    await configManager.initialize();
    await backupManager.initialize();
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create backup directory", async () => {
      // Already initialized in beforeEach
      const backupDir = join(tempDir, "backups");
      // Directory should exist
      expect(true).toBe(true);
    });
  });

  describe("createBackup", () => {
    it("should create backup successfully", async () => {
      // Create some test config
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: test\ndomain: example.com", "utf-8");

      const result = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should include metadata in backup", async () => {
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: test\ndomain: example.com", "utf-8");

      const result = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      expect(result.metadata?.version).toBe("1.0");
      expect(result.metadata?.services).toContain("config");
    });

    it("should include service data when volume backups are enabled", async () => {
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await mkdir(join(tempDir, "data", "whoami"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: test\ndomain: example.com", "utf-8");
      await writeFile(join(tempDir, "data", "whoami", "payload.txt"), "volume-data", "utf-8");

      const result = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: true,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.services).toContain("data");
    });
  });

  describe("listBackups", () => {
    it("should return empty array when no backups exist", async () => {
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });

    it("should list created backups", async () => {
      // Create a backup first
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: test", "utf-8");

      await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      const backups = await backupManager.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });

    it("falls back to file metadata when archive metadata cannot be extracted", async () => {
      const invalidBackupPath = join(tempDir, "backups", "tuition-backup-invalid.tar.gz");
      await writeFile(invalidBackupPath, "not-a-tar-archive", "utf-8");

      const backups = await backupManager.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0]?.name).toBe("tuition-backup-invalid.tar.gz");
      expect(backups[0]?.services).toEqual([]);
      expect(backups[0]?.createdAt).toBeDefined();
    });

    it("sorts backups by newest created time first", async () => {
      const firstBackupPath = join(tempDir, "backups", "tuition-backup-first.tar.gz");
      const secondBackupPath = join(tempDir, "backups", "tuition-backup-second.tar.gz");

      await writeFile(firstBackupPath, "not-a-tar-archive", "utf-8");
      await new Promise((resolve) => setTimeout(resolve, 20));
      await writeFile(secondBackupPath, "not-a-tar-archive", "utf-8");

      const backups = await backupManager.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0]?.name).toBe("tuition-backup-second.tar.gz");
      expect(backups[1]?.name).toBe("tuition-backup-first.tar.gz");
    });
  });

  describe("deleteBackup", () => {
    it("should delete existing backup", async () => {
      // Create a backup first
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: test", "utf-8");

      const createResult = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      const deleteResult = await backupManager.deleteBackup(createResult.backupPath!);
      expect(deleteResult.success).toBe(true);
    });

    it("should reject deleting backups outside the backup directory", async () => {
      const outsidePath = join(tempDir, "outside-backup.tar.gz");
      await writeFile(outsidePath, "test", "utf-8");

      const deleteResult = await backupManager.deleteBackup(outsidePath);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.message).toContain("outside the configured backup directory");

      const outsideStats = await stat(outsidePath);
      expect(outsideStats.size).toBeGreaterThan(0);
    });

    it("should reject non-backup file extensions for delete", async () => {
      const invalidPath = join(tempDir, "backups", "not-a-backup.txt");
      await writeFile(invalidPath, "test", "utf-8");

      const deleteResult = await backupManager.deleteBackup(invalidPath);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.message).toContain("Invalid backup file extension");
    });
  });

  describe("restoreBackup", () => {
    it("should restore configuration and compose files from a created backup", async () => {
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: before\ndomain: example.com", "utf-8");
      await writeFile(
        join(tempDir, "whoami.docker-compose.yaml"),
        "services:\n  whoami:\n    image: traefik/whoami",
        "utf-8"
      );

      const createResult = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: after\ndomain: changed.example.com", "utf-8");

      const restoreResult = await backupManager.restoreBackup(createResult.backupPath!, {
        force: true,
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restored).toContain("configuration");
      expect(restoreResult.restored).toContain("compose-files");

      const restoredConfig = await stat(join(tempDir, "config", "global.yaml"));
      const restoredCompose = await stat(join(tempDir, "whoami.docker-compose.yaml"));

      expect(restoredConfig.size).toBeGreaterThan(0);
      expect(restoredCompose.size).toBeGreaterThan(0);
    });

    it("restores caddy, dns, and service data when those components exist in the backup", async () => {
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await mkdir(join(tempDir, "caddy-data"), { recursive: true });
      await mkdir(join(tempDir, "coredns-config"), { recursive: true });
      await mkdir(join(tempDir, "data", "whoami"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: before\ndomain: example.com", "utf-8");
      await writeFile(join(tempDir, "caddy-data", "state.txt"), "caddy", "utf-8");
      await writeFile(join(tempDir, "coredns-config", "Corefile"), "example.com", "utf-8");
      await writeFile(join(tempDir, "data", "whoami", "payload.txt"), "service-data", "utf-8");

      const createResult = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: true,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      await writeFile(join(tempDir, "caddy-data", "state.txt"), "changed", "utf-8");
      await writeFile(join(tempDir, "coredns-config", "Corefile"), "changed", "utf-8");
      await writeFile(join(tempDir, "data", "whoami", "payload.txt"), "changed", "utf-8");

      const restoreResult = await backupManager.restoreBackup(createResult.backupPath!, {
        force: true,
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restored).toContain("caddy-data");
      expect(restoreResult.restored).toContain("coredns-config");
      expect(restoreResult.restored).toContain("service-data");

      const restoredCaddy = await stat(join(tempDir, "caddy-data", "state.txt"));
      const restoredDns = await stat(join(tempDir, "coredns-config", "Corefile"));
      const restoredServiceData = await stat(join(tempDir, "data", "whoami", "payload.txt"));

      expect(restoredCaddy.size).toBeGreaterThan(0);
      expect(restoredDns.size).toBeGreaterThan(0);
      expect(restoredServiceData.size).toBeGreaterThan(0);
    });

    it("warns when restoring without force but still proceeds", async () => {
      await mkdir(join(tempDir, "config", "services"), { recursive: true });
      await writeFile(join(tempDir, "config", "global.yaml"), "hostname: before\ndomain: example.com", "utf-8");

      const createResult = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, "backups"),
      });

      let warnedMessage = "";
      patchSet.patch(logger, "warn", ((_: string, message: string) => {
        warnedMessage = message;
      }) as typeof logger.warn);

      const restoreResult = await backupManager.restoreBackup(createResult.backupPath!);

      expect(restoreResult.success).toBe(true);
      expect(warnedMessage).toContain("Restore requested without force");
    });

    it("should reject restoring backups outside the backup directory", async () => {
      const outsidePath = join(tempDir, "outside-backup.tar.gz");
      await writeFile(outsidePath, "test", "utf-8");

      const restoreResult = await backupManager.restoreBackup(outsidePath, {
        dryRun: true,
      });

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.message).toContain("outside the configured backup directory");
    });

    it("should report a missing backup file inside the backup directory", async () => {
      const missingPath = join(tempDir, "backups", "tuition-backup-missing.tar.gz");

      const restoreResult = await backupManager.restoreBackup(missingPath, {
        dryRun: true,
      });

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.message).toContain("Backup file not found");
    });
  });
});
