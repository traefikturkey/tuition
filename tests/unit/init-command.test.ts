/**
 * Init command tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { InitCommand } from '../../src/cli/commands/init.js';
import { ConfigManager } from '../../src/core/config/manager.js';

describe('InitCommand', () => {
  let tempDir: string;
  let configPath: string;
  let captured: string[];
  let originalLog: typeof console.log;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-init-command-test-'));
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

  it('returns early when already initialized', async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: 'existing-host',
      domain: 'example.com',
      adminEmail: 'admin@example.com',
      timezone: 'UTC',
      puid: 1000,
      pgid: 1000,
      dnsProvider: 'cloudflare',
      cloudflareToken: 'token',
      upstreamDns: {
        primary: '1.1.1.1',
      },
    });

    const command = new InitCommand();
    await command.execute({ path: configPath });

    const output = captured.join('\n');
    expect(output).toContain('already initialized');
  });

  it('initializes config and generates coredns config with valid prompted data', async () => {
    const command = new InitCommand();
    const commandMock = command as unknown as {
      promptForConfig: () => Promise<{
        hostname: string;
        domain: string;
        adminEmail: string;
        timezone: string;
        puid: number;
        pgid: number;
        dnsProvider: 'cloudflare';
        cloudflareToken: string;
        upstreamDns: {
          primary: string;
          backup?: string;
        };
      }>;
    };

    commandMock.promptForConfig = async () => ({
      hostname: 'new-host',
      domain: 'example.com',
      adminEmail: 'admin@example.com',
      timezone: 'UTC',
      puid: 1000,
      pgid: 1000,
      dnsProvider: 'cloudflare',
      cloudflareToken: 'token-123',
      upstreamDns: {
        primary: '1.1.1.1',
        backup: '1.0.0.1',
      },
    });

    await command.execute({ path: configPath });

    const manager = new ConfigManager(configPath);
    const loaded = await manager.loadGlobal();
    expect(loaded.hostname).toBe('new-host');
    expect(loaded.domain).toBe('example.com');

    const corednsCorefile = join(tempDir, 'coredns-config', 'Corefile');
    const exists = await access(corednsCorefile).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const output = captured.join('\n');
    expect(output).toContain('initialized successfully');
  });

  it('shows validation failure and does not save invalid config', async () => {
    const command = new InitCommand();
    const commandMock = command as unknown as {
      promptForConfig: () => Promise<{
        hostname: string;
        domain: string;
        adminEmail: string;
        timezone: string;
        puid: number;
        pgid: number;
        dnsProvider: 'cloudflare';
        cloudflareToken: string;
        upstreamDns: {
          primary: string;
        };
      }>;
    };

    commandMock.promptForConfig = async () => ({
      hostname: 'host',
      domain: 'example.com',
      adminEmail: 'invalid-email',
      timezone: 'UTC',
      puid: 1000,
      pgid: 1000,
      dnsProvider: 'cloudflare',
      cloudflareToken: 'token-123',
      upstreamDns: {
        primary: '999.999.999.999',
      },
    });

    await command.execute({ path: configPath });

    const manager = new ConfigManager(configPath);
    const exists = await manager.exists();
    expect(exists).toBe(false);

    const output = captured.join('\n');
    expect(output).toContain('Configuration validation failed');
  });
});
