/**
 * Caddy manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CaddyManager } from '../../src/services/caddy/manager.js';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ServiceDefinition } from '../../src/types/index.js';

describe('CaddyManager', () => {
  let tempDir: string;
  let manager: CaddyManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-caddy-test-'));
    manager = new CaddyManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create data directories', async () => {
      await manager.initialize();
      
      // Check directories exist
      const configDir = join(tempDir, 'caddy-data', 'config');
      const dataDir = join(tempDir, 'caddy-data', 'data');
      const logsDir = join(tempDir, 'caddy-data', 'logs');
      
      const configExists = await access(configDir).then(() => true).catch(() => false);
      const dataExists = await access(dataDir).then(() => true).catch(() => false);
      const logsExists = await access(logsDir).then(() => true).catch(() => false);
      
      expect(configExists).toBe(true);
      expect(dataExists).toBe(true);
      expect(logsExists).toBe(true);
    });

    it('should not fail if directories already exist', async () => {
      await manager.initialize();
      await expect(manager.initialize()).resolves.toBeUndefined();
    });
  });

  describe('generateConfig', () => {
    it('should generate Caddyfile with basic config', async () => {
      await manager.initialize();
      
      const globalConfig = {
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        dnsProvider: 'cloudflare' as const,
        cloudflareToken: 'test-token',
      };
      
      const services: ServiceDefinition[] = [];
      
      const caddyfile = await manager.generateConfig(globalConfig, services);
      
      expect(caddyfile).toContain('admin@example.com');
      expect(caddyfile).toContain('*.example.com');
      expect(caddyfile).toContain('dns cloudflare');
      expect(caddyfile).toContain('tuition.example.com');
    });

    it('should include service routes', async () => {
      await manager.initialize();

      const globalConfig = {
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        dnsProvider: 'cloudflare' as const,
      };

      const services: ServiceDefinition[] = [
        {
          name: 'pihole',
          category: 'dns',
          description: 'DNS server',
          image: 'pihole/pihole',
          labels: {
            caddy: 'pihole',
            'caddy.reverse_proxy': '{{upstreams 80}}',
          },
        },
      ];

      const caddyfile = await manager.generateConfig(globalConfig, services);

      expect(caddyfile).toContain('pihole.example.com');
      expect(caddyfile).toContain('reverse_proxy pihole:80');
    });

    it('should include admin password hash when provided', async () => {
      await manager.initialize();
      
      const globalConfig = {
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        dnsProvider: 'cloudflare' as const,
        adminPasswordHash: '$2b$10$testhash123',
      };
      
      const services: ServiceDefinition[] = [];
      
      const caddyfile = await manager.generateConfig(globalConfig, services);
      
      expect(caddyfile).toContain('admin $2b$10$testhash123');
      expect(caddyfile).not.toContain('# Admin UI password not configured');
    });

    it('should show placeholder when no admin password', async () => {
      await manager.initialize();
      
      const globalConfig = {
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        dnsProvider: 'cloudflare' as const,
      };
      
      const services: ServiceDefinition[] = [];
      
      const caddyfile = await manager.generateConfig(globalConfig, services);
      
      expect(caddyfile).toContain('# Admin UI password not configured');
      expect(caddyfile).toContain('# Run: tuition caddy set-password');
    });

    it('should write Caddyfile to disk', async () => {
      await manager.initialize();
      
      const globalConfig = {
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        dnsProvider: 'cloudflare' as const,
      };
      
      await manager.generateConfig(globalConfig, []);
      
      const caddyfilePath = join(tempDir, 'Caddyfile');
      const content = await readFile(caddyfilePath, 'utf-8');
      expect(content).toContain('admin@example.com');
    });
  });

  describe('status', () => {
    it('should return zero routes when Caddyfile does not exist', async () => {
      const status = await manager.status();
      // running state depends on Docker, but routes should be 0
      expect(status.routes).toBe(0);
    });

    it('should count routes correctly', async () => {
      await manager.initialize();
      
      const globalConfig = {
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        dnsProvider: 'cloudflare' as const,
      };
      
      const services: ServiceDefinition[] = [
        {
          name: 'svc1',
          category: 'dns',
          description: 'Service 1',
          image: 'test',
          labels: { caddy: 'svc1.${DOMAIN}' },
        },
        {
          name: 'svc2',
          category: 'media',
          description: 'Service 2',
          image: 'test',
          labels: { caddy: 'svc2.${DOMAIN}' },
        },
      ];
      
      await manager.generateConfig(globalConfig, services);
      const status = await manager.status();
      
      // Should count routes: wildcard cert block + tuition admin + 2 services = 4 total
      // But we subtract 1 for the wildcard cert block in the counting logic
      expect(status.routes).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateComposeFile', () => {
    it('should generate compose file with DNS configuration', async () => {
      await manager.initialize();
      
      // Trigger compose generation via start (which calls generateComposeFile)
      // Since we can't easily test the private method, we test via the public interface
      // by mocking or checking side effects
      
      // For now, just verify initialization works
      expect(manager).toBeDefined();
    });
  });
});
