/**
 * Initialize command - sets up tuition for first use
 */

import { ConfigManager } from '../../core/config/manager.js';
import { ConfigValidator } from '../../core/config/validator.js';
import type { GlobalConfig } from '../../types/index.js';
import chalk from 'chalk';
import readline from 'readline';

export class InitCommand {
  async execute(options: { path?: string }): Promise<void> {
    console.log(chalk.blue('Initializing Tuition...\n'));

    const manager = new ConfigManager(options.path);
    
    // Check if already initialized
    if (await manager.exists()) {
      console.log(chalk.yellow('⚠ Tuition is already initialized.'));
      console.log(chalk.gray(`Configuration directory: ${manager.getConfigPath()}`));
      return;
    }

    // Initialize directory structure
    await manager.initialize();
    console.log(chalk.green('✓ Created configuration directory'));

    // Interactive setup
    const config = await this.promptForConfig();
    
    // Validate
    const validator = new ConfigValidator();
    const result = validator.validateGlobal(config);

    if (!result.valid) {
      console.log(chalk.red('\n✗ Configuration validation failed:'));
      for (const error of result.errors) {
        console.log(chalk.red(`  - ${error.field}: ${error.message}`));
      }
      return;
    }

    // Save configuration
    await manager.saveGlobal(config);
    console.log(chalk.green('\n✓ Saved global configuration'));

    // Generate secrets file
    const envContent = this.generateEnvFile(config, manager);
    console.log(chalk.green('✓ Generated environment secrets'));

    console.log(chalk.blue('\nTuition has been initialized successfully!'));
    console.log(chalk.gray(`Configuration: ${manager.getConfigPath()}`));
    console.log(chalk.gray(`Data directory: ${manager.getTuitionDir()}`));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Review your configuration: tuition config show'));
    console.log(chalk.gray('  2. Start CoreDNS: tuition dns start'));
    console.log(chalk.gray('  3. Start Caddy: tuition caddy start'));
    console.log(chalk.gray('  4. Enable your first service: tuition service enable <name>'));
  }

  private async promptForConfig(): Promise<GlobalConfig> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, resolve);
      });
    };

    console.log(chalk.blue('Please answer the following questions:\n'));

    const hostname = await ask('Hostname (e.g., homelab-server): ');
    const domain = await ask('Domain (e.g., example.com): ');
    const adminEmail = await ask('Admin email: ');
    const timezone = await ask('Timezone (default: UTC): ') || 'UTC';
    
    console.log(chalk.blue('\nDNS Provider (currently only Cloudflare is supported)'));
    const cloudflareToken = await ask('Cloudflare API Token: ');

    // Upstream DNS Configuration
    console.log(chalk.blue('\nUpstream DNS Configuration:'));
    console.log(chalk.gray('  1) Google (8.8.8.8, 8.8.4.4)'));
    console.log(chalk.gray('  2) Cloudflare (1.1.1.1, 1.0.0.1)'));
    console.log(chalk.gray('  3) OpenDNS (208.67.222.222, 208.67.220.220)'));
    console.log(chalk.gray('  4) Custom (default)'));
    
    const dnsChoice = await ask('\nSelect option [4]: ') || '4';
    
    let primaryDns: string;
    let backupDns: string | undefined;
    
    switch (dnsChoice.trim()) {
      case '1':
        primaryDns = '8.8.8.8';
        backupDns = '8.8.4.4';
        break;
      case '2':
        primaryDns = '1.1.1.1';
        backupDns = '1.0.0.1';
        break;
      case '3':
        primaryDns = '208.67.222.222';
        backupDns = '208.67.220.220';
        break;
      default:
        primaryDns = await ask('Primary DNS server: ');
        const backupInput = await ask('Backup DNS server (optional): ');
        backupDns = backupInput.trim() || undefined;
        break;
    }

    // Admin UI Password Configuration
    console.log(chalk.blue('\nAdmin UI Configuration:'));
    const setPassword = await ask(
      chalk.yellow('Configure admin UI password? (optional) [y/N]: ')
    );
    
    let adminPasswordHash: string | undefined;
    
    if (setPassword.toLowerCase() === 'y') {
      const { promptPassword, hashPassword } = await import('../../utils/password.js');
      
      const password = await promptPassword('Enter admin password: ');
      const confirm = await promptPassword('Confirm password: ');
      
      if (password === confirm && password.length > 0) {
        adminPasswordHash = await hashPassword(password);
        console.log(chalk.green('✓ Admin password configured'));
      } else if (password !== confirm) {
        console.log(chalk.yellow('⚠ Passwords did not match. Skipping admin password setup.'));
      } else {
        console.log(chalk.yellow('⚠ Password cannot be empty. Skipping admin password setup.'));
      }
    }

    rl.close();

    return {
      hostname: hostname.trim(),
      domain: domain.trim(),
      adminEmail: adminEmail.trim(),
      timezone: timezone.trim(),
      puid: 1000,
      pgid: 1000,
      dnsProvider: 'cloudflare',
      cloudflareToken: cloudflareToken.trim(),
      upstreamDns: {
        primary: primaryDns.trim(),
        backup: backupDns?.trim(),
      },
      adminPasswordHash,
    };
  }

  private generateEnvFile(config: GlobalConfig, manager: ConfigManager): string {
    const envVars: Record<string, string> = {
      DOMAIN: config.domain,
      HOSTNAME: config.hostname,
      ADMIN_EMAIL: config.adminEmail,
      TZ: config.timezone,
      PUID: String(config.puid),
      PGID: String(config.pgid),
      CF_API_TOKEN: config.cloudflareToken || '',
    };

    // Generate admin password
    const adminPassword = manager.generatePassword(32);
    envVars['ADMIN_PASSWORD'] = adminPassword;

    // Format as .env file
    const content = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    return content;
  }
}
