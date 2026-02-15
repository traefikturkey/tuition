/**
 * CoreDNS manager for internal DNS resolution
 * Provides zero-configuration DNS for containers
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import { ComposeManager } from '../docker/compose.js';
import { docker } from '../docker/client.js';
import type { ServiceDefinition } from '../../types/index.js';

export interface DnsRecord {
  hostname: string;
  ip: string;
  type: 'A' | 'AAAA' | 'CNAME';
  source: 'container' | 'static';
  containerId?: string;
}

export class CoreDnsManager {
  private projectPath: string;
  private composeManager: ComposeManager;
  private configPath: string;
  private dataPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.composeManager = new ComposeManager(projectPath);
    this.configPath = join(projectPath, 'coredns-config');
    this.dataPath = join(projectPath, 'coredns-data');
  }

  /**
   * Initialize CoreDNS directories
   */
  async initialize(): Promise<void> {
    await mkdir(this.configPath, { recursive: true });
    await mkdir(this.dataPath, { recursive: true });
  }

  /**
   * Generate Corefile from enabled services
   */
  async generateConfig(
    enabledServices: ServiceDefinition[],
    staticHosts: Record<string, string> = {}
  ): Promise<string> {
    const corefile = this.buildCorefile(enabledServices, staticHosts);
    
    await writeFile(
      join(this.configPath, 'Corefile'),
      corefile,
      'utf-8'
    );

    // Generate hosts file from container labels
    const hosts = this.buildHostsFile(enabledServices, staticHosts);
    await writeFile(
      join(this.configPath, 'hosts'),
      hosts,
      'utf-8'
    );

    return corefile;
  }

  /**
   * Build CoreDNS Corefile
   */
  private buildCorefile(
    services: ServiceDefinition[],
    staticHosts: Record<string, string>
  ): string {
    const lines: string[] = [];

    lines.push('# Tuition CoreDNS Configuration');
    lines.push('# Auto-generated - do not edit manually');
    lines.push('');
    lines.push('. {');
    lines.push('    # Hosts file for static and container entries');
    lines.push('    hosts {');
    lines.push(`        fallthrough`);
    lines.push('    }');
    lines.push('');
    lines.push('    # Forward to external DNS');
    lines.push('    forward . 8.8.8.8 8.8.4.4 {');
    lines.push('        health_check 5s');
    lines.push('    }');
    lines.push('');
    lines.push('    # Cache responses');
    lines.push('    cache 30');
    lines.push('');
    lines.push('    # Logging');
    lines.push('    log');
    lines.push('    errors');
    lines.push('}');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build hosts file from services and static entries
   */
  private buildHostsFile(
    services: ServiceDefinition[],
    staticHosts: Record<string, string>
  ): string {
    const lines: string[] = [];
    
    lines.push('# Tuition Internal DNS');
    lines.push('# Auto-generated from container labels');
    lines.push('');

    // Add static hosts
    for (const [hostname, ip] of Object.entries(staticHosts)) {
      lines.push(`${ip} ${hostname}`);
    }

    if (Object.keys(staticHosts).length > 0) {
      lines.push('');
    }

    // Add service entries (will be resolved at runtime)
    for (const service of services) {
      if (service.labels?.['dns.hostname']) {
        const hostname = service.labels['dns.hostname'];
        // Container IPs are resolved at runtime by Docker DNS
        lines.push(`# ${hostname} -> ${service.name} (resolved by Docker)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Start CoreDNS container
   */
  async start(): Promise<{ success: boolean; message: string }> {
    // Generate compose file
    await this.generateComposeFile();

    // Check if already running
    const container = await docker.getContainer('coredns');
    if (container && container.state === 'running') {
      return { success: true, message: 'CoreDNS is already running' };
    }

    // Start via docker-compose
    const result = await this.composeManager.up('coredns', { detached: true });

    if (result.success) {
      return { success: true, message: 'CoreDNS started successfully' };
    } else {
      return { success: false, message: `Failed to start CoreDNS: ${result.output}` };
    }
  }

  /**
   * Stop CoreDNS container
   */
  async stop(): Promise<{ success: boolean; message: string }> {
    const result = await this.composeManager.down('coredns');

    if (result.success) {
      return { success: true, message: 'CoreDNS stopped' };
    } else {
      return { success: false, message: `Failed to stop CoreDNS: ${result.output}` };
    }
  }

  /**
   * Reload CoreDNS configuration
   */
  async reload(): Promise<{ success: boolean; message: string }> {
    // CoreDNS supports graceful reload with SIGUSR1
    const result = await this.sendReloadSignal();

    if (result.success) {
      return { success: true, message: 'CoreDNS configuration reloaded' };
    } else {
      // Fallback to restart
      const stopResult = await this.stop();
      if (!stopResult.success) {
        return stopResult;
      }
      return this.start();
    }
  }

  /**
   * Get CoreDNS status
   */
  async status(): Promise<{
    running: boolean;
    hosts: number;
  }> {
    const container = await docker.getContainer('coredns');
    const running = container !== null && container.state === 'running';

    let hosts = 0;
    try {
      const hostsFile = await readFile(join(this.configPath, 'hosts'), 'utf-8');
      hosts = hostsFile.split('\n').filter(line => line && !line.startsWith('#')).length;
    } catch {
      // File doesn't exist yet
    }

    return { running, hosts };
  }

  /**
   * Generate docker-compose.yaml for CoreDNS
   */
  private async generateComposeFile(): Promise<void> {
    const { stringify: stringifyYaml } = await import('yaml');
    
    const compose = {
      version: '3.8',
      services: {
        coredns: {
          image: 'coredns/coredns:latest',
          container_name: 'coredns',
          restart: 'unless-stopped',
          ports: [
            '53:53/tcp',
            '53:53/udp',
          ],
          volumes: [
            `${this.configPath}/Corefile:/etc/coredns/Corefile:ro`,
            `${this.configPath}/hosts:/etc/coredns/hosts:ro`,
          ],
          networks: ['tuition'],
          command: ['-conf', '/etc/coredns/Corefile'],
        },
      },
      networks: {
        tuition: {
          driver: 'bridge',
          external: true,
        },
      },
    };

    const yaml = stringifyYaml(compose);
    await writeFile(
      join(this.projectPath, 'coredns.docker-compose.yaml'),
      yaml,
      'utf-8'
    );
  }

  /**
   * Reload CoreDNS via docker kill
   */
  private async sendReloadSignal(): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const proc = spawn('docker', ['kill', '-s', 'USR1', 'coredns'], {
        cwd: this.projectPath,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      proc.on('close', (code: number | null) => {
        const output = stdout + (stderr ? `\n${stderr}` : '');
        resolve({
          success: code === 0,
          output: output.trim(),
        });
      });

      proc.on('error', (error: Error) => {
        resolve({
          success: false,
          output: error.message,
        });
      });
    });
  }
}
