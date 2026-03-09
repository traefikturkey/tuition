/**
 * Status Dashboard View
 * Shows overall system status and health
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { ConfigManager } from '../../core/config/manager.js';
import { LifecycleManager } from '../../core/lifecycle/manager.js';
import { CaddyManager } from '../../services/caddy/manager.js';
import { CoreDnsManager } from '../../services/dns/coredns.js';
import { docker } from '../../services/docker/client.js';

export class StatusDashboard {
  private screen: Widgets.Screen;
  private configManager: ConfigManager;
  private lifecycleManager: LifecycleManager;
  private caddyManager: CaddyManager;
  private dnsManager: CoreDnsManager;

  constructor(
    screen: Widgets.Screen,
    configManager: ConfigManager,
    lifecycleManager: LifecycleManager,
    caddyManager: CaddyManager,
    dnsManager: CoreDnsManager
  ) {
    this.screen = screen;
    this.configManager = configManager;
    this.lifecycleManager = lifecycleManager;
    this.caddyManager = caddyManager;
    this.dnsManager = dnsManager;
  }

  /**
   * Render the dashboard
   */
  async render(): Promise<void> {
    const globalConfig = await this.configManager.loadGlobal();
    const services = await this.lifecycleManager.listAll();
    const caddyStatus = await this.caddyManager.status();
    const dnsStatus = await this.dnsManager.status();

    // Calculate stats
    const totalServices = services.length;
    const runningServices = services.filter(s => s.state === 'running').length;
    const enabledServices = services.filter(s => s.state !== 'available' && s.state !== 'disabled').length;

    // Create main container
    const container = blessed.box({
      parent: this.screen,
      top: 6,
      left: 0,
      width: '100%',
      height: '100%-7',
      border: {
        type: 'line',
      },
      label: ' Dashboard ',
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    // System info box
    const systemBox = blessed.box({
      parent: container,
      top: 0,
      left: 0,
      width: '50%',
      height: 8,
      tags: true,
      border: {
        type: 'line',
      },
      label: ' System ',
      style: {
        border: {
          fg: 'blue',
        },
      },
      content: this.formatSystemInfo(globalConfig, caddyStatus, dnsStatus),
    });

    // Stats box
    const statsBox = blessed.box({
      parent: container,
      top: 0,
      left: '50%',
      width: '50%',
      height: 8,
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Statistics ',
      style: {
        border: {
          fg: 'blue',
        },
      },
      content: this.formatStats(totalServices, runningServices, enabledServices),
    });

    // Services table
    const servicesBox = blessed.box({
      parent: container,
      top: 8,
      left: 0,
      width: '100%',
      height: '50%',
      border: {
        type: 'line',
      },
      label: ' Service Status ',
      style: {
        border: {
          fg: 'green',
        },
      },
    });

    // Create service status list
    const serviceList = blessed.list({
      parent: servicesBox,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      keys: true,
      mouse: true,
      vi: true,
      tags: true,
      style: {
        item: {
          fg: 'white',
        },
        selected: {
          bg: 'blue',
        },
      },
      items: services.map(s => this.formatServiceRow(s)),
    });

    // Docker status box
    const dockerBox = blessed.box({
      parent: container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 'shrink',
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Docker Status ',
      style: {
        border: {
          fg: 'yellow',
        },
      },
    });

    // Get Docker info
    try {
      const dockerInfo = await docker.info() as Record<string, unknown>;
      const containerInfo = await docker.listContainers();
      
      dockerBox.setContent(
        `  Docker: ${dockerInfo.ServerVersion || 'Unknown'}\n` +
        `  Containers: ${containerInfo.length} running\n` +
        `  Total Containers: ${dockerInfo.Containers || 'Unknown'}\n` +
        `  Images: ${dockerInfo.Images || 'Unknown'}`
      );
    } catch {
      dockerBox.setContent('  {red-fg}Docker is not accessible{/}');
    }

    serviceList.focus();
    this.screen.render();
  }

  /**
   * Format system information
   */
  private formatSystemInfo(
    globalConfig: { domain: string; adminEmail: string },
    caddyStatus: { running: boolean; routes: number },
    dnsStatus: { running: boolean; hosts: number }
  ): string {
    let content = '';
    
    content += `  Domain: ${globalConfig.domain}\n`;
    content += `  Email: ${globalConfig.adminEmail}\n\n`;
    
    content += `  Caddy: ${caddyStatus.running ? '{green-fg}Running{/}' : '{red-fg}Stopped{/}'}\n`;
    if (caddyStatus.running) {
      content += `  Routes: ${caddyStatus.routes}\n`;
    }
    
    content += `\n  CoreDNS: ${dnsStatus.running ? '{green-fg}Running{/}' : '{red-fg}Stopped{/}'}\n`;
    if (dnsStatus.running) {
      content += `  Hosts: ${dnsStatus.hosts}`;
    }
    
    return content;
  }

  /**
   * Format statistics
   */
  private formatStats(total: number, running: number, enabled: number): string {
    let content = '';
    
    content += `  Total Services: ${total}\n`;
    content += `  Running: {green-fg}${running}{/}\n`;
    content += `  Enabled: {blue-fg}${enabled}{/}\n`;
    content += `  Available: ${total - enabled}\n\n`;
    
    content += `  {bold}Quick Actions:{/bold}\n`;
    content += `  [S] Services | [D] Dashboard | [Q] Quit`;
    
    return content;
  }

  /**
   * Format service row for display
   */
  private formatServiceRow(service: { name: string; state: string; definition?: { category?: string } }): string {
    const stateColor = this.getStateColor(service.state);
    const icon = this.getStateIcon(service.state);
    const category = service.definition?.category || 'other';
    
    return ` ${icon} ${service.name.padEnd(15)} ${category.padEnd(12)} ${stateColor}${service.state}{/}`;
  }

  /**
   * Get color for service state
   */
  private getStateColor(state: string): string {
    switch (state) {
      case 'running': return '{green-fg}';
      case 'enabled': return '{blue-fg}';
      case 'stopped': return '{yellow-fg}';
      case 'disabled': return '{gray-fg}';
      default: return '{white-fg}';
    }
  }

  /**
   * Get icon for service state
   */
  private getStateIcon(state: string): string {
    switch (state) {
      case 'running': return '▲';
      case 'enabled': return '●';
      case 'stopped': return '▼';
      case 'disabled': return '○';
      default: return '○';
    }
  }
}
