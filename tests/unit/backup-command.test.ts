/**
 * Backup command tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackupCommand } from '../../src/cli/commands/backup.js';

describe('BackupCommand', () => {
  let captured: string[];
  let originalLog: typeof console.log;
  let command: BackupCommand;

  beforeEach(() => {
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };

    command = new BackupCommand();
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('shows not initialized message when create is called before init', async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { exists: () => Promise<boolean> };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => false,
    };

    await command.create({});

    const output = captured.join('\n');
    expect(output).toContain('Tuition is not initialized');
  });

  it('passes create options through to backup manager', async () => {
    type CreateOptions = {
      includeConfigs: boolean;
      includeDatabases: boolean;
      includeVolumes: boolean;
      compression: boolean;
      destination?: string;
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
          message: 'backup created',
          metadata: {
            createdAt: 'now',
            services: ['config'],
          },
        };
      },
    };

    await command.create({
      includeVolumes: true,
      noCompression: true,
      path: '/tmp/backups',
    });

    expect(received).toBeDefined();
    expect(received?.includeConfigs).toBe(true);
    expect(received?.includeDatabases).toBe(true);
    expect(received?.includeVolumes).toBe(true);
    expect(received?.compression).toBe(false);
    expect(received?.destination).toBe('/tmp/backups');
  });

  it('prints invalid backup number for restore index out of range', async () => {
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

    await command.restore('1', { force: true });

    const output = captured.join('\n');
    expect(output).toContain('Invalid backup number: 1');
  });

  it('requires force for non-dry-run restore', async () => {
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
      getTuitionDir: () => '/tmp/tuition',
    };
    commandMock.backup = {
      restoreBackup: async () => {
        restoreCalled = true;
        return { success: true, message: 'restored' };
      },
    };

    await command.restore('backup.tar.gz', { force: false, dryRun: false });

    const output = captured.join('\n');
    expect(output).toContain('Add --force to skip this confirmation');
    expect(restoreCalled).toBe(false);
  });

  it('prints invalid backup number for delete index out of range', async () => {
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

    await command.delete('1', {});

    const output = captured.join('\n');
    expect(output).toContain('Invalid backup number: 1');
  });

  it('resolves restore index to backup path and calls restore', async () => {
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

    let receivedPath = '';
    let receivedOptions: { dryRun?: boolean; force?: boolean } = {};

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [{ path: '/tmp/backups/a.tar.gz' }],
      restoreBackup: async (path, options) => {
        receivedPath = path;
        receivedOptions = options;
        return { success: true, message: 'restored' };
      },
    };

    await command.restore('1', { dryRun: true, force: true });

    expect(receivedPath).toBe('/tmp/backups/a.tar.gz');
    expect(receivedOptions.dryRun).toBe(true);
    expect(receivedOptions.force).toBe(true);
  });

  it('resolves delete index to backup path and calls delete', async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      backup: {
        listBackups: () => Promise<Array<{ path: string }>>;
        deleteBackup: (path: string) => Promise<{ success: boolean; message: string }>;
      };
    };

    let receivedPath = '';

    commandMock.initialize = async () => undefined;
    commandMock.backup = {
      listBackups: async () => [{ path: '/tmp/backups/b.tar.gz' }],
      deleteBackup: async (path) => {
        receivedPath = path;
        return { success: true, message: 'deleted' };
      },
    };

    await command.delete('1', {});

    expect(receivedPath).toBe('/tmp/backups/b.tar.gz');
  });
});
