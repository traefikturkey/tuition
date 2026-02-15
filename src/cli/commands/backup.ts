/**
 * Backup/restore CLI commands
 */

import { BackupManager } from '../../services/backup/manager.js';
import { ConfigManager } from '../../core/config/manager.js';
import chalk from 'chalk';

export class BackupCommand {
  private backup: BackupManager;
  private config: ConfigManager;

  constructor(configPath?: string) {
    this.config = new ConfigManager(configPath);
    this.backup = new BackupManager(this.config);
  }

  /**
   * Initialize managers
   */
  async initialize(): Promise<void> {
    await this.backup.initialize();
  }

  /**
   * Create a new backup
   */
  async create(options: {
    includeVolumes?: boolean;
    noCompression?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    if (!(await this.config.exists())) {
      console.log(chalk.red('Tuition is not initialized. Run: tuition init'));
      return;
    }

    console.log(chalk.blue('Creating backup...\n'));

    const result = await this.backup.createBackup({
      includeConfigs: true,
      includeDatabases: true,
      includeVolumes: options.includeVolumes || false,
      compression: !options.noCompression,
      destination: options.path || undefined,
    });

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
      if (result.metadata) {
        console.log(chalk.gray(`  Created: ${result.metadata.createdAt}`));
        console.log(chalk.gray(`  Components: ${result.metadata.services.join(', ')}`));
      }
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * List available backups
   */
  async list(options: { path?: string }): Promise<void> {
    await this.initialize();

    const backups = await this.backup.listBackups();

    if (backups.length === 0) {
      console.log(chalk.yellow('No backups found'));
      console.log(chalk.gray(`Backup directory: ${this.config.getTuitionDir()}/backups`));
      return;
    }

    console.log(chalk.blue(`\nAvailable Backups:\n`));
    
    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i]!;
      const date = new Date(backup.createdAt).toLocaleString();
      const size = this.formatBytes(backup.size);
      
      console.log(`${chalk.cyan(`[${i + 1}]`)} ${chalk.white(backup.name)}`);
      console.log(`    Created: ${chalk.gray(date)}`);
      console.log(`    Size: ${chalk.gray(size)}`);
      if (backup.services.length > 0) {
        console.log(`    Contains: ${chalk.gray(backup.services.join(', '))}`);
      }
      console.log();
    }
  }

  /**
   * Restore from backup
   */
  async restore(backupIdentifier: string, options: {
    dryRun?: boolean;
    force?: boolean;
    path?: string;
  }): Promise<void> {
    await this.initialize();

    // If identifier is a number, look up by index
    let backupPath = backupIdentifier;
    
    if (/^\d+$/.test(backupIdentifier)) {
      const index = parseInt(backupIdentifier, 10) - 1;
      const backups = await this.backup.listBackups();
      
      if (index < 0 || index >= backups.length) {
        console.log(chalk.red(`Invalid backup number: ${backupIdentifier}`));
        console.log(chalk.gray('Run "tuition backup list" to see available backups'));
        return;
      }
      
      backupPath = backups[index]!.path;
    }

    // If path is relative, assume it's in backup directory
    if (!backupPath.startsWith('/') && !backupPath.startsWith('\\')) {
      backupPath = `${this.config.getTuitionDir()}/backups/${backupPath}`;
    }

    if (options.dryRun) {
      console.log(chalk.blue('Performing dry run...\n'));
    } else {
      console.log(chalk.blue('Restoring from backup...\n'));
      
      if (!options.force) {
        console.log(chalk.yellow('Warning: This will overwrite current configuration!'));
        console.log(chalk.yellow('Add --force to skip this confirmation'));
        return;
      }
    }

    const result = await this.backup.restoreBackup(backupPath, {
      dryRun: options.dryRun,
      force: options.force,
    });

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
      if (result.restored && result.restored.length > 0) {
        console.log(chalk.gray(`  Restored: ${result.restored.join(', ')}`));
      }
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Delete a backup
   */
  async delete(backupIdentifier: string, options: { path?: string }): Promise<void> {
    await this.initialize();

    // If identifier is a number, look up by index
    let backupPath = backupIdentifier;
    
    if (/^\d+$/.test(backupIdentifier)) {
      const index = parseInt(backupIdentifier, 10) - 1;
      const backups = await this.backup.listBackups();
      
      if (index < 0 || index >= backups.length) {
        console.log(chalk.red(`Invalid backup number: ${backupIdentifier}`));
        return;
      }
      
      backupPath = backups[index]!.path;
    }

    // If path is relative, assume it's in backup directory
    if (!backupPath.startsWith('/') && !backupPath.startsWith('\\')) {
      backupPath = `${this.config.getTuitionDir()}/backups/${backupPath}`;
    }

    console.log(chalk.blue(`Deleting backup...\n`));

    const result = await this.backup.deleteBackup(backupPath);

    if (result.success) {
      console.log(chalk.green(`✓ ${result.message}`));
    } else {
      console.log(chalk.red(`✗ ${result.message}`));
    }
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
