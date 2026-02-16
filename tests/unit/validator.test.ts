/**
 * Configuration validator tests
 */

import { describe, it, expect } from 'bun:test';
import { ConfigValidator } from '../../src/core/config/validator.js';
import type { GlobalConfig } from '../../src/types/index.js';

describe('ConfigValidator', () => {
  const validator = new ConfigValidator();

  describe('validateGlobal', () => {
    it('should validate correct configuration', () => {
      const config: GlobalConfig = {
        hostname: 'test-server',
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        timezone: 'UTC',
        puid: 1000,
        pgid: 1000,
        dnsProvider: 'cloudflare',
        cloudflareToken: 'test-token',
        upstreamDns: {
          primary: '8.8.8.8',
          backup: '8.8.4.4',
        },
      };

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on missing hostname', () => {
      const config = {
        hostname: '',
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        timezone: 'UTC',
        puid: 1000,
        pgid: 1000,
        dnsProvider: 'cloudflare',
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'hostname')).toBe(true);
    });

    it('should fail on missing domain', () => {
      const config = {
        hostname: 'test',
        domain: '',
        adminEmail: 'admin@example.com',
        timezone: 'UTC',
        puid: 1000,
        pgid: 1000,
        dnsProvider: 'cloudflare',
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'domain')).toBe(true);
    });

    it('should fail on invalid email', () => {
      const config = {
        hostname: 'test',
        domain: 'example.com',
        adminEmail: 'invalid-email',
        timezone: 'UTC',
        puid: 1000,
        pgid: 1000,
        dnsProvider: 'cloudflare',
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'adminEmail')).toBe(true);
    });

    it('should fail on missing Cloudflare token when using Cloudflare', () => {
      const config = {
        hostname: 'test',
        domain: 'example.com',
        adminEmail: 'admin@example.com',
        timezone: 'UTC',
        puid: 1000,
        pgid: 1000,
        dnsProvider: 'cloudflare',
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'cloudflareToken')).toBe(true);
    });
  });

  describe('validateService', () => {
    it('should validate correct service name', () => {
      const result = validator.validateService('valid-service', { enabled: true });
      expect(result.valid).toBe(true);
    });

    it('should fail on empty service name', () => {
      const result = validator.validateService('', { enabled: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should fail on invalid characters in service name', () => {
      const result = validator.validateService('Invalid_Name', { enabled: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should fail on uppercase letters in service name', () => {
      const result = validator.validateService('TestService', { enabled: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should accept service names with hyphens', () => {
      const result = validator.validateService('my-service', { enabled: true });
      expect(result.valid).toBe(true);
    });

    it('should accept service names with numbers', () => {
      const result = validator.validateService('service-123', { enabled: true });
      expect(result.valid).toBe(true);
    });
  });
});
