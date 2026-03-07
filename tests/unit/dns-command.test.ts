/**
 * DNS command tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DnsCommand } from '../../src/cli/commands/dns.js';

describe('DnsCommand', () => {
  let captured: string[];
  let originalLog: typeof console.log;
  let command: DnsCommand;

  beforeEach(() => {
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };

    command = new DnsCommand();
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

  it('passes upstream DNS config to generator on start', async () => {
    let receivedUpstreamDns: { primary: string; backup?: string } | undefined;

    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        exists: () => Promise<boolean>;
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{
          upstreamDns: {
            primary: string;
            backup?: string;
          };
        }>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        start: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      exists: async () => true,
      loadServices: async () => ({}),
      loadGlobal: async () => ({
        upstreamDns: {
          primary: '1.1.1.1',
          backup: '1.0.0.1',
        },
      }),
    };
    commandMock.dns = {
      generateConfig: async (_enabledServices, _staticHosts, upstreamDns) => {
        receivedUpstreamDns = upstreamDns;
      },
      start: async () => ({ success: true, message: 'CoreDNS started successfully' }),
    };

    await command.start({});

    expect(receivedUpstreamDns?.primary).toBe('1.1.1.1');
    expect(receivedUpstreamDns?.backup).toBe('1.0.0.1');

    const output = captured.join('\n');
    expect(output).toContain('CoreDNS started successfully');
  });

  it('shows reload failure message during regenerate', async () => {
    const commandMock = command as unknown as {
      initialize: () => Promise<void>;
      config: {
        loadServices: () => Promise<Record<string, { enabled: boolean }>>;
        loadGlobal: () => Promise<{ upstreamDns: { primary: string; backup?: string } }>;
      };
      dns: {
        generateConfig: (
          enabledServices: unknown[],
          staticHosts: Record<string, string>,
          upstreamDns?: { primary: string; backup?: string }
        ) => Promise<void>;
        reload: () => Promise<{ success: boolean; message: string }>;
      };
    };

    commandMock.initialize = async () => undefined;
    commandMock.config = {
      loadServices: async () => ({}),
      loadGlobal: async () => ({
        upstreamDns: { primary: '8.8.8.8' },
      }),
    };
    commandMock.dns = {
      generateConfig: async () => undefined,
      reload: async () => ({ success: false, message: 'reload failed' }),
    };

    await command.regenerate({});

    const output = captured.join('\n');
    expect(output).toContain('Failed to reload: reload failed');
  });
});
