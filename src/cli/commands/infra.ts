/**
 * Infrastructure command - manage NFS mounts and external services
 */

import { ConfigManager } from '../../core/config/manager.js';
import { ConfigValidator } from '../../core/config/validator.js';
import type { NfsConfig } from '../../types/index.js';
import chalk from 'chalk';

export class InfraCommand {
  private configPath?: string;

  constructor(configPath?: string) {
    this.configPath = configPath;
  }

  private manager(): ConfigManager {
    return new ConfigManager(this.configPath);
  }

  // ── NFS ────────────────────────────────────────────────────────────────────

  /**
   * List all NFS entries in infrastructure config.
   */
  async nfsList(options: { path?: string } = {}): Promise<void> {
    const manager = new ConfigManager(options.path ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red('Tuition is not initialized'));
      console.log(chalk.gray('Run: tuition init'));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entries = infra?.nfs ?? [];

    if (entries.length === 0) {
      console.log(chalk.yellow('No NFS shares configured'));
      console.log(chalk.gray('Add one with: tuition infra nfs add --name <name> --server <host> --path <export>'));
      return;
    }

    console.log(chalk.blue('\nConfigured NFS Shares:\n'));
    for (const nfs of entries) {
      console.log(`  ${chalk.white(nfs.name.padEnd(15))}  ${chalk.cyan(nfs.server)}  ${chalk.gray(nfs.path)}`);
      if (nfs.options) {
        console.log(`  ${''.padEnd(15)}  ${chalk.gray('options: ' + nfs.options)}`);
      }
    }
    console.log();
  }

  /**
   * Show details for a single NFS entry.
   */
  async nfsShow(name: string, options: { path?: string } = {}): Promise<void> {
    const manager = new ConfigManager(options.path ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red('Tuition is not initialized'));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entry = infra?.nfs?.find((n) => n.name === name);

    if (!entry) {
      console.log(chalk.red(`NFS share '${name}' not found`));
      return;
    }

    console.log(chalk.blue(`\nNFS Share: ${entry.name}\n`));
    console.log(`  Server:  ${chalk.cyan(entry.server)}`);
    console.log(`  Path:    ${chalk.cyan(entry.path)}`);
    if (entry.options) {
      console.log(`  Options: ${chalk.gray(entry.options)}`);
    }
    console.log();
  }

  /**
   * Add a new NFS entry to infrastructure config.
   */
  async nfsAdd(
    options: {
      name: string;
      server: string;
      path: string;
      options?: string;
      path_config?: string;
    }
  ): Promise<void> {
    const manager = new ConfigManager(options.path_config ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red('Tuition is not initialized'));
      console.log(chalk.gray('Run: tuition init'));
      return;
    }

    const newEntry: NfsConfig = {
      name: options.name,
      server: options.server,
      path: options.path,
      // mountPoint no longer needed for Docker-managed volumes, kept for type compat
      mountPoint: '',
      options: options.options,
    };

    // Validate before saving
    const validator = new ConfigValidator();
    const tempInfra = { nfs: [newEntry] };
    const result = validator.validateInfrastructure(tempInfra);
    if (!result.valid) {
      console.log(chalk.red('✗ Invalid NFS configuration:'));
      for (const error of result.errors) {
        console.log(chalk.red(`  - ${error.field}: ${error.message}`));
      }
      return;
    }

    const infra = (await manager.loadInfrastructure()) ?? {};
    const existing = infra.nfs ?? [];

    if (existing.some((n) => n.name === options.name)) {
      console.log(chalk.red(`✗ NFS share '${options.name}' already exists`));
      console.log(chalk.gray(`  Use 'tuition infra nfs remove ${options.name}' first to replace it`));
      return;
    }

    infra.nfs = [...existing, newEntry];
    await manager.saveInfrastructure(infra);
    console.log(chalk.green(`✓ NFS share '${options.name}' added (${options.server}:${options.path})`));
  }

  /**
   * Remove an NFS entry from infrastructure config.
   */
  async nfsRemove(name: string, options: { path?: string } = {}): Promise<void> {
    const manager = new ConfigManager(options.path ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red('Tuition is not initialized'));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entries = infra?.nfs ?? [];
    const idx = entries.findIndex((n) => n.name === name);

    if (idx === -1) {
      console.log(chalk.red(`✗ NFS share '${name}' not found`));
      return;
    }

    const updated = { ...infra, nfs: [...entries.slice(0, idx), ...entries.slice(idx + 1)] };
    await manager.saveInfrastructure(updated);
    console.log(chalk.green(`✓ NFS share '${name}' removed`));
  }
}
