/**
 * Network utility tests
 */

import { describe, it, expect } from "bun:test";
import * as networkUtils from "../../src/utils/network.js";

// Tests run against the real system and verify the contract:
// non-internal, IPv4, skips docker/br-/veth interfaces.

describe("detectHostIp", () => {
  it("should return a string or null", () => {
    const result = networkUtils.detectHostIp();
    // On any machine with a network interface, this should be a string
    // On CI/containers without external interfaces, it may be null
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("should not return a loopback address", () => {
    const result = networkUtils.detectHostIp();
    if (result !== null) {
      expect(result).not.toBe("127.0.0.1");
      expect(result.startsWith("127.")).toBe(false);
    }
  });

  it("should return a valid IPv4 address when available", () => {
    const result = networkUtils.detectHostIp();
    if (result !== null) {
      // Basic IPv4 format check
      const parts = result.split(".");
      expect(parts).toHaveLength(4);
      for (const part of parts) {
        const num = Number(part);
        expect(num >= 0 && num <= 255).toBe(true);
      }
    }
  });
});
