/**
 * State detector tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { StateDetector } from "../../src/core/state/detector.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("StateDetector", () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let detector: StateDetector;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-state-test-"));
    configManager = new ConfigManager(join(tempDir, "config"));
    await configManager.initialize();
    detector = new StateDetector(configManager);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns available state for unknown service", async () => {
    const status = await detector.detect("nonexistent");

    expect(status.name).toBe("nonexistent");
    expect(status.state).toBe("available");
    expect(status.containerId).toBeUndefined();
  });

  it("returns disabled state for disabled service config", async () => {
    await configManager.saveService("whoami", {
      enabled: false,
    });

    const status = await detector.detect("whoami");

    expect(status.state).toBe("disabled");
  });

  it("returns enabled state for enabled service without container", async () => {
    await configManager.saveService("whoami", {
      enabled: true,
    });

    const status = await detector.detect("whoami");

    // No Docker running in test environment, so no container
    expect(status.state).toBe("enabled");
  });

  it("detects all services correctly", async () => {
    await configManager.saveService("svc1", { enabled: true });
    await configManager.saveService("svc2", { enabled: false });

    const results = await detector.detectAll(["svc1", "svc2", "unknown"]);

    expect(results).toHaveLength(3);
    expect(results[0]?.state).toBe("enabled");
    expect(results[1]?.state).toBe("disabled");
    expect(results[2]?.state).toBe("available");
  });
});
