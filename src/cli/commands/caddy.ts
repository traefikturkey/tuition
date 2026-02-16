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

    // Prepare environment variables for Caddy
    const envVars: Record<string, string> = {
      DOMAIN: globalConfig.domain,
      HOSTNAME: globalConfig.hostname,
      TZ: globalConfig.timezone,
      PUID: String(globalConfig.puid),
      PGID: String(globalConfig.pgid),
    };
    
    if (globalConfig.cloudflareToken) {
      envVars['CF_API_TOKEN'] = globalConfig.cloudflareToken;
    }

    // Start Caddy
    console.log(chalk.blue('Starting Caddy...'));
    const result = await this.caddy.start(envVars);

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

    // Load configuration and regenerate Caddyfile
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

    console.log(chalk.blue('Regenerating Caddyfile...'));
    await this.caddy.generateConfig(globalConfig, enabledServices);
    console.log(chalk.green(`✓ Regenerated Caddyfile with ${enabledServices.length} routes`));

    // Prepare environment variables for Caddy
    const envVars: Record<string, string> = {
      DOMAIN: globalConfig.domain,
      HOSTNAME: globalConfig.hostname,
      TZ: globalConfig.timezone,
      PUID: String(globalConfig.puid),
      PGID: String(globalConfig.pgid),
    };

    if (globalConfig.cloudflareToken) {
      envVars['CF_API_TOKEN'] = globalConfig.cloudflareToken;
    }

    console.log(chalk.blue('Restarting Caddy...'));
    const result = await this.caddy.restart(envVars);

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

    // Load configuration and regenerate Caddyfile
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

    console.log(chalk.blue('Regenerating Caddyfile...'));
    await this.caddy.generateConfig(globalConfig, enabledServices);
    console.log(chalk.green(`✓ Regenerated Caddyfile with ${enabledServices.length} routes`));

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
    
    console.log(chalk.gray(`\n  Admin UI:`));
    console.log(chalk.gray(`    https://tuition.${globalConfig.domain}`));
    if (globalConfig.adminPasswordHash) {
      console.log(chalk.green(`    ✓ Password protected`));
    } else {
      console.log(chalk.yellow(`    ⚠ No password configured`));
      console.log(chalk.gray(`      Run: tuition caddy set-password`));
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

  /**
   * Set or update admin UI password
   */
  async setPassword(options: { path?: string }): Promise<void> {
    await this.initialize();
    
    const { promptPassword, hashPassword } = await import('../../utils/password.js');
    
    console.log(chalk.blue('Setting Caddy admin UI password...\n'));
    
    // Load current config
    const globalConfig = await this.config.loadGlobal();
    
    // Prompt for password
    const password = await promptPassword('Enter new admin password: ');
    const confirm = await promptPassword('Confirm password: ');
    
    if (password !== confirm) {
      console.log(chalk.red('\n✗ Passwords do not match'));
      console.log(chalk.gray('  Password was not changed'));
      return;
    }
    
    if (password.length === 0) {
      console.log(chalk.red('\n✗ Password cannot be empty'));
      return;
    }
    
    // Hash the password
    console.log(chalk.gray('\nHashing password...'));
    const hash = await hashPassword(password);
    
    // Save to global config
    globalConfig.adminPasswordHash = hash;
    await this.config.saveGlobal(globalConfig);
    
    // Regenerate Caddyfile
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
    
    console.log(chalk.blue('Updating Caddyfile...'));
    await this.caddy.generateConfig(globalConfig, enabledServices);
    
    // Reload Caddy
    console.log(chalk.blue('Reloading Caddy...'));
    const result = await this.caddy.reload();
    
    if (result.success) {
      console.log(chalk.green('\n✓ Admin password updated successfully'));
      console.log(chalk.gray('  The admin UI is now password protected'));
      console.log(chalk.gray('  Access at:'));
      console.log(chalk.cyan(`  https://tuition.${globalConfig.domain}`));
    } else {
      console.log(chalk.yellow('\n⚠ Password saved but Caddy could not reload'));
      console.log(chalk.gray('  Run: tuition caddy restart to apply changes'));
    }
  }

  /**
   * Legacy: Generate password hash for admin UI
   * Redirects to set-password command
   */
  async hashPassword(options: { path?: string }): Promise<void> {
    console.log(chalk.blue('Use "tuition caddy set-password" instead\n'));
    console.log(chalk.gray('This command interactively sets the admin password'));
    console.log(chalk.gray('and automatically updates the Caddy configuration.'));
    console.log('');
    await this.setPassword(options);
  }
}
