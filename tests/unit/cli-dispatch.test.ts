/**
 * CLI command dispatch tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createCli } from '../../src/cli/commands/index.js';
import { InitCommand } from '../../src/cli/commands/init.js';
import { ValidateCommand } from '../../src/cli/commands/validate.js';
import { BackupCommand } from '../../src/cli/commands/backup.js';
import { ServiceCommand } from '../../src/cli/commands/service.js';

describe('CLI command dispatch', () => {
  const originalInitExecute = InitCommand.prototype.execute;
  const originalValidateExecute = ValidateCommand.prototype.execute;
  const originalBackupRestore = BackupCommand.prototype.restore;
  const originalServiceLogs = ServiceCommand.prototype.logs;
  const originalExit = process.exit;

  beforeEach(() => {
    InitCommand.prototype.execute = originalInitExecute;
    ValidateCommand.prototype.execute = originalValidateExecute;
    BackupCommand.prototype.restore = originalBackupRestore;
    ServiceCommand.prototype.logs = originalServiceLogs;
    process.exit = originalExit;
  });

  afterEach(() => {
    InitCommand.prototype.execute = originalInitExecute;
    ValidateCommand.prototype.execute = originalValidateExecute;
    BackupCommand.prototype.restore = originalBackupRestore;
    ServiceCommand.prototype.logs = originalServiceLogs;
    process.exit = originalExit;
  });

  it('dispatches init command with parsed path option', async () => {
    let receivedPath: string | undefined;

    InitCommand.prototype.execute = async (options: { path?: string }) => {
      receivedPath = options.path;
    };

    const cli = createCli();
    await cli.parseAsync(['node', 'tuition', 'init', '--path', '/tmp/custom-config']);

    expect(receivedPath).toBe('/tmp/custom-config');
  });

  it('exits with code 0 when validate succeeds', async () => {
    let exitCode: number | undefined;

    ValidateCommand.prototype.execute = async () => true;
    process.exit = ((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as typeof process.exit;

    const cli = createCli();
    await cli.parseAsync(['node', 'tuition', 'validate']);

    expect(exitCode).toBe(0);
  });

  it('exits with code 1 when validate fails', async () => {
    let exitCode: number | undefined;

    ValidateCommand.prototype.execute = async () => false;
    process.exit = ((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as typeof process.exit;

    const cli = createCli();
    await cli.parseAsync(['node', 'tuition', 'validate']);

    expect(exitCode).toBe(1);
  });

  it('dispatches backup restore with identifier and parsed flags', async () => {
    let receivedIdentifier = '';
    let receivedOptions: { dryRun?: boolean; force?: boolean; path?: string } = {};

    BackupCommand.prototype.restore = async (
      identifier: string,
      options: { dryRun?: boolean; force?: boolean; path?: string }
    ) => {
      receivedIdentifier = identifier;
      receivedOptions = options;
    };

    const cli = createCli();
    await cli.parseAsync([
      'node',
      'tuition',
      'backup',
      'restore',
      'my-backup.tar.gz',
      '--dry-run',
      '--force',
      '--path',
      '/tmp/restore-config',
    ]);

    expect(receivedIdentifier).toBe('my-backup.tar.gz');
    expect(receivedOptions.dryRun).toBe(true);
    expect(receivedOptions.force).toBe(true);
    expect(receivedOptions.path).toBe('/tmp/restore-config');
  });

  it('dispatches service logs with numeric tail parsing and follow flag', async () => {
    let receivedName = '';
    let receivedOptions: { tail?: number; follow?: boolean } = {};

    ServiceCommand.prototype.logs = async (
      name: string,
      options: { tail?: number; follow?: boolean; path?: string }
    ) => {
      receivedName = name;
      receivedOptions = options;
    };

    const cli = createCli();
    await cli.parseAsync([
      'node',
      'tuition',
      'service',
      'logs',
      'whoami',
      '--tail',
      '25',
      '--follow',
      '--path',
      '/tmp/service-config',
    ]);

    expect(receivedName).toBe('whoami');
    expect(receivedOptions.tail).toBe(25);
    expect(receivedOptions.follow).toBe(true);
  });
});
