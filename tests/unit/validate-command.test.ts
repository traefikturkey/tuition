/**
 * Validate command tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ValidateCommand } from '../../src/cli/commands/validate.js';
import { ConfigManager } from '../../src/core/config/manager.js';

describe('ValidateCommand', () => {
  let tempDir: string;
  let configPath: string;
  let captured: string[];
  let originalLog: typeof console.log;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-validate-command-test-'));
    configPath = join(tempDir, 'config');

    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };
  });

  afterEach(async () => {
    console.log = originalLog;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns false when tuition is not initialized', async () => {
    const command = new ValidateCommand();

    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join('\n')).toContain('Tuition is not initialized');
  });

  it('returns true for valid global config with no services', async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: 'test-host',
      domain: 'example.com',
      adminEmail: 'admin@example.com',
      timezone: 'UTC',
      puid: 1000,
      pgid: 1000,
      dnsProvider: 'cloudflare',
      cloudflareToken: 'cf-token',
      upstreamDns: {
        primary: '1.1.1.1',
        backup: '1.0.0.1',
      },
    });

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(true);
    expect(captured.join('\n')).toContain('All configurations are valid');
  });

  it('returns false for invalid global config', async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: 'test-host',
      domain: 'example.com',
      adminEmail: 'not-an-email',
      timezone: 'UTC',
      puid: 1000,
      pgid: 1000,
      dnsProvider: 'cloudflare',
      cloudflareToken: 'cf-token',
      upstreamDns: {
        primary: '999.999.999.999',
      },
    });

    const command = new ValidateCommand();
    const result = await command.execute({ path: configPath });

    expect(result).toBe(false);
    expect(captured.join('\n')).toContain('Global configuration has errors');
  });
});
