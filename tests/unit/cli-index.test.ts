/**
 * CLI command registration tests
 */

import { describe, it, expect } from 'bun:test';
import type { Command } from 'commander';
import { createCli } from '../../src/cli/commands/index.js';

function findSubcommand(parent: Command, name: string): Command | undefined {
  return parent.commands.find(cmd => cmd.name() === name);
}

describe('CLI command registration', () => {
  it('registers expected top-level commands', () => {
    const cli = createCli();
    const names = cli.commands.map(command => command.name());

    expect(names).toContain('init');
    expect(names).toContain('validate');
    expect(names).toContain('config');
    expect(names).toContain('service');
    expect(names).toContain('caddy');
    expect(names).toContain('dns');
    expect(names).toContain('backup');
    expect(names).toContain('tui');
  });

  it('registers config subcommands', () => {
    const cli = createCli();
    const config = findSubcommand(cli, 'config');

    expect(config).toBeDefined();

    const names = config?.commands.map(command => command.name()) || [];
    expect(names).toContain('show');
    expect(names).toContain('set');
  });

  it('registers service lifecycle subcommands', () => {
    const cli = createCli();
    const service = findSubcommand(cli, 'service');

    expect(service).toBeDefined();

    const names = service?.commands.map(command => command.name()) || [];
    expect(names).toContain('list');
    expect(names).toContain('show');
    expect(names).toContain('enable');
    expect(names).toContain('disable');
    expect(names).toContain('start');
    expect(names).toContain('stop');
    expect(names).toContain('restart');
    expect(names).toContain('update');
    expect(names).toContain('logs');
    expect(names).toContain('search');
  });

  it('registers caddy, dns, and backup subcommands', () => {
    const cli = createCli();

    const caddy = findSubcommand(cli, 'caddy');
    expect(caddy).toBeDefined();
    const caddyNames = caddy?.commands.map(command => command.name()) || [];
    expect(caddyNames).toContain('start');
    expect(caddyNames).toContain('stop');
    expect(caddyNames).toContain('restart');
    expect(caddyNames).toContain('reload');
    expect(caddyNames).toContain('status');
    expect(caddyNames).toContain('regenerate');
    expect(caddyNames).toContain('hash-password');
    expect(caddyNames).toContain('set-password');

    const dns = findSubcommand(cli, 'dns');
    expect(dns).toBeDefined();
    const dnsNames = dns?.commands.map(command => command.name()) || [];
    expect(dnsNames).toContain('start');
    expect(dnsNames).toContain('stop');
    expect(dnsNames).toContain('status');
    expect(dnsNames).toContain('regenerate');
    expect(dnsNames).toContain('configure');

    const backup = findSubcommand(cli, 'backup');
    expect(backup).toBeDefined();
    const backupNames = backup?.commands.map(command => command.name()) || [];
    expect(backupNames).toContain('create');
    expect(backupNames).toContain('list');
    expect(backupNames).toContain('restore');
    expect(backupNames).toContain('delete');
  });

  it('registers key options on backup restore command', () => {
    const cli = createCli();
    const backup = findSubcommand(cli, 'backup');
    const restore = backup ? findSubcommand(backup, 'restore') : undefined;

    expect(restore).toBeDefined();

    const optionNames = restore?.options.map(option => option.long) || [];
    expect(optionNames).toContain('--dry-run');
    expect(optionNames).toContain('--force');
    expect(optionNames).toContain('--path');
  });
});
