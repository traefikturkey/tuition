/**
 * Infrastructure command - manage NFS mounts and external services
 */

import { ConfigManager } from "../../core/config/manager.js";
import { ConfigValidator } from "../../core/config/validator.js";
import type { NfsConfig, ExternalService } from "../../types/index.js";
import chalk from "chalk";

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
      console.log(chalk.red("Tuition is not initialized"));
      console.log(chalk.gray("Run: tuition init"));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entries = infra?.nfs ?? [];

    if (entries.length === 0) {
      console.log(chalk.yellow("No NFS shares configured"));
      console.log(chalk.gray("Add one with: tuition infra nfs add --name <name> --server <host> --path <export>"));
      return;
    }

    console.log(chalk.blue("\nConfigured NFS Shares:\n"));
    for (const nfs of entries) {
      console.log(`  ${chalk.white(nfs.name.padEnd(15))}  ${chalk.cyan(nfs.server)}  ${chalk.gray(nfs.path)}`);
      if (nfs.options) {
        console.log(`  ${"".padEnd(15)}  ${chalk.gray("options: " + nfs.options)}`);
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
      console.log(chalk.red("Tuition is not initialized"));
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
  async nfsAdd(options: {
    name: string;
    server: string;
    path: string;
    options?: string;
    path_config?: string;
  }): Promise<void> {
    const manager = new ConfigManager(options.path_config ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      console.log(chalk.gray("Run: tuition init"));
      return;
    }

    const newEntry: NfsConfig = {
      name: options.name,
      server: options.server,
      path: options.path,
      // mountPoint no longer needed for Docker-managed volumes, kept for type compat
      mountPoint: "",
      options: options.options,
    };

    // Validate before saving
    const validator = new ConfigValidator();
    const tempInfra = { nfs: [newEntry] };
    const result = validator.validateInfrastructure(tempInfra);
    if (!result.valid) {
      console.log(chalk.red("✗ Invalid NFS configuration:"));
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
      console.log(chalk.red("Tuition is not initialized"));
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

  // ── External Services ──────────────────────────────────────────────────────

  /**
   * List all external service entries.
   */
  async externalList(options: { path?: string } = {}): Promise<void> {
    const manager = new ConfigManager(options.path ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      console.log(chalk.gray("Run: tuition init"));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entries = infra?.externalServices ?? [];

    if (entries.length === 0) {
      console.log(chalk.yellow("No external services configured"));
      console.log(chalk.gray("Add one with: tuition infra external add --name <name> --url <url>"));
      return;
    }

    console.log(chalk.blue("\nConfigured External Services:\n"));
    for (const svc of entries) {
      const subdomain = svc.subdomain ?? svc.name;
      const dns = svc.dns ? chalk.green(" [dns]") : "";
      console.log(`  ${chalk.white(svc.name.padEnd(15))}  ${chalk.cyan(svc.url)}  ${chalk.gray(subdomain + ".<domain>")}${dns}`);
      if (svc.description) {
        console.log(`  ${"".padEnd(15)}  ${chalk.gray(svc.description)}`);
      }
    }
    console.log();
  }

  /**
   * Show details for a single external service entry.
   */
  async externalShow(name: string, options: { path?: string } = {}): Promise<void> {
    const manager = new ConfigManager(options.path ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entry = infra?.externalServices?.find((s) => s.name === name);

    if (!entry) {
      console.log(chalk.red(`External service '${name}' not found`));
      return;
    }

    console.log(chalk.blue(`\nExternal Service: ${entry.name}\n`));
    console.log(`  URL:       ${chalk.cyan(entry.url)}`);
    console.log(`  Subdomain: ${chalk.cyan(entry.subdomain ?? entry.name)}`);
    console.log(`  DNS:       ${entry.dns ? chalk.green("yes") : chalk.gray("no")}`);
    if (entry.description) {
      console.log(`  Notes:     ${chalk.gray(entry.description)}`);
    }
    console.log();
  }

  /**
   * Add a new external service entry.
   */
  async externalAdd(options: {
    name: string;
    url: string;
    subdomain?: string;
    dns?: boolean;
    description?: string;
    path_config?: string;
  }): Promise<void> {
    const manager = new ConfigManager(options.path_config ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      console.log(chalk.gray("Run: tuition init"));
      return;
    }

    const newEntry: ExternalService = {
      name: options.name,
      url: options.url,
      subdomain: options.subdomain,
      dns: options.dns,
      description: options.description,
    };

    // Validate before saving
    const validator = new ConfigValidator();
    const tempInfra = { externalServices: [newEntry] };
    const result = validator.validateInfrastructure(tempInfra);
    if (!result.valid) {
      console.log(chalk.red("✗ Invalid external service configuration:"));
      for (const error of result.errors) {
        console.log(chalk.red(`  - ${error.field}: ${error.message}`));
      }
      return;
    }

    const infra = (await manager.loadInfrastructure()) ?? {};
    const existing = infra.externalServices ?? [];

    if (existing.some((s) => s.name === options.name)) {
      console.log(chalk.red(`✗ External service '${options.name}' already exists`));
      console.log(chalk.gray(`  Use 'tuition infra external remove ${options.name}' first to replace it`));
      return;
    }

    infra.externalServices = [...existing, newEntry];
    await manager.saveInfrastructure(infra);
    console.log(chalk.green(`✓ External service '${options.name}' added (${options.url})`));
    if (options.dns) {
      console.log(chalk.gray(`  Run 'tuition dns regenerate' to register ${options.subdomain ?? options.name}.<domain> in DNS`));
    }
    console.log(chalk.gray(`  Run 'tuition caddy regenerate' to add the Caddy route`));
  }

  /**
   * Remove an external service entry.
   */
  async externalRemove(name: string, options: { path?: string } = {}): Promise<void> {
    const manager = new ConfigManager(options.path ?? this.configPath);

    if (!(await manager.exists())) {
      console.log(chalk.red("Tuition is not initialized"));
      return;
    }

    const infra = await manager.loadInfrastructure();
    const entries = infra?.externalServices ?? [];
    const idx = entries.findIndex((s) => s.name === name);

    if (idx === -1) {
      console.log(chalk.red(`✗ External service '${name}' not found`));
      return;
    }

    const updated = { ...infra, externalServices: [...entries.slice(0, idx), ...entries.slice(idx + 1)] };
    await manager.saveInfrastructure(updated);
    console.log(chalk.green(`✓ External service '${name}' removed`));
    console.log(chalk.gray(`  Run 'tuition caddy regenerate' to remove the Caddy route`));
  }
}
