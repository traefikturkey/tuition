/**
 * Caddy reverse proxy manager
 * Handles Caddy container lifecycle and configuration
 */

import { writeFile, readFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { caddyfileGenerator, type CaddyConfig, type CaddyRoute } from './caddyfile.js';
import { docker } from '../docker/client.js';
import { ComposeManager } from '../docker/compose.js';
import type { ServiceDefinition } from '../../types/index.js';

export class CaddyManager {
  private projectPath: string;
  private composeManager: ComposeManager;
  private caddyfilePath: string;
  private dataPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.composeManager = new ComposeManager(projectPath);
    this.caddyfilePath = join(projectPath, 'Caddyfile');
    this.dataPath = join(projectPath, 'caddy-data');
  }

  /**
   * Initialize Caddy infrastructure
   */
  async initialize(): Promise<void> {
    // Ensure data directories exist
    await mkdir(this.dataPath, { recursive: true });
    await mkdir(join(this.dataPath, 'config'), { recursive: true });
    await mkdir(join(this.dataPath, 'data'), { recursive: true });
    await mkdir(join(this.dataPath, 'logs'), { recursive: true });
  }

  /**
   * Generate and save Caddyfile for enabled services
   */
  async generateConfig(
    globalConfig: {
      domain: string;
      adminEmail: string;
      dnsProvider: string;
      cloudflareToken?: string;
    },
    enabledServices: ServiceDefinition[]
  ): Promise<string> {
    // Extract routes from service definitions
    const routes = caddyfileGenerator.extractRoutes(enabledServices);

    // Build Caddy configuration
    const caddyConfig: CaddyConfig = {
      email: globalConfig.adminEmail,
      domain: globalConfig.domain,
      dnsProvider: globalConfig.dnsProvider,
      dnsCredentials: globalConfig.cloudflareToken
        ? { api_token: globalConfig.cloudflareToken }
        : {},
      routes,
    };

    // Generate Caddyfile
    const caddyfile = caddyfileGenerator.generate(caddyConfig);

    // Write to disk
    await writeFile(this.caddyfilePath, caddyfile, 'utf-8');

    return caddyfile;
  }

  /**
   * Start Caddy container
   */
  async start(envVars: Record<string, string> = {}): Promise<{ success: boolean; message: string }> {
    // Check if Caddy is already running
    const container = await docker.getContainer('caddy');
    if (container && container.state === 'running') {
      return { success: true, message: 'Caddy is already running' };
    }

    // Ensure Docker network exists
    const networkExists = await docker.networkExists('tuition');
    if (!networkExists) {
      try {
        await docker.createNetwork('tuition');
      } catch (error) {
        return { 
          success: false, 
          message: `Failed to create Docker network: ${error}` 
        };
      }
    }

    // Generate compose file for Caddy
    await this.generateComposeFile();

    // Start via docker-compose with environment variables
    const result = await this.composeManager.up('caddy', { 
      detached: true,
      env: envVars 
    });

    if (result.success) {
      return { success: true, message: 'Caddy started successfully' };
    } else {
      return { success: false, message: `Failed to start Caddy: ${result.output}` };
    }
  }

  /**
   * Stop Caddy container
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    const result = await this.composeManager.down('caddy');

    if (result.success) {
      return { success: true, message: 'Caddy stopped' };
    } else {
      return { success: false, message: `Failed to stop Caddy: ${result.output}` };
    }
  }

  /**
   * Reload Caddy configuration without downtime
   */
  async reload(): Promise<{ success: boolean; message: string }> {
    // Try graceful reload via caddy API
    const result = await this.execCaddyCommand(['reload', '--config', '/etc/caddy/Caddyfile']);

    if (result.success) {
      return { success: true, message: 'Caddy configuration reloaded' };
    } else {
      // If reload fails, try restart
      return this.restart();
    }
  }

  /**
   * Restart Caddy container
   */
  async restart(): Promise<{ success: boolean; message: string }> {
    const stopResult = await this.stop();
    if (!stopResult.success) {
      return stopResult;
    }

    // Small delay for clean shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    return this.start();
  }

  /**
   * Get Caddy status
   */
  async status(): Promise<{
    running: boolean;
    configValid: boolean;
    routes: number;
  }> {
    const container = await docker.getContainer('caddy');
    const running = container !== null && container.state === 'running';

    // Count routes in Caddyfile
    let routes = 0;
    try {
      const caddyfile = await readFile(this.caddyfilePath, 'utf-8');
      // Count service blocks (lines ending with { that contain a dot for subdomain)
      const matches = caddyfile.match(/^\S+\.\S+\s*\{/gm);
      routes = matches ? matches.length - 1 : 0; // Subtract 1 for wildcard cert block
    } catch {
      // File doesn't exist
    }

    return {
      running,
      configValid: true, // Would need to validate via caddy CLI
      routes,
    };
  }

  /**
   * Generate docker-compose.yaml for Caddy
   */
  private async generateComposeFile(): Promise<void> {
    const compose = {
      services: {
        caddy: {
          image: 'iarekylew00t/caddy-cloudflare:latest',
          container_name: 'caddy',
          restart: 'unless-stopped',
          ports: [
            '80:80',
            '443:443',
            '443:443/udp', // HTTP/3
          ],
          volumes: [
            `${this.caddyfilePath}:/etc/caddy/Caddyfile:ro`,
            `${join(this.dataPath, 'config')}:/config`,
            `${join(this.dataPath, 'data')}:/data`,
            `${join(this.dataPath, 'logs')}:/var/log/caddy`,
          ],
          networks: ['tuition'],
          environment: {
            CF_API_TOKEN: '${CF_API_TOKEN}',
          },
          cap_add: ['NET_ADMIN'], // Required for HTTP/3
        },
      },
      networks: {
        tuition: {
          driver: 'bridge',
          external: true,
        },
      },
    };

    const { stringify: stringifyYaml } = await import('yaml');
    const yaml = stringifyYaml(compose);
    
    await writeFile(
      join(this.projectPath, 'caddy.docker-compose.yaml'),
      yaml,
      'utf-8'
    );
  }

  /**
   * Execute command in Caddy container
   */
  private async execCaddyCommand(args: string[]): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const proc = spawn('docker', ['exec', 'caddy', 'caddy', ...args], {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      proc.on('close', (code) => {
        const output = stdout + (stderr ? `\n${stderr}` : '');
        resolve({
          success: code === 0,
          output: output.trim(),
        });
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          output: error.message,
        });
      });
    });
  }
}
