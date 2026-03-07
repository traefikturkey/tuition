/**
 * Backup manager for disaster recovery
 * Implements 3-2-1 backup strategy
 */

import { createReadStream, createWriteStream } from "fs";
import { readFile, writeFile, mkdir, readdir, stat, rm } from "fs/promises";
import { createGzip } from "zlib";
import { promisify } from "util";
import { pipeline } from "stream";
import { basename, join, relative, resolve } from "path";
import { spawn } from "child_process";
import * as tar from "tar";
import type { ConfigManager } from "../../core/config/manager.js";
import { logger } from "../../utils/logger.js";

const pipelineAsync = promisify(pipeline);

export interface BackupOptions {
  includeConfigs: boolean;
  includeDatabases: boolean;
  includeVolumes: boolean;
  compression: boolean;
  destination: string;
  excludeServices?: string[];
}

export interface BackupMetadata {
  version: string;
  createdAt: string;
  hostname: string;
  services: string[];
  size: number;
  checksum: string;
}

export class BackupManager {
  private configManager: ConfigManager;
  private backupDir: string;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.backupDir = join(configManager.getTuitionDir(), "backups");
  }

  /**
   * Initialize backup directory
   */
  async initialize(): Promise<void> {
    await mkdir(this.backupDir, { recursive: true });
  }

  /**
   * Create a backup archive
   */
  async createBackup(options: Partial<BackupOptions> = {}): Promise<{
    success: boolean;
    backupPath?: string;
    metadata?: BackupMetadata;
    message: string;
  }> {
    const opts: BackupOptions = {
      includeConfigs: true,
      includeDatabases: true,
      includeVolumes: false,
      compression: true,
      destination: this.backupDir,
      ...options,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `tuition-backup-${timestamp}`;
    const backupPath = join(opts.destination, `${backupName}.tar${opts.compression ? ".gz" : ""}`);

    try {
      // Create temp directory for staging
      const tempDir = join(this.backupDir, `.temp-${timestamp}`);
      await mkdir(tempDir, { recursive: true });

      // Collect backup contents
      const backupContents: string[] = [];

      // 1. Configuration (always included if requested)
      if (opts.includeConfigs) {
        const configSource = this.configManager.getConfigPath();
        const configDest = join(tempDir, "config");
        await this.copyDirectory(configSource, configDest);
        backupContents.push("config");
      }

      // 2. Caddy data
      const caddyDataPath = join(this.configManager.getTuitionDir(), "caddy-data");
      try {
        await stat(caddyDataPath);
        const caddyDest = join(tempDir, "caddy-data");
        await this.copyDirectory(caddyDataPath, caddyDest);
        backupContents.push("caddy-data");
      } catch {
        // Caddy data doesn't exist, skip
      }

      // 3. CoreDNS config
      const dnsConfigPath = join(this.configManager.getTuitionDir(), "coredns-config");
      try {
        await stat(dnsConfigPath);
        const dnsDest = join(tempDir, "coredns-config");
        await this.copyDirectory(dnsConfigPath, dnsDest);
        backupContents.push("coredns-config");
      } catch {
        // DNS config doesn't exist, skip
      }

      // 4. Service data directories (if includeVolumes)
      if (opts.includeVolumes) {
        const dataPath = join(this.configManager.getTuitionDir(), "data");
        try {
          await stat(dataPath);
          const dataDest = join(tempDir, "data");
          await this.copyDirectory(dataPath, dataDest);
          backupContents.push("data");
        } catch {
          // Data directory doesn't exist
        }
      }

      // 5. Docker Compose files
      const tuitionDir = this.configManager.getTuitionDir();
      const composeFiles = await this.findComposeFiles(tuitionDir);
      if (composeFiles.length > 0) {
        const composeDest = join(tempDir, "compose-files");
        await mkdir(composeDest, { recursive: true });
        for (const file of composeFiles) {
          const content = await readFile(file, "utf-8");
          const composeFileName = basename(file) || "compose.yaml";
          await writeFile(join(composeDest, composeFileName), content, "utf-8");
        }
        backupContents.push("compose-files");
      }

      // Create metadata
      const metadata: BackupMetadata = {
        version: "1.0",
        createdAt: new Date().toISOString(),
        hostname: "unknown", // Would get from system
        services: backupContents,
        size: 0,
        checksum: "pending",
      };

      await writeFile(join(tempDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf-8");

      // Create tar archive
      await tar.create(
        {
          gzip: opts.compression,
          file: backupPath,
          cwd: tempDir,
        },
        ["."]
      );

      // Get file size
      const stats = await stat(backupPath);
      metadata.size = stats.size;

      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        backupPath,
        metadata,
        message: `Backup created: ${backupPath} (${this.formatBytes(stats.size)})`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create backup: ${error}`,
      };
    }
  }

  /**
   * Restore from backup archive
   */
  async restoreBackup(
    backupPath: string,
    options: {
      dryRun?: boolean;
      force?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    restored?: string[];
  }> {
    try {
      const validation = this.validateBackupPath(backupPath);
      if (!validation.success) {
        return {
          success: false,
          message: validation.message,
        };
      }

      const resolvedBackupPath = validation.path!;

      // Verify backup exists
      try {
        await stat(resolvedBackupPath);
      } catch {
        return {
          success: false,
          message: `Backup file not found: ${resolvedBackupPath}`,
        };
      }

      // Create temp directory for extraction
      const tempDir = join(this.backupDir, `.restore-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      // Extract backup
      await tar.extract({
        file: resolvedBackupPath,
        cwd: tempDir,
        gzip: resolvedBackupPath.endsWith(".gz"),
      });

      // Read metadata
      let metadata: BackupMetadata;
      try {
        const metadataContent = await readFile(join(tempDir, "metadata.json"), "utf-8");
        metadata = JSON.parse(metadataContent) as BackupMetadata;
      } catch {
        metadata = {
          version: "unknown",
          createdAt: new Date().toISOString(),
          hostname: "unknown",
          services: [],
          size: 0,
          checksum: "unknown",
        };
      }

      if (options.dryRun) {
        await rm(tempDir, { recursive: true, force: true });
        return {
          success: true,
          message: `Dry run: Backup from ${metadata.createdAt} contains ${metadata.services.join(", ")}`,
          restored: metadata.services,
        };
      }

      // Confirm restoration if not forced
      if (!options.force) {
        // Would prompt user here in interactive mode
        logger.warn("backup.manager", `Restore requested without force for backup from ${metadata.createdAt}`);
      }

      const restored: string[] = [];
      const tuitionDir = this.configManager.getTuitionDir();

      // Restore configurations
      const configSource = join(tempDir, "config");
      try {
        await stat(configSource);
        const configDest = this.configManager.getConfigPath();
        await this.copyDirectory(configSource, configDest);
        restored.push("configuration");
      } catch {
        // Config not in backup
      }

      // Restore Caddy data
      const caddySource = join(tempDir, "caddy-data");
      try {
        await stat(caddySource);
        const caddyDest = join(tuitionDir, "caddy-data");
        await this.copyDirectory(caddySource, caddyDest);
        restored.push("caddy-data");
      } catch {
        // Caddy data not in backup
      }

      // Restore CoreDNS config
      const dnsSource = join(tempDir, "coredns-config");
      try {
        await stat(dnsSource);
        const dnsDest = join(tuitionDir, "coredns-config");
        await this.copyDirectory(dnsSource, dnsDest);
        restored.push("coredns-config");
      } catch {
        // DNS config not in backup
      }

      // Restore service data
      const dataSource = join(tempDir, "data");
      try {
        await stat(dataSource);
        const dataDest = join(tuitionDir, "data");
        await this.copyDirectory(dataSource, dataDest);
        restored.push("service-data");
      } catch {
        // Data not in backup
      }

      // Restore compose files
      const composeSource = join(tempDir, "compose-files");
      try {
        await stat(composeSource);
        const files = await readdir(composeSource);
        for (const file of files) {
          if (file.endsWith(".yaml") || file.endsWith(".yml")) {
            const content = await readFile(join(composeSource, file), "utf-8");
            await writeFile(join(tuitionDir, file), content, "utf-8");
          }
        }
        restored.push("compose-files");
      } catch {
        // Compose files not in backup
      }

      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        message: `Restored ${restored.length} components from backup`,
        restored,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to restore backup: ${error}`,
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<
    Array<{
      name: string;
      path: string;
      size: number;
      createdAt: string;
      services: string[];
    }>
  > {
    const backups: Array<{
      name: string;
      path: string;
      size: number;
      createdAt: string;
      services: string[];
    }> = [];

    try {
      const files = await readdir(this.backupDir);

      for (const file of files) {
        if (file.startsWith("tuition-backup-") && (file.endsWith(".tar") || file.endsWith(".tar.gz"))) {
          const path = join(this.backupDir, file);
          const stats = await stat(path);

          // Try to read metadata from archive
          let metadata: Partial<BackupMetadata> = {};
          try {
            // Quick extraction of just metadata.json
            // This is inefficient but works for now
            const tempDir = join(this.backupDir, `.meta-${Date.now()}`);
            await mkdir(tempDir, { recursive: true });
            await tar.extract(
              {
                file: path,
                cwd: tempDir,
                gzip: file.endsWith(".gz"),
              },
              ["metadata.json"]
            );

            const content = await readFile(join(tempDir, "metadata.json"), "utf-8");
            metadata = JSON.parse(content);
            await rm(tempDir, { recursive: true, force: true });
          } catch {
            // Couldn't read metadata
          }

          backups.push({
            name: file,
            path,
            size: stats.size,
            createdAt: metadata.createdAt || stats.mtime.toISOString(),
            services: metadata.services || [],
          });
        }
      }
    } catch {
      // Backup directory doesn't exist or is empty
    }

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupPath: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const validation = this.validateBackupPath(backupPath);
      if (!validation.success) {
        return {
          success: false,
          message: validation.message,
        };
      }

      const resolvedBackupPath = validation.path!;
      await rm(resolvedBackupPath);

      return {
        success: true,
        message: `Deleted backup: ${resolvedBackupPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete backup: ${error}`,
      };
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });

    const entries = await readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(source, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        const content = await readFile(srcPath);
        await writeFile(destPath, content);
      }
    }
  }

  /**
   * Find docker-compose files in directory
   */
  private async findComposeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".docker-compose.yaml")) {
          files.push(join(dir, entry.name));
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Validate backup path to ensure it stays within configured backup directory
   */
  private validateBackupPath(pathValue: string): {
    success: boolean;
    path?: string;
    message: string;
  } {
    const resolvedBackupDir = resolve(this.backupDir);
    const resolvedPath = resolve(pathValue);
    const pathWithinBackupDir = relative(resolvedBackupDir, resolvedPath);

    if (pathWithinBackupDir.startsWith("..") || pathWithinBackupDir === "") {
      return {
        success: false,
        message: "Backup path is outside the configured backup directory",
      };
    }

    const lower = resolvedPath.toLowerCase();
    const isValidExtension = lower.endsWith(".tar") || lower.endsWith(".tar.gz");
    if (!isValidExtension) {
      return {
        success: false,
        message: "Invalid backup file extension. Expected .tar or .tar.gz",
      };
    }

    return {
      success: true,
      path: resolvedPath,
      message: "Valid backup path",
    };
  }
}
