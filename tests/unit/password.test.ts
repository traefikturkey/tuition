/**
 * Password utility tests
 */

import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { hashPassword, promptPassword, verifyPassword } from "../../src/utils/password.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("Password Utilities", () => {
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(() => {
    patchSet = createPatchSet();
  });

  afterEach(() => {
    patchSet.restore();
  });

  describe("hashPassword", () => {
    it("should hash a plaintext password", async () => {
      const password = "testPassword123";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format
    });

    it("should produce different hashes for same password", async () => {
      const password = "samePassword";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Different salts should produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty password", async () => {
      const hash = await hashPassword("");
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should handle long passwords", async () => {
      const longPassword = "a".repeat(1000);
      const hash = await hashPassword(longPassword);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("verifyPassword", () => {
    it("should verify correct password", async () => {
      const password = "correctPassword";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "correctPassword";
      const wrongPassword = "wrongPassword";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it("should reject empty password against non-empty hash", async () => {
      const password = "somePassword";
      const hash = await hashPassword(password);

      const isValid = await verifyPassword("", hash);
      expect(isValid).toBe(false);
    });

    it("should handle bcrypt hashes correctly", async () => {
      // Test with a known bcrypt hash format
      const password = "test123";
      const hash = await hashPassword(password);

      // Should start with $2b$ (bcrypt identifier)
      expect(hash.startsWith("$2b$")).toBe(true);

      // Should verify correctly
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe("integration", () => {
    it("should round-trip hash and verify", async () => {
      const passwords = [
        "simple",
        "ComplexP@ssw0rd!",
        "123456",
        "with spaces and symbols !@#$%",
        "😀🎉🔐", // unicode
      ];

      for (const password of passwords) {
        const hash = await hashPassword(password);
        const isValid = await verifyPassword(password, hash);
        expect(isValid).toBe(true);
      }
    });
  });

  describe("promptPassword", () => {
    it("should collect typed characters and mask output", async () => {
      const writes: string[] = [];
      let rawMode = false;

      patchSet.patch(process.stdout, "write", ((chunk: string | Uint8Array) => {
        writes.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
      patchSet.patch(process.stdin, "resume", (() => process.stdin) as typeof process.stdin.resume);
      patchSet.patch(process.stdin, "pause", (() => process.stdin) as typeof process.stdin.pause);
      patchSet.patch(process.stdin, "setRawMode", ((value: boolean) => {
        rawMode = value;
        return process.stdin;
      }) as typeof process.stdin.setRawMode);

      const pending = promptPassword("Password: ");
      process.stdin.emit("data", Buffer.from("a"));
      process.stdin.emit("data", Buffer.from("b"));
      process.stdin.emit("data", Buffer.from("\r"));

      const result = await pending;

      expect(result).toBe("ab");
      expect(rawMode).toBe(false);
      expect(writes.join("")).toContain("Password: ");
      expect(writes.join("")).toContain("**");
      expect(writes[writes.length - 1]).toBe("\n");
    });

    it("should support backspace while entering a password", async () => {
      const writes: string[] = [];

      patchSet.patch(process.stdout, "write", ((chunk: string | Uint8Array) => {
        writes.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
      patchSet.patch(process.stdin, "resume", (() => process.stdin) as typeof process.stdin.resume);
      patchSet.patch(process.stdin, "pause", (() => process.stdin) as typeof process.stdin.pause);
      patchSet.patch(process.stdin, "setRawMode", ((_: boolean) => process.stdin) as typeof process.stdin.setRawMode);

      const pending = promptPassword("Password: ");
      process.stdin.emit("data", Buffer.from("a"));
      process.stdin.emit("data", Buffer.from("b"));
      process.stdin.emit("data", Buffer.from("\x7f"));
      process.stdin.emit("data", Buffer.from("c"));
      process.stdin.emit("data", Buffer.from("\n"));

      const result = await pending;

      expect(result).toBe("ac");
      expect(writes.join("")).toContain("\b \b");
    });
  });
});
