/**
 * Validate command - checks configuration for errors
 */

import { ConfigManager } from '../../core/config/manager.js';
import { ConfigValidator } from '../../core/config/validator.js';
import chalk from 'chalk';

export class ValidateCommand {
  async execute(options: { path?: string }): Promise<boolean> {
    console.log(chalk.blue('Validating Tuition configuration...\n'));

    const manager = new ConfigManager(options.path);
    
    // Check if initialized
    if (!(await manager.exists())) {
      console.log(chalk.red('✗ Tuition is not initialized'));
      console.log(chalk.gray('Run: tuition init'));
      return false;
    }

    const validator = new ConfigValidator();
    let hasErrors = false;

    // Validate global config
    try {
      const globalConfig = await manager.loadGlobal();
      const result = validator.validateGlobal(globalConfig);

      if (result.valid) {
        console.log(chalk.green('✓ Global configuration is valid'));
      } else {
        hasErrors = true;
        console.log(chalk.red('✗ Global configuration has errors:'));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error.field}: ${error.message}`));
        }
      }
    } catch (error) {
      hasErrors = true;
      console.log(chalk.red(`✗ Failed to load global configuration: ${error}`));
    }

    // Validate infrastructure config (if exists)
    try {
      const infraConfig = await manager.loadInfrastructure();
      if (infraConfig) {
        console.log(chalk.green('✓ Infrastructure configuration is valid'));
      }
    } catch (error) {
      hasErrors = true;
      console.log(chalk.red(`✗ Failed to load infrastructure configuration: ${error}`));
    }

    // Validate service configs
    const services = await manager.loadServices();
    const serviceCount = Object.keys(services).length;

    if (serviceCount === 0) {
      console.log(chalk.yellow('⚠ No service configurations found'));
    } else {
      console.log(chalk.blue(`\nValidating ${serviceCount} service(s)...`));
      
      for (const [name, config] of Object.entries(services)) {
        const result = validator.validateService(name, config);
        
        if (result.valid) {
          console.log(chalk.green(`  ✓ ${name}`));
        } else {
          hasErrors = true;
          console.log(chalk.red(`  ✗ ${name}:`));
          for (const error of result.errors) {
            console.log(chalk.red(`      - ${error.field}: ${error.message}`));
          }
        }
      }
    }

    console.log();
    if (hasErrors) {
      console.log(chalk.red('✗ Validation failed. Please fix the errors above.'));
    } else {
      console.log(chalk.green('✓ All configurations are valid'));
    }

    return !hasErrors;
  }
}
