/**
 * CLI command definitions
 */

import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "../../core/config/manager.js";
import { ConfigValidator } from "../../core/config/validator.js";
import { InitCommand } from "./init.js";
import { ValidateCommand } from "./validate.js";
import { ConfigCommand } from "./config.js";
import { ServiceCommand } from "./service.js";
import { CaddyCommand } from "./caddy.js";
import { DnsCommand } from "./dns.js";
import { BackupCommand } from "./backup.js";
import { InfraCommand } from "./infra.js";
import { TuiApp } from "../../tui/app.js";

export function createCli(): Command {
  const program = new Command();

  program.name("tuition").description("Terminal UI for homelab management").version("0.1.0");

  // Initialize command
  program
    .command("init")
    .description("Initialize tuition configuration")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new InitCommand();
      await cmd.execute(options);
    });

  // Validate command
  program
    .command("validate")
    .description("Validate configuration")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new ValidateCommand();
      const result = await cmd.execute(options);
      process.exit(result ? 0 : 1);
    });

  // Config command
  const configCmd = program.command("config").description("Manage configuration");

  configCmd
    .command("show")
    .description("Display current configuration")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new ConfigCommand();
      await cmd.show(options);
    });

  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (key, value, options) => {
      const cmd = new ConfigCommand();
      await cmd.set(key, value, options);
    });

  // Service command group
  const serviceCmd = program.command("service").description("Manage services");

  serviceCmd
    .command("list")
    .description("List available services")
    .option("-c, --category <category>", "Filter by category")
    .option("-a, --all", "Show all services including disabled")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.list(options);
    });

  serviceCmd
    .command("show <name>")
    .description("Show service details")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.show(name, options);
    });

  serviceCmd
    .command("enable <name>")
    .description("Enable a service")
    .option("--no-start", "Do not start the service automatically")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.enable(name, options);
    });

  serviceCmd
    .command("disable <name>")
    .description("Disable a service")
    .option("--remove-data", "Remove service data (destructive)")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.disable(name, options);
    });

  serviceCmd
    .command("remove <name>")
    .description("Remove a service completely (config + data)")
    .option("--keep-data", "Preserve service data directory")
    .option("--force", "Skip confirmation prompt")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.remove(name, options);
    });

  serviceCmd
    .command("start <name>")
    .description("Start a service")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.start(name, options);
    });

  serviceCmd
    .command("stop <name>")
    .description("Stop a service")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.stop(name, options);
    });

  serviceCmd
    .command("restart <name>")
    .description("Restart a service")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.restart(name, options);
    });

  serviceCmd
    .command("update <name>")
    .description("Update service to latest image")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.update(name, options);
    });

  serviceCmd
    .command("logs <name>")
    .description("Show service logs")
    .option("-t, --tail <lines>", "Number of lines to show", "100")
    .option("-f, --follow", "Follow log output")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.logs(name, {
        tail: parseInt(options.tail, 10),
        follow: options.follow,
      });
    });

  serviceCmd
    .command("search <query>")
    .description("Search for services")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (query, options) => {
      const cmd = new ServiceCommand(options.path);
      await cmd.search(query, options);
    });

  // Caddy command group
  const caddyCmd = program.command("caddy").description("Manage Caddy reverse proxy");

  caddyCmd
    .command("start")
    .description("Start Caddy reverse proxy")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.start(options);
    });

  caddyCmd
    .command("stop")
    .description("Stop Caddy reverse proxy")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.stop(options);
    });

  caddyCmd
    .command("restart")
    .description("Restart Caddy reverse proxy")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.restart(options);
    });

  caddyCmd
    .command("reload")
    .description("Reload Caddy configuration")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.reload(options);
    });

  caddyCmd
    .command("status")
    .description("Show Caddy status")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.status(options);
    });

  caddyCmd
    .command("regenerate")
    .description("Regenerate Caddyfile from enabled services")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.regenerate(options);
    });

  caddyCmd
    .command("hash-password")
    .description("Generate password hash for admin UI (legacy: use set-password)")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.hashPassword(options);
    });

  caddyCmd
    .command("set-password")
    .description("Set or update admin UI password")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new CaddyCommand(options.path);
      await cmd.setPassword(options);
    });

  // DNS command group
  const dnsCmd = program.command("dns").description("Manage internal DNS (CoreDNS)");

  dnsCmd
    .command("start")
    .description("Start CoreDNS internal DNS server")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new DnsCommand(options.path);
      await cmd.start(options);
    });

  dnsCmd
    .command("stop")
    .description("Stop CoreDNS")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new DnsCommand(options.path);
      await cmd.stop(options);
    });

  dnsCmd
    .command("status")
    .description("Show CoreDNS status")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new DnsCommand(options.path);
      await cmd.status(options);
    });

  dnsCmd
    .command("regenerate")
    .description("Regenerate CoreDNS configuration")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new DnsCommand(options.path);
      await cmd.regenerate(options);
    });

  dnsCmd
    .command("configure")
    .description("Configure upstream DNS servers interactively")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new DnsCommand(options.path);
      await cmd.configure();
    });

  dnsCmd
    .command("cluster")
    .description("Configure DNS clustering interactively")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new DnsCommand(options.path);
      await cmd.cluster();
    });

  // Backup command group
  const backupCmd = program.command("backup").description("Manage backups and disaster recovery");

  backupCmd
    .command("create")
    .description("Create a new backup")
    .option("--include-volumes", "Include service data volumes")
    .option("--no-compression", "Disable compression")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new BackupCommand(options.path);
      await cmd.create({
        includeVolumes: options.includeVolumes,
        noCompression: options.compression === false,
      });
    });

  backupCmd
    .command("list")
    .description("List available backups")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new BackupCommand(options.path);
      await cmd.list(options);
    });

  backupCmd
    .command("restore <identifier>")
    .description("Restore from backup (use number from list or filename)")
    .option("--dry-run", "Show what would be restored without applying")
    .option("--force", "Skip confirmation prompt")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (identifier, options) => {
      const cmd = new BackupCommand(options.path);
      await cmd.restore(identifier, options);
    });

  backupCmd
    .command("delete <identifier>")
    .description("Delete a backup (use number from list or filename)")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (identifier, options) => {
      const cmd = new BackupCommand(options.path);
      await cmd.delete(identifier, options);
    });

  // Infra command group
  const infraCmd = program.command("infra").description("Manage host infrastructure (NFS shares, external services)");

  const infraNfsCmd = infraCmd.command("nfs").description("Manage NFS share definitions");

  infraNfsCmd
    .command("list")
    .description("List configured NFS shares")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new InfraCommand(options.path);
      await cmd.nfsList(options);
    });

  infraNfsCmd
    .command("show <name>")
    .description("Show details for a specific NFS share")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new InfraCommand(options.path);
      await cmd.nfsShow(name, options);
    });

  infraNfsCmd
    .command("add")
    .description("Add an NFS share definition")
    .requiredOption("-n, --name <name>", "Reference name (e.g. media)")
    .requiredOption("-s, --server <server>", "NFS server hostname or IP")
    .requiredOption("-e, --path <path>", "Export path on NFS server (e.g. /export/media)")
    .option("-o, --options <options>", "Mount options (default: rw,soft,noatime)")
    .option("-p, --config-path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new InfraCommand(options.configPath);
      await cmd.nfsAdd({
        name: options.name,
        server: options.server,
        path: options.path,
        options: options.options,
        path_config: options.configPath,
      });
    });

  infraNfsCmd
    .command("remove <name>")
    .description("Remove an NFS share definition")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new InfraCommand(options.path);
      await cmd.nfsRemove(name, options);
    });

  const infraExternalCmd = infraCmd.command("external").description("Manage external (non-Docker) service routes");

  infraExternalCmd
    .command("list")
    .description("List configured external services")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new InfraCommand(options.path);
      await cmd.externalList(options);
    });

  infraExternalCmd
    .command("show <name>")
    .description("Show details for a specific external service")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new InfraCommand(options.path);
      await cmd.externalShow(name, options);
    });

  infraExternalCmd
    .command("add")
    .description("Add an external service (generates a Caddy reverse-proxy route)")
    .requiredOption("-n, --name <name>", "Reference name, e.g. nas")
    .requiredOption("-u, --url <url>", "Upstream URL, e.g. http://192.168.1.20:5000")
    .option("-s, --subdomain <subdomain>", "Caddy subdomain override (defaults to name)")
    .option("-d, --dns", "Register hostname in CoreDNS hosts file")
    .option("--description <text>", "Human-readable label")
    .option("-p, --config-path <path>", "Custom configuration path")
    .action(async (options) => {
      const cmd = new InfraCommand(options.configPath);
      await cmd.externalAdd({
        name: options.name,
        url: options.url,
        subdomain: options.subdomain,
        dns: options.dns,
        description: options.description,
        path_config: options.configPath,
      });
    });

  infraExternalCmd
    .command("remove <name>")
    .description("Remove an external service")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (name, options) => {
      const cmd = new InfraCommand(options.path);
      await cmd.externalRemove(name, options);
    });

  // TUI command
  program
    .command("tui")
    .description("Launch interactive terminal UI")
    .option("-p, --path <path>", "Custom configuration path")
    .action(async (options) => {
      const app = new TuiApp(options.path);
      await app.run();
    });

  return program;
}
