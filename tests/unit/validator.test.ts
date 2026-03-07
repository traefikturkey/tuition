/**
 * Configuration validator tests
 */

import { describe, it, expect } from "bun:test";
import { ConfigValidator } from "../../src/core/config/validator.js";
import type { GlobalConfig } from "../../src/types/index.js";

describe("ConfigValidator", () => {
  const validator = new ConfigValidator();

  describe("validateGlobal", () => {
    it("should validate correct configuration", () => {
      const config: GlobalConfig = {
        hostname: "test-server",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "test-token",
        upstreamDns: {
          primary: "8.8.8.8",
          backup: "8.8.4.4",
        },
      };

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail on missing hostname", () => {
      const config = {
        hostname: "",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "hostname")).toBe(true);
    });

    it("should fail on missing domain", () => {
      const config = {
        hostname: "test",
        domain: "",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "domain")).toBe(true);
    });

    it("should fail on invalid email", () => {
      const config = {
        hostname: "test",
        domain: "example.com",
        adminEmail: "invalid-email",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "adminEmail")).toBe(true);
    });

    it("should fail on missing admin email", () => {
      const config = {
        hostname: "test",
        domain: "example.com",
        adminEmail: "",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "adminEmail" && e.message.includes("required"))).toBe(true);
    });

    it("should fail on missing Cloudflare token when using Cloudflare", () => {
      const config = {
        hostname: "test",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "cloudflareToken")).toBe(true);
    });

    it("should fail on missing primary upstream DNS", () => {
      const config = {
        hostname: "test",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: {
          primary: "",
        },
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "upstreamDns.primary" && e.message.includes("required"))).toBe(true);
    });

    it("should fail when upstream DNS configuration is missing entirely", () => {
      const config = {
        hostname: "test",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "upstreamDns.primary")).toBe(true);
    });

    it("should fail on invalid primary and backup upstream DNS addresses", () => {
      const config = {
        hostname: "test",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "token",
        upstreamDns: {
          primary: "999.999.999.999",
          backup: "not-an-ip",
        },
      } as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "upstreamDns.primary")).toBe(true);
      expect(result.errors.some((e) => e.field === "upstreamDns.backup")).toBe(true);
    });

    it("should accept IPv6 upstream DNS addresses", () => {
      const config: GlobalConfig = {
        hostname: "test-server",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "test-token",
        upstreamDns: {
          primary: "::1",
          backup: "::",
        },
      };

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept full IPv6 addresses in upstream DNS", () => {
      const config: GlobalConfig = {
        hostname: "test-server",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "cloudflare",
        cloudflareToken: "test-token",
        upstreamDns: {
          primary: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        },
      };

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("does not require a cloudflare token for other DNS providers", () => {
      const config = {
        hostname: "test-server",
        domain: "example.com",
        adminEmail: "admin@example.com",
        timezone: "UTC",
        puid: 1000,
        pgid: 1000,
        dnsProvider: "manual",
        upstreamDns: {
          primary: "1.1.1.1",
        },
      } as unknown as GlobalConfig;

      const result = validator.validateGlobal(config);
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.field === "cloudflareToken")).toBe(false);
    });
  });

  describe("validateService", () => {
    it("should validate correct service name", () => {
      const result = validator.validateService("valid-service", { enabled: true });
      expect(result.valid).toBe(true);
    });

    it("should fail on empty service name", () => {
      const result = validator.validateService("", { enabled: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    });

    it("should fail on invalid characters in service name", () => {
      const result = validator.validateService("Invalid_Name", { enabled: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    });

    it("should fail on uppercase letters in service name", () => {
      const result = validator.validateService("TestService", { enabled: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    });

    it("should accept service names with hyphens", () => {
      const result = validator.validateService("my-service", { enabled: true });
      expect(result.valid).toBe(true);
    });

    it("should accept service names with numbers", () => {
      const result = validator.validateService("service-123", { enabled: true });
      expect(result.valid).toBe(true);
    });

    it("exposes helper validation behavior for email and IP formats", () => {
      const internals = validator as unknown as {
        isValidEmail: (email: string) => boolean;
        isValidIp: (ip: string) => boolean;
      };

      expect(internals.isValidEmail("admin@example.com")).toBe(true);
      expect(internals.isValidEmail("invalid-email")).toBe(false);
      expect(internals.isValidIp("8.8.8.8")).toBe(true);
      expect(internals.isValidIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
      expect(internals.isValidIp("not-an-ip")).toBe(false);
    });
  });
});
