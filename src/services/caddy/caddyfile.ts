/**
 * Caddyfile generator
 * Creates Caddy configuration from service definitions
 */

import type { ServiceDefinition, PortMapping } from '../../types/index.js';

export interface CaddyRoute {
  domain: string;
  service: string;
  port: number;
  tls: boolean;
  upstream: string;
}

export interface CaddyConfig {
  email: string;
  domain: string;
  dnsProvider: string;
  dnsCredentials: Record<string, string>;
  routes: CaddyRoute[];
  adminPasswordHash?: string;
}

export class CaddyfileGenerator {
  /**
   * Generate complete Caddyfile from configuration
   */
  generate(config: CaddyConfig): string {
    const lines: string[] = [];

    // Global options
    lines.push('# Tuition Caddyfile');
    lines.push('# Auto-generated - do not edit manually');
    lines.push('');
    lines.push(`{`);
    lines.push(`    admin 0.0.0.0:2019`);
    lines.push(`    email ${config.email}`);
    lines.push(`}`);
    lines.push('');

    // Wildcard certificate with DNS challenge
    lines.push(`*.${config.domain} {`);
    lines.push(`    tls {`);
    lines.push(`        dns ${config.dnsProvider} {`);
    
    // Add DNS credentials - use environment variable syntax
    if (config.dnsCredentials.api_token) {
      lines.push(`            api_token {env.CF_API_TOKEN}`);
    }
    
    lines.push(`        }`);
    lines.push(`    }`);
    lines.push(`}`);
    lines.push('');

    // Admin UI route
    lines.push(`tuition.${config.domain} {`);
    lines.push(`    basic_auth {`);
    if (config.adminPasswordHash) {
      lines.push(`        admin ${config.adminPasswordHash}`);
    } else {
      lines.push(`        # Admin UI password not configured`);
      lines.push(`        # Run: tuition caddy set-password`);
    }
    lines.push(`    }`);
    lines.push(`    reverse_proxy caddy:2019`);
    lines.push(`}`);
    lines.push('');

    // Service routes
    for (const route of config.routes) {
      lines.push(this.generateRoute(route, config.domain));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate route block for a service
   */
  private generateRoute(route: CaddyRoute, domain: string): string {
    const lines: string[] = [];
    
    lines.push(`${route.domain}.${domain} {`);
    lines.push(`    reverse_proxy ${route.upstream}:${route.port}`);
    
    // Add common headers
    lines.push(`    header {`);
    lines.push(`        X-Forwarded-For {remote_host}`);
    lines.push(`        X-Real-IP {remote_host}`);
    lines.push(`        X-Forwarded-Proto {scheme}`);
    lines.push(`    }`);
    
    lines.push(`}`);
    
    return lines.join('\n');
  }

  /**
   * Parse service labels to extract Caddy configuration
   */
  parseServiceLabels(service: ServiceDefinition): CaddyRoute | null {
    if (!service.labels) {
      return null;
    }

    const caddyDomain = service.labels['caddy'];
    if (!caddyDomain) {
      return null;
    }

    // Extract upstream from labels
    let upstream = service.name;
    let port = 80;

    const upstreamLabel = service.labels['caddy.reverse_proxy'];
    if (upstreamLabel) {
    // Parse {{upstreams PORT}} format
    const match = upstreamLabel.match(/\{\{upstreams\s+(\d+)\}\}/);
    if (match && match[1]) {
      port = parseInt(match[1], 10);
    }
    }

    // If service has ports defined, use the first container port
    if (service.ports && service.ports.length > 0) {
      const firstPort = service.ports[0];
      if (firstPort) {
        port = firstPort.container;
      }
    }

    // Remove ${DOMAIN} placeholder and preserve any separator dots
    const domain = caddyDomain.replace(/\$\{DOMAIN\}/g, '');

    return {
      domain,
      service: service.name,
      port,
      tls: true,
      upstream,
    };
  }

  /**
   * Extract all routes from list of services
   */
  extractRoutes(services: ServiceDefinition[]): CaddyRoute[] {
    const routes: CaddyRoute[] = [];

    for (const service of services) {
      const route = this.parseServiceLabels(service);
      if (route) {
        routes.push(route);
      }
    }

    return routes;
  }
}

// Export singleton
export const caddyfileGenerator = new CaddyfileGenerator();
