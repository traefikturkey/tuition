/**
 * Configuration validation
 */

import type { GlobalConfig, ServiceConfig } from '../../types/index.js';

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class ConfigValidator {
  /**
   * Validate global configuration
   */
  validateGlobal(config: GlobalConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!config.hostname || config.hostname.trim() === '') {
      errors.push({
        field: 'hostname',
        message: 'Hostname is required',
      });
    }

    if (!config.domain || config.domain.trim() === '') {
      errors.push({
        field: 'domain',
        message: 'Domain is required',
      });
    }

    if (!config.adminEmail || config.adminEmail.trim() === '') {
      errors.push({
        field: 'adminEmail',
        message: 'Admin email is required',
      });
    } else if (!this.isValidEmail(config.adminEmail)) {
      errors.push({
        field: 'adminEmail',
        message: 'Invalid email format',
        value: config.adminEmail,
      });
    }

    // Validate DNS provider settings
    if (config.dnsProvider === 'cloudflare' && !config.cloudflareToken) {
      errors.push({
        field: 'cloudflareToken',
        message: 'Cloudflare API token is required when using Cloudflare DNS',
      });
    }

    // Validate upstream DNS configuration
    if (!config.upstreamDns || !config.upstreamDns.primary) {
      errors.push({
        field: 'upstreamDns.primary',
        message: 'Primary DNS server is required',
      });
    } else if (!this.isValidIp(config.upstreamDns.primary)) {
      errors.push({
        field: 'upstreamDns.primary',
        message: 'Primary DNS server must be a valid IP address',
        value: config.upstreamDns.primary,
      });
    }

    if (config.upstreamDns?.backup && !this.isValidIp(config.upstreamDns.backup)) {
      errors.push({
        field: 'upstreamDns.backup',
        message: 'Backup DNS server must be a valid IP address',
        value: config.upstreamDns.backup,
      });
    }

    // Validate DNS cluster seed IPs when clustering is enabled
    if (config.dnsCluster?.enabled && config.dnsCluster.clusterSeeds) {
      for (const seed of config.dnsCluster.clusterSeeds) {
        if (!this.isValidIp(seed)) {
          errors.push({
            field: 'dnsCluster.clusterSeeds',
            message: 'Cluster seed must be a valid IP address',
            value: seed,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate service configuration
   */
  validateService(name: string, config: ServiceConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Service name validation
    if (!name || name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Service name is required',
      });
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
      errors.push({
        field: 'name',
        message: 'Service name must contain only lowercase letters, numbers, and hyphens',
        value: name,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate IP address format (IPv4 or IPv6)
   */
  private isValidIp(ip: string): boolean {
    // IPv4 regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}
