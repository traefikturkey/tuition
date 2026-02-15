/**
 * CoreDNS management CLI commands
 */

import { CoreDnsManager } from '../../services/dns/coredns.js';
import { ConfigManager } from '../../core/config/manager.js';
import { catalog } from '../../core/catalog/loader.js';
import chalk from 'chalk';

export class DnsCommand {
  private dns: CoreDnsManager;
  private config: ConfigManager;

  constructor(configPath?: string) {
    this.config = new ConfigManager(configPath);
    this.dns = new CoreDnsManager(this.config.getTuitionDir());
  }

  /**
   * Initialize managers
   */
  async initialize(): Promise<void> {
    await this.dns.initialize();
  }

  /**
   * Start CoreDNS
   */
  async start(options: { path?: string }): Promise<void> {
    await this.initialize();

    if (!(await this.config.exists())) {
      console.log(chalk.red('Tuition is not initialized. Run: tuition init'));
      return;
    }

    // Generate config for enabled services
    const services = await this.config.loadServices();
    const enabledServiceNames = Object.entries(services)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);

    const enabledServices = [];
    for (const name of enabledServiceNames) {
      const def = await catalog.get(name);
      if (def) {
        enabledServices.push(def);
      }
    }

    console.log(chalk.blue('Generating CoreDNS configuration...'));
    await this.dns.generateConfig(enabledServices);
    console.log(chalk.green(`✓ Generated CoreDNS config for ${enabledServices.length} services`));

    console.log(chalk.blue('Starting CoreDNS...'));
    const result = await this.dns.start();

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
      console.log(chalk.gray('Internal DNS server running on port 53'));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Stop CoreDNS
   */
  async stop(options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue('Stopping CoreDNS...'));
    const result = await this.dns.stop();

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Show CoreDNS status
   */
  async status(options: { path?: string }): Promise<void> {
    await this.initialize();

    const status = await this.dns.status();

    console.log(chalk.blue('\nCoreDNS Status:\n'));
    console.log(`  Running: ${status.running ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`  Host entries: ${status.hosts}`);
    
    if (status.running) {
      console.log(chalk.gray('\n  Internal DNS available on port 53'));
      console.log(chalk.gray('  Configure your system to use 127.0.0.1 as DNS server'));
    }
    
    console.log();
  }

  /**
   * Regenerate CoreDNS configuration
   */
  async regenerate(options: { path?: string }): Promise<void> {
    await this.initialize();

    const services = await this.config.loadServices();
    const enabledServiceNames = Object.entries(services)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);

    const enabledServices = [];
    for (const name of enabledServiceNames) {
      const def = await catalog.get(name);
      if (def) {
        enabledServices.push(def);
      }
    }

    console.log(chalk.blue(`Regenerating CoreDNS config for ${enabledServices.length} services...`));
    await this.dns.generateConfig(enabledServices);
    
    const result = await this.dns.reload();
    
    if (result.success) {
      console.log(chalk.green(`✓ CoreDNS config regenerated and reloaded`));
    } else {
      console.log(chalk.red(`✗ Failed to reload: ${result.message}`));
    }
  }
}
