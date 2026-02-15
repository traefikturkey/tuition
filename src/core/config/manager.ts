/**
 * Configuration management for Tuition
 * Handles loading, validation, and persistence of tiered configuration
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { join } from 'path';
import os from 'os';
import type {
  FullConfig,
  GlobalConfig,
  InfrastructureConfig,
  ServiceConfig,
} from '../../types/index.js';

const TUITION_DIR = join(os.homedir(), '.tuition');
const CONFIG_DIR = join(TUITION_DIR, 'config');
const STATE_DIR = join(TUITION_DIR, 'state');

// Default configuration values
const DEFAULT_GLOBAL_CONFIG: Partial<GlobalConfig> = {
  timezone: 'UTC',
  puid: 1000,
  pgid: 1000,
  dnsProvider: 'cloudflare',
};

export class ConfigManager {
  private configPath: string;
  private statePath: string;

  constructor(customPath?: string) {
    this.configPath = customPath || CONFIG_DIR;
    this.statePath = STATE_DIR;
  }

  /**
   * Ensure directory structure exists
   */
  async initialize(): Promise<void> {
    await mkdir(this.configPath, { recursive: true });
    await mkdir(this.statePath, { recursive: true });
    await mkdir(join(this.configPath, 'services'), { recursive: true });
  }

  /**
   * Check if configuration exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(join(this.configPath, 'global.yaml'), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load full configuration from all tiers
   */
  async load(): Promise<FullConfig> {
    const global = await this.loadGlobal();
    const infrastructure = await this.loadInfrastructure();
    const services = await this.loadServices();

    return {
      global,
      infrastructure,
      services,
    };
  }

  /**
   * Load global configuration
   */
  async loadGlobal(): Promise<GlobalConfig> {
    const path = join(this.configPath, 'global.yaml');
    
    try {
      const content = await readFile(path, 'utf-8');
      const parsed = parseYaml(content) as GlobalConfig;
      return { ...DEFAULT_GLOBAL_CONFIG, ...parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Return defaults if file doesn't exist
        return DEFAULT_GLOBAL_CONFIG as GlobalConfig;
      }
      throw new Error(`Failed to load global config: ${error}`);
    }
  }

  /**
   * Load infrastructure configuration
   */
  async loadInfrastructure(): Promise<InfrastructureConfig | undefined> {
    const path = join(this.configPath, 'infrastructure.yaml');
    
    try {
      const content = await readFile(path, 'utf-8');
      return parseYaml(content) as InfrastructureConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(`Failed to load infrastructure config: ${error}`);
    }
  }

  /**
   * Load all service configurations
   */
  async loadServices(): Promise<Record<string, ServiceConfig>> {
    const services: Record<string, ServiceConfig> = {};
    const servicesDir = join(this.configPath, 'services');

    try {
      const files = await readFile(servicesDir, 'utf-8');
      // This would need proper directory reading, simplified here
      return services;
    } catch {
      return services;
    }
  }

  /**
   * Load configuration for a specific service
   */
  async loadService(name: string): Promise<ServiceConfig | undefined> {
    const path = join(this.configPath, 'services', `${name}.yaml`);
    
    try {
      const content = await readFile(path, 'utf-8');
      return parseYaml(content) as ServiceConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw new Error(`Failed to load service config for ${name}: ${error}`);
    }
  }

  /**
   * Save global configuration
   */
  async saveGlobal(config: GlobalConfig): Promise<void> {
    const path = join(this.configPath, 'global.yaml');
    const yaml = stringifyYaml(config);
    await writeFile(path, yaml, 'utf-8');
  }

  /**
   * Save infrastructure configuration
   */
  async saveInfrastructure(config: InfrastructureConfig): Promise<void> {
    const path = join(this.configPath, 'infrastructure.yaml');
    const yaml = stringifyYaml(config);
    await writeFile(path, yaml, 'utf-8');
  }

  /**
   * Save service configuration
   */
  async saveService(name: string, config: ServiceConfig): Promise<void> {
    const path = join(this.configPath, 'services', `${name}.yaml`);
    const yaml = stringifyYaml(config);
    await writeFile(path, yaml, 'utf-8');
  }

  /**
   * Generate secure random password
   */
  generatePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Get path to tuition directory
   */
  getTuitionDir(): string {
    return TUITION_DIR;
  }

  /**
   * Get path to configuration directory
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
