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
});
