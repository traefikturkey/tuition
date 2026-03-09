/**
 * CoreDNS management CLI commands
 */

import { CoreDnsManager } from '../../services/dns/coredns.js';
import { ConfigManager } from '../../core/config/manager.js';
import { ConfigValidator } from '../../core/config/validator.js';
import { catalog } from '../../core/catalog/loader.js';
import chalk from 'chalk';
import readline from 'readline';

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

    // Load cluster configuration from global config
    const globalConfig = await this.config.loadGlobal();
    const dnsCluster = globalConfig.dnsCluster;

    console.log(chalk.blue('Starting CoreDNS...'));
    const result = await this.dns.start(dnsCluster);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
      console.log(chalk.gray('Internal DNS server running on port 54'));
      if (dnsCluster?.enabled) {
        console.log(chalk.green(`✓ Clustering enabled (node: ${dnsCluster.nodeName ?? 'default'})`));
      }
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
      console.log(chalk.gray('\n  Internal DNS available on port 54'));
      console.log(chalk.gray('  Configure your system to use 127.0.0.1 as DNS server'));
    }

    // Show cluster info if configured
    if (await this.config.exists()) {
      const globalConfig = await this.config.loadGlobal();
      if (globalConfig.dnsCluster?.enabled) {
        console.log(`\n  Cluster: enabled`);
        console.log(`  Node: ${globalConfig.dnsCluster.nodeName ?? 'default'}`);
        if (globalConfig.dnsCluster.clusterSeeds?.length) {
          console.log(`  Seeds: ${globalConfig.dnsCluster.clusterSeeds.map(ip => `${ip}:7946`).join(', ')}`);
        }
      }
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

  /**
   * Configure DNS clustering interactively
   */
  async cluster(): Promise<void> {
    if (!(await this.config.exists())) {
      console.log(chalk.red('Tuition is not initialized. Run: tuition init'));
      return;
    }

    const globalConfig = await this.config.loadGlobal();
    const validator = new ConfigValidator();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, resolve);
      });
    };

    console.log(chalk.blue('\nConfigure DNS Clustering\n'));

    // Show current configuration
    const current = globalConfig.dnsCluster;
    if (current?.enabled) {
      console.log(chalk.gray(`Current: enabled (node: ${current.nodeName ?? 'default'})\n`));
    }

    const enableAnswer = await ask('Enable DNS clustering? (y/n): ');
    const enabled = enableAnswer.trim().toLowerCase() === 'y';

    if (!enabled) {
      globalConfig.dnsCluster = {
        ...globalConfig.dnsCluster,
        enabled: false,
      };
      await this.config.saveGlobal(globalConfig);
      rl.close();
      console.log(chalk.green('\n✓ DNS cluster configuration saved'));
      return;
    }

    const defaultNodeName = globalConfig.hostname ?? '';
    const nodeNameInput = await ask(`Node name [${defaultNodeName}]: `);
    const nodeName = nodeNameInput.trim() || defaultNodeName;

    const secretInput = await ask('Cluster secret (optional): ');
    const clusterSecret = secretInput.trim() || undefined;

    // Seed IPs with validation loop
    let clusterSeeds: string[] = [];
    while (true) {
      const seedsInput = await ask('Cluster seeds (comma-separated IPs, port 7946 added automatically, optional): ');
      const seedsRaw = seedsInput.trim();

      if (!seedsRaw) {
        clusterSeeds = [];
        break;
      }

      const seeds = seedsRaw.split(',').map(s => s.trim()).filter(Boolean);
      const invalidSeeds = seeds.filter(s => {
        const testConfig = {
          ...globalConfig,
          dnsCluster: { enabled: true, clusterSeeds: [s] },
        };
        const result = validator.validateGlobal(testConfig);
        return result.errors.some(e => e.field === 'dnsCluster.clusterSeeds');
      });

      if (invalidSeeds.length > 0) {
        console.log(chalk.red(`Invalid IP address(es): ${invalidSeeds.join(', ')}. Please try again.`));
        continue;
      }

      clusterSeeds = seeds;
      break;
    }

    globalConfig.dnsCluster = {
      enabled: true,
      nodeName,
      clusterSecret,
      clusterSeeds,
    };

    await this.config.saveGlobal(globalConfig);
    rl.close();
    console.log(chalk.green('\n✓ DNS cluster configuration saved'));
    console.log(chalk.gray('Restart CoreDNS to apply: tuition dns start'));
  }

  /**
   * Configure upstream DNS servers interactively
   */
  async configure(): Promise<void> {
    if (!(await this.config.exists())) {
      console.log(chalk.red('Tuition is not initialized. Run: tuition init'));
      return;
    }

    const globalConfig = await this.config.loadGlobal();
    const validator = new ConfigValidator();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, resolve);
      });
    };

    console.log(chalk.blue('\nConfigure Upstream DNS Servers\n'));

    // Show current configuration
    const current = globalConfig.upstreamDns;
    if (current?.primary) {
      console.log(chalk.gray(`Current upstream DNS: ${current.primary}${current.backup ? `, ${current.backup}` : ''}\n`));
    }

    console.log(chalk.blue('Upstream DNS Configuration:'));
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
        // Custom - loop until valid IP entered
        while (true) {
          primaryDns = await ask('Primary DNS server: ');
          const validation = validator.validateGlobal({
            ...globalConfig,
            upstreamDns: { primary: primaryDns.trim() },
          });
          if (validation.valid || !validation.errors.some(e => e.field === 'upstreamDns.primary')) {
            break;
          }
          console.log(chalk.red('Invalid IP address. Please try again.'));
        }
        
        const backupInput = await ask('Backup DNS server (optional): ');
        if (backupInput.trim()) {
          while (true) {
            const validation = validator.validateGlobal({
              ...globalConfig,
              upstreamDns: { primary: primaryDns.trim(), backup: backupInput.trim() },
            });
            if (validation.valid || !validation.errors.some(e => e.field === 'upstreamDns.backup')) {
              backupDns = backupInput.trim();
              break;
            }
            console.log(chalk.red('Invalid IP address. Please try again.'));
            const retry = await ask('Backup DNS server (optional): ');
            if (!retry.trim()) break;
          }
        }
        break;
    }

    rl.close();

    // Update configuration
    globalConfig.upstreamDns = {
      primary: primaryDns.trim(),
      backup: backupDns?.trim(),
    };

    await this.config.saveGlobal(globalConfig);
    console.log(chalk.green('\n✓ Upstream DNS configuration saved'));

    // Regenerate CoreDNS config and reload
    console.log(chalk.blue('\nRegenerating CoreDNS configuration...'));
    
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

    await this.dns.generateConfig(enabledServices);
    
    const result = await this.dns.reload();
    
    if (result.success) {
      console.log(chalk.green(`✓ CoreDNS reloaded with new upstream DNS`));
    } else {
      console.log(chalk.red(`✗ Failed to reload CoreDNS: ${result.message}`));
      console.log(chalk.gray('You may need to restart CoreDNS manually: tuition dns restart'));
    }
  }
}
