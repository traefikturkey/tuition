/**
 * Config command - manage configuration values
 */

import { ConfigManager } from '../../core/config/manager.js';
import chalk from 'chalk';

export class ConfigCommand {
  async show(options: { path?: string }): Promise<void> {
    const manager = new ConfigManager(options.path);

    if (!(await manager.exists())) {
      console.log(chalk.red('Tuition is not initialized'));
      console.log(chalk.gray('Run: tuition init'));
      return;
    }

    const config = await manager.load();

    console.log(chalk.blue('Global Configuration:\n'));
    console.log(chalk.gray(JSON.stringify(config.global, null, 2)));

    if (config.infrastructure) {
      console.log(chalk.blue('\nInfrastructure Configuration:\n'));
      console.log(chalk.gray(JSON.stringify(config.infrastructure, null, 2)));
    }

    if (Object.keys(config.services).length > 0) {
      console.log(chalk.blue('\nService Configurations:\n'));
      for (const [name, serviceConfig] of Object.entries(config.services)) {
        console.log(chalk.gray(`${name}:`));
        console.log(chalk.gray(JSON.stringify(serviceConfig, null, 2)));
      }
    }
  }

  async set(key: string, value: string, options: { path?: string }): Promise<void> {
    const manager = new ConfigManager(options.path);

    if (!(await manager.exists())) {
      console.log(chalk.red('Tuition is not initialized'));
      return;
    }

    // Parse key path (e.g., "global.domain" or "services.jellyfin.enabled")
    const parts = key.split('.');
    
    if (parts.length < 2) {
      console.log(chalk.red('Invalid key format. Use: <section>.<key> or <section>.<service>.<key>'));
      return;
    }

    const section = parts[0];

    try {
      switch (section) {
        case 'global': {
          const config = await manager.loadGlobal();
          const configKey = parts[1] as keyof typeof config;
          
          // Try to parse as number/boolean
          let parsedValue: string | number | boolean = value;
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          else if (!isNaN(Number(value))) parsedValue = Number(value);
          
          (config as unknown as Record<string, unknown>)[configKey] = parsedValue;
          await manager.saveGlobal(config);
          console.log(chalk.green(`✓ Set global.${configKey} = ${parsedValue}`));
          break;
        }
        
        default:
          console.log(chalk.red(`Unknown configuration section: ${section}`));
          return;
      }
    } catch (error) {
      console.log(chalk.red(`Failed to set configuration: ${error}`));
    }
  }
}
