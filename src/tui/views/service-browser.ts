/**
 * Service Browser View
 * Displays all services with their status and allows interaction
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { LifecycleManager } from '../../core/lifecycle/manager.js';
import type { ServiceInfo } from '../../core/lifecycle/manager.js';

export class ServiceBrowser {
  private screen: Widgets.Screen;
  private lifecycleManager: LifecycleManager;

  constructor(screen: Widgets.Screen, lifecycleManager: LifecycleManager) {
    this.screen = screen;
    this.lifecycleManager = lifecycleManager;
  }

  /**
   * Render the service browser
   */
  async render(): Promise<void> {
    const services = await this.lifecycleManager.listAll();

    // Create main container
    const container = blessed.box({
      parent: this.screen,
      top: 4,
      left: 0,
      right: 0,
      height: '100%-5',
      border: {
        type: 'line',
      },
      label: ' Services ',
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    // Create service list
    const list = blessed.list({
      parent: container,
      top: 0,
      left: 0,
      width: '40%',
      height: '100%-2',
      keys: true,
      mouse: true,
      vi: true,
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Available ',
      style: {
        item: {
          fg: 'white',
        },
        selected: {
          bg: 'blue',
          fg: 'white',
        },
        border: {
          fg: 'white',
        },
      },
      items: services.map(s => this.formatServiceListItem(s)),
    });

    // Create details panel
    const details = blessed.box({
      parent: container,
      top: 0,
      left: '40%',
      right: 0,
      height: '100%-2',
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Details ',
      style: {
        border: {
          fg: 'white',
        },
      },
      content: 'Select a service to view details',
    });

    // Create action buttons
    const buttons = blessed.box({
      parent: container,
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      style: {
        fg: 'white',
      },
    });

    const btnEnable = blessed.button({
      parent: buttons,
      left: 2,
      top: 0,
      width: 12,
      height: 3,
      content: 'Enable',
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'green',
        focus: {
          bg: 'blue',
        },
      },
      mouse: true,
      keys: true,
    });

    const btnDisable = blessed.button({
      parent: buttons,
      left: 16,
      top: 0,
      width: 12,
      height: 3,
      content: 'Disable',
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'red',
        focus: {
          bg: 'blue',
        },
      },
      mouse: true,
      keys: true,
    });

    const btnStart = blessed.button({
      parent: buttons,
      left: 30,
      top: 0,
      width: 10,
      height: 3,
      content: 'Start',
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        focus: {
          bg: 'cyan',
        },
      },
      mouse: true,
      keys: true,
    });

    const btnStop = blessed.button({
      parent: buttons,
      left: 42,
      top: 0,
      width: 10,
      height: 3,
      content: 'Stop',
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'yellow',
        focus: {
          bg: 'cyan',
        },
      },
      mouse: true,
      keys: true,
    });

    const btnRemove = blessed.button({
      parent: buttons,
      left: 54,
      top: 0,
      width: 12,
      height: 3,
      content: 'Remove',
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'red',
        focus: {
          bg: 'cyan',
        },
      },
      mouse: true,
      keys: true,
    });

    // Update details when selection changes
    list.on('select', (item, index) => {
      const service = services[index];
      if (service) {
        details.setContent(this.formatServiceDetails(service));
        this.screen.render();
      }
    });

    // Track selected index
    let selectedIndex = 0;
    list.on('select', (item, index) => {
      selectedIndex = index;
    });

    // Button actions
    btnEnable.on('press', async () => {
      const service = services[selectedIndex];
      if (service) {
        const result = await this.lifecycleManager.enable(service.name);
        this.showMessage(result.message, result.success ? 'green' : 'red');
        await this.refresh(list, services);
      }
    });

    btnDisable.on('press', async () => {
      const service = services[selectedIndex];
      if (service) {
        const result = await this.lifecycleManager.disable(service.name);
        this.showMessage(result.message, result.success ? 'green' : 'red');
        await this.refresh(list, services);
      }
    });

    btnStart.on('press', async () => {
      const service = services[selectedIndex];
      if (service) {
        const result = await this.lifecycleManager.start(service.name);
        this.showMessage(result.message, result.success ? 'green' : 'red');
        await this.refresh(list, services);
      }
    });

    btnStop.on('press', async () => {
      const service = services[selectedIndex];
      if (service) {
        const result = await this.lifecycleManager.stop(service.name);
        this.showMessage(result.message, result.success ? 'green' : 'red');
        await this.refresh(list, services);
      }
    });

    btnRemove.on('press', async () => {
      const service = services[selectedIndex];
      if (service) {
        this.showConfirm(
          `Remove service '${service.name}'?\nThis will delete configuration and all data.`,
          async (confirmed) => {
            if (confirmed) {
              const result = await this.lifecycleManager.remove(service.name);
              this.showMessage(result.message, result.success ? 'green' : 'red');
              await this.refresh(list, services);
            }
          }
        );
      }
    });

    list.focus();
    this.screen.render();
  }

  /**
   * Format service for list display
   */
  private formatServiceListItem(service: ServiceInfo): string {
    const stateColor = this.getStateColor(service.state);
    const icon = this.getStateIcon(service.state);
    return ` ${icon} ${service.name.padEnd(15)} ${stateColor}${service.state}{/}`;
  }

  /**
   * Format service details
   */
  private formatServiceDetails(service: ServiceInfo): string {
    let content = '';
    
    content += `{bold}Name:{/bold} ${service.name}\n`;
    content += `{bold}Category:{/bold} ${service.definition?.category || 'N/A'}\n`;
    content += `{bold}State:{/bold} ${service.state}\n\n`;
    
    if (service.definition?.description) {
      content += `{bold}Description:{/bold}\n${service.definition.description}\n\n`;
    }
    
    if (service.containerStatus) {
      content += `{bold}Container:{/bold}\n`;
      content += `  ID: ${service.containerStatus.id.substring(0, 12)}\n`;
      content += `  State: ${service.containerStatus.state}\n`;
      if (service.containerStatus.health) {
        content += `  Health: ${service.containerStatus.health}\n`;
      }
    }
    
    if (service.definition?.upstreamUrl) {
      content += `\n{bold}Documentation:{/bold} ${service.definition.upstreamUrl}`;
    }
    
    return content;
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

  /**
   * Show a message dialog
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
      style: {
        border: {
          fg: color,
        },
      },
    });

    msg.display(message, 3, () => {
      msg.destroy();
    });
  }

  /**
   * Show a confirmation dialog
   */
  private showConfirm(message: string, callback: (confirmed: boolean) => void): void {
    const dialog = blessed.question({
      parent: this.screen,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ' Confirm ',
      tags: true,
      keys: true,
      vi: true,
      style: {
        border: {
          fg: 'red',
        },
      },
    });

    dialog.ask(message, (err, value) => {
      dialog.destroy();
      this.screen.render();
      callback(!err && value === 'yes');
    });
  }

  /**
   * Refresh the service list
   */
  private async refresh(list: Widgets.ListElement, oldServices: ServiceInfo[]): Promise<void> {
    const services = await this.lifecycleManager.listAll();
    list.setItems(services.map(s => this.formatServiceListItem(s)));
    this.screen.render();
  }
}
