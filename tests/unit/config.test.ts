/**
 * Configuration manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ConfigManager } from "../../src/core/config/manager.js";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("ConfigManager", () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-test-"));
    configManager = new ConfigManager(join(tempDir, "config"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create directory structure", async () => {
      await configManager.initialize();

      // Should create config directory
      const configPath = configManager.getConfigPath();
      expect(configPath).toContain("config");
    });
  });

  describe("exists", () => {
    it("should return false when no config exists", async () => {
      const exists = await configManager.exists();
      expect(exists).toBe(false);
    });

    it("should return true when global config exists", async () => {
      await configManager.initialize();
      await writeFile(
        join(configManager.getConfigPath(), "global.yaml"),
        "hostname: test\ndomain: example.com\nadminEmail: test@example.com",
        "utf-8"
      );

      const exists = await configManager.exists();
      expect(exists).toBe(true);
    });
  });

  describe("loadGlobal", () => {
    it("should return default values when no config exists", async () => {
      const config = await configManager.loadGlobal();

      expect(config.timezone).toBe("UTC");
      expect(config.puid).toBe(1000);
      expect(config.pgid).toBe(1000);
      expect(config.dnsProvider).toBe("cloudflare");
    });

    it("should load saved configuration", async () => {
      await configManager.initialize();
      await configManager.saveGlobal({
        hostname: "test-server",
        domain: "test.com",
        adminEmail: "admin@test.com",
        timezone: "America/New_York",
        puid: 1001,
        pgid: 1001,
        dnsProvider: "cloudflare",
        cloudflareToken: "test-token",
        upstreamDns: {
          primary: "1.1.1.1",
          backup: "1.0.0.1",
        },
      });

      const config = await configManager.loadGlobal();

      expect(config.hostname).toBe("test-server");
      expect(config.domain).toBe("test.com");
      expect(config.adminEmail).toBe("admin@test.com");
      expect(config.timezone).toBe("America/New_York");
    });
  });

  describe("saveService", () => {
    it("should save service configuration", async () => {
      await configManager.initialize();

      await configManager.saveService("test-service", {
        enabled: true,
        imageTag: "latest",
        environment: { TEST_VAR: "value" },
      });

      const loaded = await configManager.loadService("test-service");
      expect(loaded).not.toBeNull();
      expect(loaded?.enabled).toBe(true);
      expect(loaded?.imageTag).toBe("latest");
    });
  });

  describe("generatePassword", () => {
    it("should generate passwords of correct length", () => {
      const password = configManager.generatePassword(16);
      expect(password.length).toBe(16);
    });

    it("should generate different passwords each time", () => {
      const password1 = configManager.generatePassword(32);
      const password2 = configManager.generatePassword(32);
      expect(password1).not.toBe(password2);
    });

    it("should use correct character set", () => {
      const password = configManager.generatePassword(100);
      const validChars = /^[A-Za-z0-9!@#$%^&*]+$/;
      expect(validChars.test(password)).toBe(true);
    });
  });
});
