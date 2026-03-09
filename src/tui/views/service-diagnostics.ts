/**
 * Service Diagnostics View
 * Detailed diagnostics for a single service with tabbed sections
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { ChildProcess } from 'child_process';
import { LifecycleManager } from '../../core/lifecycle/manager.js';
import type { ServiceInfo } from '../../core/lifecycle/manager.js';
import { docker } from '../../services/docker/client.js';
import { ComposeManager } from '../../services/docker/compose.js';
import { CaddyManager } from '../../services/caddy/manager.js';
import { CoreDnsManager } from '../../services/dns/coredns.js';
import { ConfigManager } from '../../core/config/manager.js';

type Tab = 'overview' | 'logs' | 'network';

export class ServiceDiagnostics {
  private screen: Widgets.Screen;
  private lifecycleManager: LifecycleManager;
  private configManager: ConfigManager;
  private composeManager: ComposeManager;
  private caddyManager: CaddyManager;
  private dnsManager: CoreDnsManager;
  private onBack: () => void;
  private serviceName: string;

  private activeTab: Tab = 'overview';
  private tabContentBox?: Widgets.BoxElement;
  private tabButtons: Map<Tab, Widgets.ButtonElement> = new Map();
  private logProcess?: ChildProcess;
  private logElement?: Widgets.BoxElement;
  private infoBar?: Widgets.BoxElement;

  constructor(
    screen: Widgets.Screen,
    serviceName: string,
    lifecycleManager: LifecycleManager,
    configManager: ConfigManager,
    caddyManager: CaddyManager,
    dnsManager: CoreDnsManager,
    onBack: () => void
  ) {
    this.screen = screen;
    this.serviceName = serviceName;
    this.lifecycleManager = lifecycleManager;
    this.configManager = configManager;
    this.caddyManager = caddyManager;
    this.dnsManager = dnsManager;
    this.onBack = onBack;

    const tuitionDir = this.configManager.getTuitionDir();
    this.composeManager = new ComposeManager(tuitionDir);
  }

  /**
   * Render the diagnostics view
   */
  async render(): Promise<void> {
    const service = await this.lifecycleManager.getService(this.serviceName);

    if (!service) {
      this.onBack();
      return;
    }

    // Main container
    const container = blessed.box({
      parent: this.screen,
      top: 4,
      left: 0,
      right: 0,
      height: '100%-5',
      border: { type: 'line' },
      label: ` Diagnostics: ${this.serviceName} `,
      style: { border: { fg: 'cyan' } },
    });

    // Info bar at top (always visible)
    this.infoBar = blessed.box({
      parent: container,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      tags: true,
      border: { type: 'line' },
      label: ' Status ',
      style: { border: { fg: 'blue' } },
      content: this.formatInfoBar(service),
    });

    // Action buttons row
    const actionBar = blessed.box({
      parent: container,
      top: 3,
      left: 0,
      right: 0,
      height: 3,
    });

    const btnBack = blessed.button({
      parent: actionBar,
      left: 2,
      top: 0,
      width: 10,
      height: 3,
      content: 'Back',
      align: 'center',
      valign: 'middle',
      border: { type: 'line' },
      mouse: true,
      keys: true,
      style: { fg: 'white', bg: 'blue', focus: { bg: 'cyan' } },
    });

    const btnRestart = blessed.button({
      parent: actionBar,
      left: 14,
      top: 0,
      width: 12,
      height: 3,
      content: 'Restart',
      align: 'center',
      valign: 'middle',
      border: { type: 'line' },
      mouse: true,
      keys: true,
      style: { fg: 'white', bg: 'green', focus: { bg: 'cyan' } },
    });

    const btnStartStop = blessed.button({
      parent: actionBar,
      left: 28,
      top: 0,
      width: 12,
      height: 3,
      content: service.state === 'running' ? 'Stop' : 'Start',
      align: 'center',
      valign: 'middle',
      border: { type: 'line' },
      mouse: true,
      keys: true,
      style: {
        fg: 'white',
        bg: service.state === 'running' ? 'yellow' : 'green',
        focus: { bg: 'cyan' },
      },
    });

    // Tab bar
    const tabBar = blessed.box({
      parent: container,
      top: 6,
      left: 0,
      right: 0,
      height: 1,
      style: { bg: 'default' },
    });

    const tabDefs: Array<{ tab: Tab; label: string; left: number; width: number }> = [
      { tab: 'overview', label: '[O]verview', left: 2, width: 14 },
      { tab: 'logs', label: '[L]ogs', left: 18, width: 10 },
      { tab: 'network', label: '[N]etwork', left: 30, width: 13 },
    ];

    for (const def of tabDefs) {
      const btn = blessed.button({
        parent: tabBar,
        left: def.left,
        top: 0,
        width: def.width,
        height: 1,
        content: def.label,
        align: 'center',
        mouse: true,
        keys: true,
        style: {
          fg: 'white',
          bg: this.activeTab === def.tab ? 'cyan' : 'blue',
          focus: { bg: 'cyan' },
        },
      });

      btn.on('press', () => this.switchTab(def.tab, service));
      this.tabButtons.set(def.tab, btn);
    }

    // Tab content area
    this.tabContentBox = blessed.box({
      parent: container,
      top: 7,
      left: 0,
      right: 0,
      bottom: 0,
      tags: true,
    });

    // Button actions
    btnBack.on('press', () => this.cleanup(() => this.onBack()));

    btnRestart.on('press', async () => {
      const result = await this.lifecycleManager.restart(this.serviceName);
      this.showMessage(result.message, result.success ? 'green' : 'red');
      await this.refreshInfoBar();
    });

    btnStartStop.on('press', async () => {
      const action = service.state === 'running'
        ? this.lifecycleManager.stop(this.serviceName)
        : this.lifecycleManager.start(this.serviceName);
      const result = await action;
      this.showMessage(result.message, result.success ? 'green' : 'red');
      await this.refreshInfoBar();
    });

    // Key bindings for tabs and navigation
    this.screen.key(['o'], () => this.switchTab('overview', service));
    this.screen.key(['l'], () => this.switchTab('logs', service));
    this.screen.key(['n'], () => this.switchTab('network', service));
    this.screen.key(['b'], () => this.cleanup(() => this.onBack()));
    this.screen.key(['escape'], () => this.cleanup(() => this.onBack()));
    this.screen.key(['r'], async () => {
      const result = await this.lifecycleManager.restart(this.serviceName);
      this.showMessage(result.message, result.success ? 'green' : 'red');
      await this.refreshInfoBar();
    });

    // Render the default tab
    await this.renderTabContent(service);

    this.screen.render();
  }

  /**
   * Format the top info bar with at-a-glance status
   */
  private formatInfoBar(service: ServiceInfo): string {
    const stateColor = this.getStateColor(service.state);
    const icon = this.getStateIcon(service.state);
    const health = service.containerStatus?.health
      ? ` (${service.containerStatus.health})`
      : '';
    const uptime = service.containerStatus?.uptime
      ? `  Uptime: ${this.formatUptime(service.containerStatus.uptime)}`
      : '';
    const image = service.definition?.image || 'unknown';

    return ` ${icon} ${stateColor}${service.state}{/}${health}${uptime}  |  Image: ${image}`;
  }

  /**
   * Refresh just the info bar with latest service state
   */
  private async refreshInfoBar(): Promise<void> {
    const service = await this.lifecycleManager.getService(this.serviceName);
    if (service && this.infoBar) {
      this.infoBar.setContent(this.formatInfoBar(service));
      this.screen.render();
    }
  }

  /**
   * Switch to a different tab
   */
  private async switchTab(tab: Tab, service: ServiceInfo): Promise<void> {
    if (tab === this.activeTab) return;

    // Stop log streaming when leaving logs tab
    if (this.activeTab === 'logs') {
      this.stopLogStream();
    }

    this.activeTab = tab;

    // Update tab button styles
    for (const [t, btn] of this.tabButtons) {
      btn.style.bg = t === tab ? 'cyan' : 'blue';
    }

    // Re-fetch service info for current state
    const freshService = await this.lifecycleManager.getService(this.serviceName);
    await this.renderTabContent(freshService || service);
  }

  /**
   * Render content for the active tab
   */
  private async renderTabContent(service: ServiceInfo): Promise<void> {
    if (!this.tabContentBox) return;

    // Clear existing tab content
    const children = [...this.tabContentBox.children] as Widgets.BlessedElement[];
    for (const child of children) {
      child.destroy();
    }

    switch (this.activeTab) {
      case 'overview':
        await this.renderOverviewTab(service);
        break;
      case 'logs':
        await this.renderLogsTab(service);
        break;
      case 'network':
        await this.renderNetworkTab(service);
        break;
    }

    this.screen.render();
  }

  /**
   * Render the Overview tab: ports, volumes, resource limits, routing, image
   */
  private async renderOverviewTab(service: ServiceInfo): Promise<void> {
    if (!this.tabContentBox) return;

    // Ports box (top-left)
    const portsContent = this.formatPorts(service);
    blessed.box({
      parent: this.tabContentBox,
      top: 0,
      left: 0,
      width: '50%',
      height: 8,
      tags: true,
      border: { type: 'line' },
      label: ' Ports ',
      style: { border: { fg: 'blue' } },
      content: portsContent,
    });

    // Volumes box (top-right)
    const volumesContent = this.formatVolumes(service);
    blessed.box({
      parent: this.tabContentBox,
      top: 0,
      left: '50%',
      right: 0,
      height: 8,
      tags: true,
      border: { type: 'line' },
      label: ' Volumes ',
      style: { border: { fg: 'blue' } },
      content: volumesContent,
    });

    // Resource limits box (bottom-left)
    const limitsContent = this.formatResourceLimits(service);
    blessed.box({
      parent: this.tabContentBox,
      top: 8,
      left: 0,
      width: '50%',
      height: 7,
      tags: true,
      border: { type: 'line' },
      label: ' Resource Limits ',
      style: { border: { fg: 'blue' } },
      content: limitsContent,
    });

    // Routing box (bottom-right)
    let routingContent = '  No routing data available';
    try {
      const caddyStatus = await this.caddyManager.status();
      const dnsStatus = await this.dnsManager.status();
      routingContent = this.formatRouting(service, caddyStatus, dnsStatus);
    } catch {
      // Leave default content
    }

    blessed.box({
      parent: this.tabContentBox,
      top: 8,
      left: '50%',
      right: 0,
      height: 7,
      tags: true,
      border: { type: 'line' },
      label: ' Routing ',
      style: { border: { fg: 'blue' } },
      content: routingContent,
    });

    // Image info box (full width, below)
    const imageContent = this.formatImageInfo(service);
    blessed.box({
      parent: this.tabContentBox,
      top: 15,
      left: 0,
      right: 0,
      height: 6,
      tags: true,
      border: { type: 'line' },
      label: ' Image ',
      style: { border: { fg: 'blue' } },
      content: imageContent,
    });
  }

  /**
   * Render the Logs tab: live streaming log output
   */
  private async renderLogsTab(_service: ServiceInfo): Promise<void> {
    if (!this.tabContentBox) return;

    this.logElement = blessed.box({
      parent: this.tabContentBox,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      tags: false,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        track: { bg: 'gray' },
        style: { bg: 'white' },
      },
      keys: true,
      mouse: true,
      vi: true,
      border: { type: 'line' },
      label: ' Logs (streaming) ',
      style: { border: { fg: 'green' } },
      content: 'Starting log stream...',
    });

    this.logElement.focus();
    this.startLogStream();
  }

  /**
   * Render the Network tab: container IP, gateway, port bindings, Caddy/DNS
   */
  private async renderNetworkTab(service: ServiceInfo): Promise<void> {
    if (!this.tabContentBox) return;

    // Container network info
    let networkContent = '  No container network info available';
    try {
      if (service.containerStatus?.id) {
        const containerIp = await docker.getContainerIP(this.serviceName, 'tuition');
        const gateway = await docker.getNetworkGateway('tuition');

        let content = '';
        content += `  Container IP: ${containerIp || 'N/A'}\n`;
        content += `  Network: tuition\n`;
        content += `  Gateway: ${gateway || 'N/A'}`;
        networkContent = content;
      }
    } catch {
      // Leave default content
    }

    blessed.box({
      parent: this.tabContentBox,
      top: 0,
      left: 0,
      right: 0,
      height: 7,
      tags: true,
      border: { type: 'line' },
      label: ' Container Network ',
      style: { border: { fg: 'blue' } },
      content: networkContent,
    });

    // Port bindings from Docker (actual state)
    let portBindingsContent = '  No port bindings';
    try {
      if (service.containerStatus?.id) {
        const container = await docker.getContainer(this.serviceName);
        if (container && container.ports.length > 0) {
          portBindingsContent = container.ports
            .map(p => {
              const pub = p.publicPort ? `0.0.0.0:${p.publicPort}` : 'none';
              return `  ${pub} -> ${p.privatePort}/${p.type}`;
            })
            .join('\n');
        }
      }
    } catch {
      // Leave default content
    }

    blessed.box({
      parent: this.tabContentBox,
      top: 7,
      left: 0,
      right: 0,
      height: 7,
      tags: true,
      border: { type: 'line' },
      label: ' Port Bindings (actual) ',
      style: { border: { fg: 'blue' } },
      content: portBindingsContent,
    });

    // Caddy route info
    let caddyContent = '  No Caddy route configured';
    try {
      const globalConfig = await this.configManager.loadGlobal();
      const domain = `${this.serviceName}.${globalConfig.domain}`;
      const caddyStatus = await this.caddyManager.status();

      if (caddyStatus.running) {
        caddyContent = `  Domain: ${domain}\n  TLS: enabled`;
      }
    } catch {
      // Leave default content
    }

    blessed.box({
      parent: this.tabContentBox,
      top: 14,
      left: 0,
      width: '50%',
      height: 6,
      tags: true,
      border: { type: 'line' },
      label: ' Caddy Route ',
      style: { border: { fg: 'blue' } },
      content: caddyContent,
    });

    // DNS entry info
    let dnsContent = '  No DNS entry';
    try {
      const globalConfig = await this.configManager.loadGlobal();
      const hostname = `${this.serviceName}.${globalConfig.domain}`;
      const containerIp = await docker.getContainerIP(this.serviceName, 'tuition');

      if (containerIp) {
        dnsContent = `  ${hostname}\n  -> ${containerIp}`;
      }
    } catch {
      // Leave default content
    }

    blessed.box({
      parent: this.tabContentBox,
      top: 14,
      left: '50%',
      right: 0,
      height: 6,
      tags: true,
      border: { type: 'line' },
      label: ' DNS Entry ',
      style: { border: { fg: 'blue' } },
      content: dnsContent,
    });
  }

  /**
   * Start streaming logs from the service container
   */
  private startLogStream(): void {
    this.stopLogStream();

    try {
      this.logProcess = this.composeManager.streamLogs(this.serviceName, { tail: 100 });

      this.logProcess.stdout?.on('data', (data: Buffer) => {
        this.appendLog(data.toString('utf-8'));
      });

      this.logProcess.stderr?.on('data', (data: Buffer) => {
        this.appendLog(data.toString('utf-8'));
      });

      this.logProcess.on('error', () => {
        this.appendLog('\n[Log stream error]');
      });

      this.logProcess.on('close', () => {
        this.appendLog('\n[Log stream ended]');
      });
    } catch {
      this.appendLog('[Failed to start log stream]');
    }
  }

  /**
   * Append text to the log element and auto-scroll to bottom
   */
  private appendLog(text: string): void {
    if (!this.logElement) return;

    const current = this.logElement.getContent();
    // Remove the initial "Starting log stream..." placeholder
    const content = current === 'Starting log stream...' ? text : current + text;
    this.logElement.setContent(content);

    // Auto-scroll to bottom (guard against blessed _clines not yet initialized)
    try {
      this.logElement.setScrollPerc(100);
    } catch {
      // _clines may be undefined before first render/layout
    }
    this.screen.render();
  }

  /**
   * Stop the log streaming process
   */
  private stopLogStream(): void {
    if (this.logProcess) {
      this.logProcess.kill();
      this.logProcess = undefined;
    }
  }

  /**
   * Clean up resources before leaving the view
   */
  private cleanup(callback: () => void): void {
    this.stopLogStream();
    callback();
  }

  /**
   * Format port mappings from the service definition
   */
  private formatPorts(service: ServiceInfo): string {
    const ports = service.definition?.ports;
    if (!ports || ports.length === 0) {
      return '  No ports defined';
    }

    return ports
      .map(p => `  ${p.host}:${p.container}/${p.protocol || 'tcp'}`)
      .join('\n');
  }

  /**
   * Format volume mappings from the service definition
   */
  private formatVolumes(service: ServiceInfo): string {
    const volumes = service.definition?.volumes;
    if (!volumes || volumes.length === 0) {
      return '  No volumes defined';
    }

    return volumes
      .map(v => {
        const ro = v.readOnly ? ' (ro)' : '';
        return `  ${v.host}:${v.container}${ro}`;
      })
      .join('\n');
  }

  /**
   * Format resource limits
   */
  private formatResourceLimits(service: ServiceInfo): string {
    const limits = service.definition?.resourceLimits;
    if (!limits) {
      return '  No resource limits defined';
    }

    let content = '';
    if (limits.cpus) content += `  CPUs: ${limits.cpus}\n`;
    if (limits.memory) content += `  Memory: ${limits.memory}\n`;
    if (limits.gpus !== undefined) content += `  GPUs: ${limits.gpus ? 'yes' : 'no'}`;

    return content || '  No resource limits defined';
  }

  /**
   * Format routing information
   */
  private formatRouting(
    service: ServiceInfo,
    caddyStatus: { running: boolean; routes: number },
    dnsStatus: { running: boolean; hosts: number }
  ): string {
    const hasLabels = service.definition?.labels?.['caddy'] !== undefined;
    const caddyIcon = caddyStatus.running && hasLabels ? '{green-fg}✓{/}' : '{red-fg}✗{/}';
    const dnsIcon = dnsStatus.running ? '{green-fg}✓{/}' : '{red-fg}✗{/}';

    let content = '';
    content += `  Caddy: ${caddyIcon} ${hasLabels ? 'route configured' : 'no route'}\n`;
    content += `  DNS: ${dnsIcon} ${dnsStatus.running ? `${dnsStatus.hosts} hosts` : 'stopped'}`;

    return content;
  }

  /**
   * Format image information
   */
  private formatImageInfo(service: ServiceInfo): string {
    const def = service.definition;
    if (!def) {
      return '  No image info available';
    }

    let content = '';
    content += `  Name: ${def.image}\n`;

    const tag = service.config?.imageTag || 'latest';
    content += `  Tag: ${tag}\n`;

    if (service.containerStatus?.id) {
      content += `  Container ID: ${service.containerStatus.id.substring(0, 12)}`;
    }

    return content;
  }

  /**
   * Format uptime from seconds to human-readable
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private getStateColor(state: string): string {
    switch (state) {
      case 'running': return '{green-fg}';
      case 'enabled': return '{blue-fg}';
      case 'stopped': return '{yellow-fg}';
      case 'disabled': return '{gray-fg}';
      default: return '{white-fg}';
    }
  }

  private getStateIcon(state: string): string {
    switch (state) {
      case 'running': return '▲';
      case 'enabled': return '●';
      case 'stopped': return '▼';
      case 'disabled': return '○';
      default: return '○';
    }
  }

  /**
   * Show a temporary message dialog
   */
  private showMessage(message: string, color: string): void {
    const msg = blessed.message({
      parent: this.screen,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ' Message ',
      style: { border: { fg: color } },
    });

    msg.display(message, 3, () => {
      msg.destroy();
    });
  }
}
