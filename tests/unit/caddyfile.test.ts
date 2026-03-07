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
      expect(caddyfile).toContain('api_token {env.CF_API_TOKEN}');
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

    it('should include admin password hash when configured', () => {
      const config = {
        email: 'admin@example.com',
        domain: 'example.com',
        dnsProvider: 'cloudflare',
        dnsCredentials: {},
        adminPasswordHash: 'hashed-password',
        routes: [],
      };

      const caddyfile = generator.generate(config);

      expect(caddyfile).toContain('admin hashed-password');
      expect(caddyfile).not.toContain('Admin UI password not configured');
      expect(caddyfile).not.toContain('tuition caddy set-password');
    });

    it('should include the admin password placeholder when no hash is configured', () => {
      const config = {
        email: 'admin@example.com',
        domain: 'example.com',
        dnsProvider: 'cloudflare',
        dnsCredentials: {},
        routes: [],
      };

      const caddyfile = generator.generate(config);

      expect(caddyfile).toContain('# Admin UI password not configured');
      expect(caddyfile).toContain('# Run: tuition caddy set-password');
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

    it('should return null when labels exist but the caddy label is missing', () => {
      const service: ServiceDefinition = {
        name: 'test',
        category: 'dns',
        description: 'Test service',
        image: 'test:latest',
        labels: {
          'caddy.reverse_proxy': '{{upstreams 8080}}',
        },
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

    it('should fall back to the first container port when ports are defined', () => {
      const service: ServiceDefinition = {
        name: 'jellyfin',
        category: 'media',
        description: 'Media server',
        image: 'jellyfin',
        ports: [{ host: 8096, container: 8096, protocol: 'tcp' }],
        labels: {
          caddy: 'jellyfin.${DOMAIN}',
        },
      };

      const route = generator.parseServiceLabels(service);

      expect(route?.port).toBe(8096);
      expect(route?.upstream).toBe('jellyfin');
    });

    it('should keep the default port when the upstream label does not match the expected template', () => {
      const service: ServiceDefinition = {
        name: 'grafana',
        category: 'monitoring',
        description: 'Dashboards',
        image: 'grafana/grafana',
        labels: {
          caddy: 'grafana.${DOMAIN}',
          'caddy.reverse_proxy': 'grafana:3000',
        },
      };

      const route = generator.parseServiceLabels(service);

      expect(route?.port).toBe(80);
      expect(route?.domain).toBe('grafana.');
    });

    it('should ignore sparse port entries and keep the parsed upstream port', () => {
      const service: ServiceDefinition = {
        name: 'prometheus',
        category: 'monitoring',
        description: 'Metrics',
        image: 'prom/prometheus',
        ports: [undefined as unknown as PortMapping],
        labels: {
          caddy: 'prometheus.${DOMAIN}',
          'caddy.reverse_proxy': '{{upstreams 9090}}',
        },
      };

      const route = generator.parseServiceLabels(service);

      expect(route?.port).toBe(9090);
      expect(route?.upstream).toBe('prometheus');
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
