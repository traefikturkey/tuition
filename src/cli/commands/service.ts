/**
 * Service management CLI commands
 */

import { ConfigManager } from '../../core/config/manager.js';
import { catalog } from '../../core/catalog/loader.js';
import { LifecycleManager } from '../../core/lifecycle/manager.js';
import chalk from 'chalk';
import readline from 'readline';

export class ServiceCommand {
  private lifecycle: LifecycleManager;

  constructor(configPath?: string) {
    this.lifecycle = new LifecycleManager(configPath);
  }

  /**
   * Initialize lifecycle manager
   */
  async initialize(): Promise<void> {
    await this.lifecycle.initialize();
  }

  /**
   * List available/enabled services
   */
  async list(options: { 
    category?: string;
    all?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    const services = await this.lifecycle.listAll();

    if (services.length === 0) {
      console.log(chalk.yellow('No services available'));
      return;
    }

    // Filter by category if specified
    const filtered = options.category 
      ? services.filter(s => s.definition?.category === options.category)
      : services;

    console.log(chalk.blue('\nAvailable Services:\n'));

    // Group by category
    const byCategory = new Map<string, typeof services>();
    for (const service of filtered) {
      const cat = service.definition?.category || 'other';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(service);
    }

    for (const [category, catServices] of byCategory) {
      console.log(chalk.cyan(`${category.toUpperCase()}:`));
      
      for (const service of catServices) {
        const stateColor = this.getStateColor(service.state);
        const stateIcon = this.getStateIcon(service.state);
        
        console.log(`  ${stateIcon} ${chalk.white(service.name.padEnd(15))} ${stateColor(service.state.padEnd(10))} ${chalk.gray(service.definition?.description || '')}`);
      }
      console.log();
    }

    console.log(chalk.gray('Legend: ○ = available ● = enabled ▲ = running ▼ = stopped'));
  }

  /**
   * Show service details
   */
  async show(name: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    const info = await this.lifecycle.getService(name);
    
    if (!info) {
      console.log(chalk.red(`Service '${name}' not found`));
      return;
    }

    console.log(chalk.blue(`\n${info.name}\n`));
    console.log(`  Description: ${info.definition?.description || 'N/A'}`);
    console.log(`  Category: ${info.definition?.category || 'N/A'}`);
    console.log(`  State: ${this.getStateColor(info.state)(info.state)}`);
    
    if (info.definition?.upstreamUrl) {
      console.log(`  Documentation: ${chalk.blue(info.definition.upstreamUrl)}`);
    }

    if (info.containerStatus) {
      console.log(chalk.blue('\nContainer Status:'));
      console.log(`  ID: ${info.containerStatus.id.substring(0, 12)}`);
      console.log(`  State: ${info.containerStatus.state}`);
      if (info.containerStatus.health) {
        console.log(`  Health: ${info.containerStatus.health}`);
      }
    }

    console.log();
  }

  /**
   * Enable and optionally start a service
   */
  async enable(name: string, options: {
    noStart?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue(`Enabling service '${name}'...\n`));

    const result = await this.lifecycle.enable(name, {
      autoStart: !options.noStart,
    });

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Disable a service
   */
  async disable(name: string, options: {
    removeData?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue(`Disabling service '${name}'...\n`));

    const result = await this.lifecycle.disable(name, {
      removeData: options.removeData,
    });

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Remove a service completely (config + data)
   */
  async remove(name: string, options: {
    keepData?: boolean;
    force?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    if (!options.force) {
      const dataWarning = options.keepData
        ? 'configuration will be deleted (data preserved)'
        : 'configuration and all data will be permanently deleted';

      console.log(chalk.yellow(`\nWarning: ${dataWarning} for service '${name}'.`));

      const confirmed = await this.confirmAction(`Are you sure you want to remove '${name}'? (y/N) `);
      if (!confirmed) {
        console.log(chalk.gray('Remove cancelled.'));
        return;
      }
    }

    console.log(chalk.blue(`\nRemoving service '${name}'...\n`));

    const result = await this.lifecycle.remove(name, {
      keepData: options.keepData,
    });

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Prompt user for confirmation
   */
  private confirmAction(prompt: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Start a service
   */
  async start(name: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue(`Starting service '${name}'...\n`));

    const result = await this.lifecycle.start(name);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Stop a service
   */
  async stop(name: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue(`Stopping service '${name}'...\n`));

    const result = await this.lifecycle.stop(name);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Restart a service
   */
  async restart(name: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue(`Restarting service '${name}'...\n`));

    const result = await this.lifecycle.restart(name);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Update service to latest image
   */
  async update(name: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue(`Updating service '${name}'...\n`));

    const result = await this.lifecycle.update(name);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Show service logs
   */
  async logs(name: string, options: {
    tail?: number;
    follow?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    const result = await this.lifecycle.logs(name, {
      tail: options.tail,
      follow: options.follow,
    });

    if (result.success) {
      console.log(result.output);
    } else {
      console.log(chalk.red(`Failed to get logs: ${result.output}`));
    }
  }

  /**
   * Search services
   */
  async search(query: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    const results = await catalog.search(query);

    if (results.length === 0) {
      console.log(chalk.yellow(`No services found matching '${query}'`));
      return;
    }

    console.log(chalk.blue(`\nSearch results for '${query}':\n`));
    
    for (const service of results) {
      console.log(`  ${chalk.white(service.name)} - ${chalk.gray(service.description)}`);
    }
    
    console.log();
  }

  /**
   * Get color function for service state
   */
  private getStateColor(state: string): (text: string) => string {
    switch (state) {
      case 'running':
        return chalk.green;
      case 'enabled':
        return chalk.blue;
      case 'stopped':
        return chalk.yellow;
      case 'disabled':
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  /**
   * Get icon for service state
   */
  private getStateIcon(state: string): string {
    switch (state) {
      case 'running':
        return chalk.green('▲');
      case 'enabled':
        return chalk.blue('●');
      case 'stopped':
        return chalk.yellow('▼');
      case 'disabled':
        return chalk.gray('○');
      default:
        return chalk.white('○');
    }
  }
}
