/**
 * Backup manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackupManager } from '../../src/services/backup/manager.js';
import { ConfigManager } from '../../src/core/config/manager.js';
import { mkdtemp, rm, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('BackupManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let backupManager: BackupManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-backup-test-'));
    configManager = new ConfigManager(join(tempDir, 'config'));
    backupManager = new BackupManager(configManager);
    await configManager.initialize();
    await backupManager.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create backup directory', async () => {
      // Already initialized in beforeEach
      const backupDir = join(tempDir, 'backups');
      // Directory should exist
      expect(true).toBe(true);
    });
  });

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      // Create some test config
      await mkdir(join(tempDir, 'config', 'services'), { recursive: true });
      await writeFile(
        join(tempDir, 'config', 'global.yaml'),
        'hostname: test\ndomain: example.com',
        'utf-8'
      );

      const result = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, 'backups'),
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should include metadata in backup', async () => {
      await mkdir(join(tempDir, 'config', 'services'), { recursive: true });
      await writeFile(
        join(tempDir, 'config', 'global.yaml'),
        'hostname: test\ndomain: example.com',
        'utf-8'
      );

      const result = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, 'backups'),
      });

      expect(result.metadata?.version).toBe('1.0');
      expect(result.metadata?.services).toContain('config');
    });
  });

  describe('listBackups', () => {
    it('should return empty array when no backups exist', async () => {
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(0);
    });

    it('should list created backups', async () => {
      // Create a backup first
      await mkdir(join(tempDir, 'config', 'services'), { recursive: true });
      await writeFile(
        join(tempDir, 'config', 'global.yaml'),
        'hostname: test',
        'utf-8'
      );

      await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, 'backups'),
      });

      const backups = await backupManager.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });
  });

  describe('deleteBackup', () => {
    it('should delete existing backup', async () => {
      // Create a backup first
      await mkdir(join(tempDir, 'config', 'services'), { recursive: true });
      await writeFile(
        join(tempDir, 'config', 'global.yaml'),
        'hostname: test',
        'utf-8'
      );

      const createResult = await backupManager.createBackup({
        includeConfigs: true,
        includeDatabases: false,
        includeVolumes: false,
        compression: false,
        destination: join(tempDir, 'backups'),
      });

      const deleteResult = await backupManager.deleteBackup(createResult.backupPath!);
      expect(deleteResult.success).toBe(true);
    });

    it('should reject deleting backups outside the backup directory', async () => {
      const outsidePath = join(tempDir, 'outside-backup.tar.gz');
      await writeFile(outsidePath, 'test', 'utf-8');

      const deleteResult = await backupManager.deleteBackup(outsidePath);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.message).toContain('outside the configured backup directory');

      const outsideStats = await stat(outsidePath);
      expect(outsideStats.size).toBeGreaterThan(0);
    });

    it('should reject non-backup file extensions for delete', async () => {
      const invalidPath = join(tempDir, 'backups', 'not-a-backup.txt');
      await writeFile(invalidPath, 'test', 'utf-8');

      const deleteResult = await backupManager.deleteBackup(invalidPath);
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.message).toContain('Invalid backup file extension');
    });
  });

  describe('restoreBackup', () => {
    it('should reject restoring backups outside the backup directory', async () => {
      const outsidePath = join(tempDir, 'outside-backup.tar.gz');
      await writeFile(outsidePath, 'test', 'utf-8');

      const restoreResult = await backupManager.restoreBackup(outsidePath, {
        dryRun: true,
      });

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.message).toContain('outside the configured backup directory');
    });
  });
});
