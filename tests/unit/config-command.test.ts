/**
 * Config command tests
 */

import { describe, it, expect } from "bun:test";
import { redactSensitiveValues } from "../../src/cli/commands/config.js";

describe("ConfigCommand redaction", () => {
  it("should redact sensitive keys in nested objects", () => {
    const input = {
      domain: "example.com",
      cloudflareToken: "abc123",
      nested: {
        adminPasswordHash: "$2b$10$something",
        apiSecret: "super-secret",
      },
    };

    const result = redactSensitiveValues(input);

    expect(result.domain).toBe("example.com");
    expect(result.cloudflareToken).toBe("[REDACTED]");
    expect(result.nested.adminPasswordHash).toBe("[REDACTED]");
    expect(result.nested.apiSecret).toBe("[REDACTED]");
  });

  it("should redact sensitive keys inside arrays", () => {
    const input = {
      services: [
        { name: "svc1", token: "token-1" },
        { name: "svc2", password: "password-2" },
      ],
    };

    const result = redactSensitiveValues(input);

    expect(result.services[0]?.name).toBe("svc1");
    expect(result.services[0]?.token).toBe("[REDACTED]");
    expect(result.services[1]?.name).toBe("svc2");
    expect(result.services[1]?.password).toBe("[REDACTED]");
  });

  it("should preserve non-object values", () => {
    expect(redactSensitiveValues("plain")).toBe("plain");
    expect(redactSensitiveValues(42)).toBe(42);
    expect(redactSensitiveValues(true)).toBe(true);
    expect(redactSensitiveValues(null)).toBe(null);
  });
});
