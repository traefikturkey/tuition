/**
 * Lifecycle manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LifecycleManager } from '../../src/core/lifecycle/manager.js';
import { mkdtemp, rm, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LifecycleManager', () => {
  let tempDir: string;
  let manager: LifecycleManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-lifecycle-test-'));
    manager = new LifecycleManager(join(tempDir, 'config'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create required base directories', async () => {
      await manager.initialize();

      const dataDir = join(tempDir, 'data');
      const caddyDir = join(tempDir, 'caddy-data');
      const dnsDir = join(tempDir, 'coredns-config');

      const dataExists = await access(dataDir).then(() => true).catch(() => false);
      const caddyExists = await access(caddyDir).then(() => true).catch(() => false);
      const dnsExists = await access(dnsDir).then(() => true).catch(() => false);

      expect(dataExists).toBe(true);
      expect(caddyExists).toBe(true);
      expect(dnsExists).toBe(true);
    });
  });

  describe('getService', () => {
    it('should return null for unknown service', async () => {
      const service = await manager.getService('nonexistent-service');
      expect(service).toBeNull();
    });
  });

  describe('listAll', () => {
    it('should list available catalog services', async () => {
      const services = await manager.listAll();
      expect(services.length).toBeGreaterThan(0);
      expect(services.some(s => s.name === 'whoami')).toBe(true);
      expect(services.some(s => s.name === 'openspeedtest')).toBe(true);
      expect(services.some(s => s.name === 'webtop')).toBe(true);
    });
  });

  describe('enable', () => {
    it('should fail for service not in catalog', async () => {
      const result = await manager.enable('nonexistent-service', { autoStart: false });
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found in catalog');
    });

    it('should enable known service without autostart', async () => {
      await manager.initialize();
      const result = await manager.enable('whoami', { autoStart: false });
      expect(result.success).toBe(true);
      expect(result.message).toContain("enabled");
    });
  });
});
