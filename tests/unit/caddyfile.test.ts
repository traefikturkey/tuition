/**
 * Caddyfile generator tests
 */

import { describe, it, expect } from 'bun:test';
import { CaddyfileGenerator } from '../../src/services/caddy/caddyfile.js';
import type { ServiceDefinition, PortMapping } from '../../src/types/index.js';

describe('CaddyfileGenerator', () => {
  const generator = new CaddyfileGenerator();

  describe('generate', () => {
    it('should generate valid Caddyfile', () => {
      const config = {
        email: 'admin@example.com',
        domain: 'example.com',
        dnsProvider: 'cloudflare',
        dnsCredentials: { api_token: 'test-token' },
        routes: [
          {
            domain: 'pihole',
            service: 'pihole',
            port: 80,
            tls: true,
            upstream: 'pihole',
          },
        ],
      };

      const caddyfile = generator.generate(config);
      
      expect(caddyfile).toContain('admin@example.com');
      expect(caddyfile).toContain('*.example.com');
      expect(caddyfile).toContain('dns cloudflare');
      expect(caddyfile).toContain('api_token test-token');
      expect(caddyfile).toContain('pihole.example.com');
      expect(caddyfile).toContain('reverse_proxy pihole:80');
    });

    it('should include all routes', () => {
      const config = {
        email: 'admin@example.com',
        domain: 'example.com',
        dnsProvider: 'cloudflare',
        dnsCredentials: {},
        routes: [
          { domain: 'service1', service: 'svc1', port: 80, tls: true, upstream: 'svc1' },
          { domain: 'service2', service: 'svc2', port: 8080, tls: true, upstream: 'svc2' },
        ],
      };

      const caddyfile = generator.generate(config);
      
      expect(caddyfile).toContain('service1.example.com');
      expect(caddyfile).toContain('service2.example.com');
      expect(caddyfile).toContain('svc1:80');
      expect(caddyfile).toContain('svc2:8080');
    });
  });

  describe('parseServiceLabels', () => {
    it('should extract route from caddy label', () => {
      const service: ServiceDefinition = {
        name: 'pihole',
        category: 'dns',
        description: 'DNS server',
        image: 'pihole/pihole',
        ports: [{ host: 80, container: 80, protocol: 'tcp' }],
        labels: {
          caddy: 'pihole.${DOMAIN}',
          'caddy.reverse_proxy': '{{upstreams 80}}',
        },
      };

      const route = generator.parseServiceLabels(service);
      
      expect(route).not.toBeNull();
      expect(route?.domain).toBe('pihole.'); // ${DOMAIN} placeholder is stripped
      expect(route?.service).toBe('pihole');
      expect(route?.port).toBe(80);
      expect(route?.upstream).toBe('pihole');
    });

    it('should return null when no caddy label exists', () => {
      const service: ServiceDefinition = {
        name: 'test',
        category: 'dns',
        description: 'Test service',
        image: 'test:latest',
      };

      const route = generator.parseServiceLabels(service);
      expect(route).toBeNull();
    });

    it('should extract port from upstream label', () => {
      const service: ServiceDefinition = {
        name: 'plex',
        category: 'media',
        description: 'Media server',
        image: 'plex',
        ports: [{ host: 32400, container: 32400, protocol: 'tcp' }],
        labels: {
          caddy: 'plex.${DOMAIN}',
          'caddy.reverse_proxy': '{{upstreams 32400}}',
        },
      };

      const route = generator.parseServiceLabels(service);
      expect(route?.port).toBe(32400);
    });
  });

  describe('extractRoutes', () => {
    it('should extract routes from multiple services', () => {
      const services: ServiceDefinition[] = [
        {
          name: 'pihole',
          category: 'dns',
          description: 'DNS',
          image: 'pihole',
          labels: { caddy: 'pihole.${DOMAIN}', 'caddy.reverse_proxy': '{{upstreams 80}}' },
        },
        {
          name: 'plex',
          category: 'media',
          description: 'Media',
          image: 'plex',
          labels: { caddy: 'plex.${DOMAIN}', 'caddy.reverse_proxy': '{{upstreams 32400}}' },
        },
        {
          name: 'nodns',
          category: 'dns',
          description: 'No DNS',
          image: 'other',
        },
      ];

      const routes = generator.extractRoutes(services);
      
      expect(routes).toHaveLength(2);
      expect(routes[0]?.service).toBe('pihole');
      expect(routes[1]?.service).toBe('plex');
    });

    it('should return empty array for no services with labels', () => {
      const services: ServiceDefinition[] = [
        {
          name: 'test1',
          category: 'dns',
          description: 'Test',
          image: 'test',
        },
      ];

      const routes = generator.extractRoutes(services);
      expect(routes).toHaveLength(0);
    });
  });
});
