/**
 * CoreDNS manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CoreDnsManager } from '../../src/services/dns/coredns.js';
import { mkdtemp, rm, readFile, access, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ServiceDefinition } from '../../src/types/index.js';

describe('CoreDnsManager', () => {
  let tempDir: string;
  let manager: CoreDnsManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-coredns-test-'));
    manager = new CoreDnsManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create config and data directories', async () => {
      await manager.initialize();

      const configDir = join(tempDir, 'coredns-config');
      const dataDir = join(tempDir, 'coredns-data');

      // Check directories exist (access returns undefined/null on success)
      const configExists = await access(configDir).then(() => true).catch(() => false);
      const dataExists = await access(dataDir).then(() => true).catch(() => false);

      expect(configExists).toBe(true);
      expect(dataExists).toBe(true);
    });

    it('should not fail if directories already exist', async () => {
      await manager.initialize();
      await expect(manager.initialize()).resolves.toBeUndefined();
    });
  });

  describe('generateConfig', () => {
    it('should generate Corefile with default upstream DNS', async () => {
      await manager.initialize();
      
      const services: ServiceDefinition[] = [];
      const corefile = await manager.generateConfig(services);
      
      expect(corefile).toContain('# Tuition CoreDNS Configuration');
      expect(corefile).toContain('forward . 8.8.8.8 8.8.4.4');
      expect(corefile).toContain('health_check 5s');
      expect(corefile).toContain('cache 30');
    });

    it('should use custom upstream DNS when provided', async () => {
      await manager.initialize();
      
      const services: ServiceDefinition[] = [];
      const upstreamDns = {
        primary: '1.1.1.1',
        backup: '1.0.0.1',
      };
      
      const corefile = await manager.generateConfig(services, {}, upstreamDns);
      
      expect(corefile).toContain('forward . 1.1.1.1 1.0.0.1');
    });

    it('should generate hosts file with static entries', async () => {
      await manager.initialize();
      
      const staticHosts = {
        'test.example.com': '10.0.0.1',
        'another.example.com': '10.0.0.2',
      };
      
      await manager.generateConfig([], staticHosts);
      
      const hostsPath = join(tempDir, 'coredns-config', 'hosts');
      const hostsContent = await readFile(hostsPath, 'utf-8');
      
      expect(hostsContent).toContain('10.0.0.1 test.example.com');
      expect(hostsContent).toContain('10.0.0.2 another.example.com');
    });

    it('should include service entries in hosts file', async () => {
      await manager.initialize();
      
      const services: ServiceDefinition[] = [
        {
          name: 'pihole',
          category: 'dns',
          description: 'DNS server',
          image: 'pihole/pihole',
          labels: { 'dns.hostname': 'dns.internal' },
        },
      ];
      
      await manager.generateConfig(services);
      
      const hostsPath = join(tempDir, 'coredns-config', 'hosts');
      const hostsContent = await readFile(hostsPath, 'utf-8');
      
      expect(hostsContent).toContain('# dns.internal -> pihole (resolved by Docker)');
    });
  });

  describe('status', () => {
    it('should return hosts count from file', async () => {
      await manager.initialize();

      // Create a hosts file with entries
      const hostsContent = `10.0.0.1 test1.example.com
10.0.0.2 test2.example.com
# This is a comment
`;
      await writeFile(
        join(tempDir, 'coredns-config', 'hosts'),
        hostsContent,
        'utf-8'
      );

      const status = await manager.status();
      expect(status.hosts).toBe(2); // Only the two non-comment lines
    });

    it('should return zero hosts when no hosts file exists', async () => {
      await manager.initialize();

      const status = await manager.status();
      expect(status.hosts).toBe(0);
    });

    it('should return zero hosts when no hosts file exists', async () => {
      await manager.initialize();
      
      const status = await manager.status();
      expect(status.hosts).toBe(0);
    });

    it('should count hosts from hosts file', async () => {
      await manager.initialize();
      
      // Create a hosts file with entries
      const hostsContent = `10.0.0.1 test1.example.com
10.0.0.2 test2.example.com
# This is a comment
`;
      await writeFile(
        join(tempDir, 'coredns-config', 'hosts'),
        hostsContent,
        'utf-8'
      );
      
      const status = await manager.status();
      expect(status.hosts).toBe(2); // Only the two non-comment lines
    });
  });
});
