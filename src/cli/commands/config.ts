/**
 * Config command - manage configuration values
 */

import { ConfigManager } from "../../core/config/manager.js";
import chalk from "chalk";

const SENSITIVE_KEY_PATTERN = /(token|password|secret|key|hash)/i;
const UNSAFE_CONFIG_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function redactSensitiveValues<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item)) as T;
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redactSensitiveValues(nestedValue);
      }
    }

    return output as T;
  }

  return value;
}

export class ConfigCommand {
  async show(options: { path?: string }): Promise<void> {
    const manager = new ConfigManager(options.path);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      console.log(chalk.gray("Run: tuition init"));
      return;
    }

    const config = await manager.load();
    const redactedConfig = redactSensitiveValues(config);

    console.log(chalk.blue("Global Configuration:\n"));
    console.log(chalk.gray(JSON.stringify(redactedConfig.global, null, 2)));

    if (redactedConfig.infrastructure) {
      console.log(chalk.blue("\nInfrastructure Configuration:\n"));
      console.log(chalk.gray(JSON.stringify(redactedConfig.infrastructure, null, 2)));
    }

    if (Object.keys(redactedConfig.services).length > 0) {
      console.log(chalk.blue("\nService Configurations:\n"));
      for (const [name, serviceConfig] of Object.entries(redactedConfig.services)) {
        console.log(chalk.gray(`${name}:`));
        console.log(chalk.gray(JSON.stringify(serviceConfig, null, 2)));
      }
    }
  }

  async set(key: string, value: string, options: { path?: string }): Promise<void> {
    const manager = new ConfigManager(options.path);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      return;
    }

    // Parse key path (e.g., "global.domain" or "services.jellyfin.enabled")
    const parts = key.split(".");

    if (parts.length < 2) {
      console.log(chalk.red("Invalid key format. Use: <section>.<key> or <section>.<service>.<key>"));
      return;
    }

    const section = parts[0];

    try {
      switch (section) {
        case "global": {
          if (parts.length !== 2) {
            console.log(chalk.red("Invalid key format. Use: global.<key>"));
            return;
          }

          const config = await manager.loadGlobal();
          const configKey = parts[1] as keyof typeof config;

          if (UNSAFE_CONFIG_KEYS.has(String(configKey))) {
            console.log(chalk.red("Unsafe configuration key"));
            return;
          }

          // Try to parse as number/boolean
          let parsedValue: string | number | boolean = value;
          if (value === "true") parsedValue = true;
          else if (value === "false") parsedValue = false;
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
