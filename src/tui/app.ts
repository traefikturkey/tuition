/**
 * Tuition TUI Application
 * Interactive terminal interface using Blessed
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { ServiceBrowser } from './views/service-browser.js';
import { StatusDashboard } from './views/status-dashboard.js';
import { LifecycleManager } from '../core/lifecycle/manager.js';
import { CaddyManager } from '../services/caddy/manager.js';
import { CoreDnsManager } from '../services/dns/coredns.js';
import { ConfigManager } from '../core/config/manager.js';

export class TuiApp {
  private screen: Widgets.Screen;
  private configManager: ConfigManager;
  private lifecycleManager: LifecycleManager;
  private caddyManager: CaddyManager;
  private dnsManager: CoreDnsManager;
  private persistentElements = new Set<Widgets.BlessedElement>();

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
    const tuitionDir = this.configManager.getTuitionDir();
    
    this.lifecycleManager = new LifecycleManager(configPath);
    this.caddyManager = new CaddyManager(tuitionDir);
    this.dnsManager = new CoreDnsManager(tuitionDir);

    // Create main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Tuition - Homelab Manager',
      dockBorders: true,
    });

    this.setupScreen();
  }

  /**
   * Initialize the TUI
   */
  async initialize(): Promise<void> {
    await this.configManager.initialize();
    await this.caddyManager.initialize();
    await this.dnsManager.initialize();
  }

  /**
   * Set up screen layout and key bindings
   */
  private setupScreen(): void {
    // Enable keys
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.screen.destroy();
      process.exit(0);
    });

    this.screen.key(['tab'], () => {
      this.screen.focusNext();
    });

    this.screen.key(['S-tab'], () => {
      this.screen.focusPrevious();
    });

    // Create header
    const header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: '{bold}Tuition{/bold} - Homelab Management',
      tags: true,
      align: 'center',
      valign: 'middle',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'blue',
        },
      },
    });

    // Create menu bar with buttons instead of listbar
    const menuBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      right: 0,
      height: 3,
      style: {
        fg: 'white',
        bg: 'default',
      },
    });

    const servicesBtn = blessed.button({
      parent: menuBox,
      left: 2,
      top: 0,
      width: 12,
      height: 3,
      content: '[S]ervices',
      align: 'center',
      valign: 'middle',
      mouse: true,
      keys: true,
      style: {
        fg: 'white',
        bg: 'blue',
        focus: {
          bg: 'cyan',
        },
      },
    });

    const dashboardBtn = blessed.button({
      parent: menuBox,
      left: 16,
      top: 0,
      width: 14,
      height: 3,
      content: '[D]ashboard',
      align: 'center',
      valign: 'middle',
      mouse: true,
      keys: true,
      style: {
        fg: 'white',
        bg: 'blue',
        focus: {
          bg: 'cyan',
        },
      },
    });

    const quitBtn = blessed.button({
      parent: menuBox,
      left: 32,
      top: 0,
      width: 10,
      height: 3,
      content: '[Q]uit',
      align: 'center',
      valign: 'middle',
      mouse: true,
      keys: true,
      style: {
        fg: 'white',
        bg: 'red',
        focus: {
          bg: 'cyan',
        },
      },
    });

    // Button actions
    servicesBtn.on('press', () => this.showServiceBrowser());
    dashboardBtn.on('press', () => this.showDashboard());
    quitBtn.on('press', () => {
      this.screen.destroy();
      process.exit(0);
    });

    // Keyboard shortcuts matching the button labels
    this.screen.key(['s'], () => this.showServiceBrowser());
    this.screen.key(['d'], () => this.showDashboard());

    // Create status bar
    const statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      content: ' [Tab] Navigate | [Enter] Select | [Q] Quit ',
      style: {
        fg: 'white',
        bg: 'blue',
      },
    });

    // Track persistent elements so clearContent() preserves them
    this.persistentElements.add(header);
    this.persistentElements.add(menuBox);
    this.persistentElements.add(statusBar);

    // Initial view - show dashboard
    this.showDashboard();
  }

  /**
   * Show service browser view
   */
  private async showServiceBrowser(): Promise<void> {
    // Clear previous content
    this.clearContent();

    const browser = new ServiceBrowser(this.screen, this.lifecycleManager);
    await browser.render();
  }

  /**
   * Show status dashboard view
   */
  private async showDashboard(): Promise<void> {
    // Clear previous content
    this.clearContent();

    const dashboard = new StatusDashboard(
      this.screen,
      this.configManager,
      this.lifecycleManager,
      this.caddyManager,
      this.dnsManager
    );
    await dashboard.render();
  }

  /**
   * Clear content area (preserve header, menu, status bar)
   */
  private clearContent(): void {
    const toDestroy = (this.screen.children as Widgets.BlessedElement[]).filter(
      (child) => !this.persistentElements.has(child)
    );

    for (const child of toDestroy) {
      child.destroy();
    }
  }

  /**
   * Start the TUI
   */
  async run(): Promise<void> {
    await this.initialize();
    
    if (!(await this.configManager.exists())) {
      // Show setup dialog
      const setup = blessed.question({
        parent: this.screen,
        border: 'line',
        height: 'shrink',
        width: 'half',
        top: 'center',
        left: 'center',
        label: ' Setup ',
        tags: true,
        keys: true,
        vi: true,
      });

      setup.ask('Tuition is not initialized.\nRun setup wizard now? (y/n)', (err, value) => {
        if (value && value.toLowerCase() === 'y') {
          this.screen.destroy();
          console.log('Running: tuition init');
          process.exit(0);
        } else {
          this.screen.destroy();
          process.exit(1);
        }
      });
    }

    this.screen.render();
  }
}
