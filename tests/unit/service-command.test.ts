/**
 * Service command tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ServiceCommand } from '../../src/cli/commands/service.js';

describe('ServiceCommand', () => {
  let captured: string[];
  let originalLog: typeof console.log;
  let command: ServiceCommand;

  beforeEach(() => {
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };

    command = new ServiceCommand();
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('shows not found message when service does not exist', async () => {
    (command as unknown as { lifecycle: { initialize: () => Promise<void>; getService: () => Promise<null> } }).lifecycle = {
      initialize: async () => undefined,
      getService: async () => null,
    };

    await command.show('nope', {});

    const output = captured.join('\n');
    expect(output).toContain("Service 'nope' not found");
  });

  it('prints success message when enable succeeds', async () => {
    (command as unknown as { lifecycle: { initialize: () => Promise<void>; enable: () => Promise<{ success: boolean; message: string }> } }).lifecycle = {
      initialize: async () => undefined,
      enable: async () => ({ success: true, message: 'Service enabled' }),
    };

    await command.enable('whoami', {});

    const output = captured.join('\n');
    expect(output).toContain('Service enabled');
  });

  it('prints failure message when stop fails', async () => {
    (command as unknown as { lifecycle: { initialize: () => Promise<void>; stop: () => Promise<{ success: boolean; message: string }> } }).lifecycle = {
      initialize: async () => undefined,
      stop: async () => ({ success: false, message: 'Stop failed' }),
    };

    await command.stop('whoami', {});

    const output = captured.join('\n');
    expect(output).toContain('Stop failed');
  });
});
