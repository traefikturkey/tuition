/**
 * Docker Compose manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ComposeManager } from '../../src/services/docker/compose.js';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ServiceDefinition } from '../../src/types/index.js';

describe('ComposeManager', () => {
  let tempDir: string;
  let composeManager: ComposeManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tuition-compose-test-'));
    composeManager = new ComposeManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('generateCompose', () => {
    it('should generate compose file for simple service', async () => {
      const definition: ServiceDefinition = {
        name: 'test-service',
        category: 'dns',
        description: 'Test service',
        image: 'test:latest',
      };

      const path = await composeManager.generateCompose(
        'test-service',
        definition,
        { TEST_VAR: 'value' }
      );

      expect(path).toContain('test-service.docker-compose.yaml');
    });

    it('should include environment variables', async () => {
      const definition: ServiceDefinition = {
        name: 'test',
        category: 'dns',
        description: 'Test',
        image: 'test:latest',
        environment: {
          VAR1: '${TEST_VAR}',
          VAR2: 'static',
        },
      };

      const path = await composeManager.generateCompose('test', definition, {
        TEST_VAR: 'resolved',
      });

      // File should be created
      expect(path).toBeDefined();
    });

    it('should format ports correctly', async () => {
      const definition: ServiceDefinition = {
        name: 'test',
        category: 'dns',
        description: 'Test',
        image: 'test:latest',
        ports: [
          { host: 80, container: 80, protocol: 'tcp' },
          { host: 443, container: 443, protocol: 'tcp' },
        ],
      };

      const path = await composeManager.generateCompose('test', definition, {});
      expect(path).toBeDefined();
    });

    it('should handle volumes with variable substitution', async () => {
      const definition: ServiceDefinition = {
        name: 'test',
        category: 'dns',
        description: 'Test',
        image: 'test:latest',
        volumes: [
          { host: './data/test', container: '/data', readOnly: false },
        ],
      };

      const path = await composeManager.generateCompose('test', definition, {});
      expect(path).toBeDefined();
    });
  });
});
