/**
 * Logger tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { logger } from "../../src/utils/logger.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("logger", () => {
  let patchSet: ReturnType<typeof createPatchSet>;
  let originalLogLevel: string | undefined;
  let logged: string[];
  let warned: string[];
  let errored: string[];

  beforeEach(() => {
    patchSet = createPatchSet();
    originalLogLevel = process.env.TUITION_LOG_LEVEL;
    logged = [];
    warned = [];
    errored = [];

    patchSet.patch(console, "log", (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
    patchSet.patch(console, "warn", (...args: unknown[]) => {
      warned.push(args.map(String).join(" "));
    });
    patchSet.patch(console, "error", (...args: unknown[]) => {
      errored.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    patchSet.restore();

    if (originalLogLevel === undefined) {
      delete process.env.TUITION_LOG_LEVEL;
    } else {
      process.env.TUITION_LOG_LEVEL = originalLogLevel;
    }
  });

  it("does not emit debug logs when the default level is info", () => {
    delete process.env.TUITION_LOG_LEVEL;

    logger.debug("test.scope", "hidden message");

    expect(logged).toHaveLength(0);
    expect(warned).toHaveLength(0);
    expect(errored).toHaveLength(0);
  });

  it("emits info logs through console.log", () => {
    delete process.env.TUITION_LOG_LEVEL;

    logger.info("test.scope", "visible info");

    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("INFO test.scope: visible info");
  });

  it("emits warn logs through console.warn", () => {
    process.env.TUITION_LOG_LEVEL = "warn";

    logger.warn("test.scope", "warning message");

    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain("WARN test.scope: warning message");
    expect(logged).toHaveLength(0);
  });

  it("emits error logs through console.error", () => {
    process.env.TUITION_LOG_LEVEL = "error";

    logger.error("test.scope", "error message");

    expect(errored).toHaveLength(1);
    expect(errored[0]).toContain("ERROR test.scope: error message");
    expect(warned).toHaveLength(0);
  });

  it("falls back to info when the configured log level is invalid", () => {
    process.env.TUITION_LOG_LEVEL = "invalid";

    logger.info("test.scope", "fallback info");

    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("INFO test.scope: fallback info");
  });
});
