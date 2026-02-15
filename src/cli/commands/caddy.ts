/**
 * Caddy management CLI commands
 */

import { CaddyManager } from '../../services/caddy/manager.js';
import { ConfigManager } from '../../core/config/manager.js';
import { catalog } from '../../core/catalog/loader.js';
import chalk from 'chalk';

export class CaddyCommand {
  private caddy: CaddyManager;
  private config: ConfigManager;

  constructor(configPath?: string) {
    this.config = new ConfigManager(configPath);
    this.caddy = new CaddyManager(this.config.getTuitionDir());
  }

  /**
   * Initialize managers
   */
  async initialize(): Promise<void> {
    await this.caddy.initialize();
  }

  /**
   * Start Caddy reverse proxy
   */
  async start(options: { path?: string }): Promise<void> {
    await this.initialize();

    // Check if tuition is initialized
    if (!(await this.config.exists())) {
      console.log(chalk.red('Tuition is not initialized. Run: tuition init'));
      return;
    }

    // Generate Caddyfile for all enabled services
    const globalConfig = await this.config.loadGlobal();
    const services = await this.config.loadServices();
    
    // Get enabled services
    const enabledServiceNames = Object.entries(services)
      .filter(([, config]) => config.enabled)
      .map(([name]) => name);

    // Load service definitions
    const enabledServices = [];
    for (const name of enabledServiceNames) {
      const def = await catalog.get(name);
      if (def) {
        enabledServices.push(def);
      }
    }

    // Generate Caddyfile
    console.log(chalk.blue('Generating Caddyfile...'));
    await this.caddy.generateConfig(globalConfig, enabledServices);
    console.log(chalk.green(`✓ Generated Caddyfile with ${enabledServices.length} routes`));

    // Start Caddy
    console.log(chalk.blue('Starting Caddy...'));
    const result = await this.caddy.start();

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
      console.log(chalk.gray(`Services accessible at: *.${globalConfig.domain}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Stop Caddy reverse proxy
   */
  async stop(options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue('Stopping Caddy...'));
    const result = await this.caddy.stop();

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Restart Caddy
   */
  async restart(options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue('Restarting Caddy...'));
    const result = await this.caddy.restart();

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Reload Caddy configuration
   */
  async reload(options: { path?: string }): Promise<void> {
    await this.initialize();

    console.log(chalk.blue('Reloading Caddy configuration...'));
    const result = await this.caddy.reload();

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Show Caddy status
   */
  async status(options: { path?: string }): Promise<void> {
    await this.initialize();

    const status = await this.caddy.status();
    const globalConfig = await this.config.loadGlobal();

    console.log(chalk.blue('\nCaddy Status:\n'));
    console.log(`  Running: ${status.running ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`  Domain: ${globalConfig.domain}`);
    console.log(`  Routes: ${status.routes}`);
    
    if (status.running) {
      console.log(chalk.gray(`\n  Services accessible via HTTPS:`));
      console.log(chalk.gray(`    https://*.${globalConfig.domain}`));
    }
    
    console.log();
  }

  /**
   * Regenerate Caddyfile for current enabled services
   */
  async regenerate(options: { path?: string }): Promise<void> {
    await this.initialize();

    const globalConfig = await this.config.loadGlobal();
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

    console.log(chalk.blue(`Regenerating Caddyfile for ${enabledServices.length} enabled services...`));
    await this.caddy.generateConfig(globalConfig, enabledServices);
    
    // Reload to apply changes
    const result = await this.caddy.reload();
    
    if (result.success) {
      console.log(chalk.green(`✓ Caddyfile regenerated and applied`));
    } else {
      console.log(chalk.red(`✗ Failed to apply changes: ${result.message}`));
    }
  }
}
