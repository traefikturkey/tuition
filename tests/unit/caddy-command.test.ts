/**
 * Caddy command tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CaddyCommand } from '../../src/cli/commands/caddy.js';

describe('CaddyCommand', () => {
  let captured: string[];
  let originalLog: typeof console.log;
  let command: CaddyCommand;

  beforeEach(() => {
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };

    command = new CaddyCommand();
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('shows not initialized message when start is called before init', async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: { exists: () => Promise<boolean> };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => false,
    };

    await command.start({});

    const output = captured.join('\n');
    expect(output).toContain('Tuition is not initialized');
  });

  it('passes cloudflare token as CF_API_TOKEN when starting caddy', async () => {
    let receivedEnv: Record<string, string> | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadGlobal: () => Promise<{
          domain: string;
          hostname: string;
          timezone: string;
          puid: number;
          pgid: number;
          cloudflareToken?: string;
        }>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
      };
      caddy: {
        generateConfig: (config: unknown, services: unknown[]) => Promise<void>;
        start: (env: Record<string, string>) => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadGlobal: async () => ({
        domain: 'example.com',
        hostname: 'host',
        timezone: 'UTC',
        puid: 1000,
        pgid: 1000,
        cloudflareToken: 'token-123',
      }),
      loadServices: async () => ({}),
    };
    commandMock.caddy = {
      generateConfig: async () => undefined,
      start: async (env) => {
        receivedEnv = env;
        return { success: true, message: 'Caddy started successfully' };
      },
    };

    await command.start({});

    expect(receivedEnv).toBeDefined();
    expect(receivedEnv?.CF_API_TOKEN).toBe('token-123');

    const output = captured.join('\n');
    expect(output).toContain('Caddy started successfully');
  });

  it('shows failure output when stop fails', async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      caddy: {
        stop: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.caddy = {
      stop: async () => ({ success: false, message: 'failed to stop caddy' }),
    };

    await command.stop({});

    const output = captured.join('\n');
    expect(output).toContain('failed to stop caddy');
  });
});
