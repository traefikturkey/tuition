/**
 * State detector tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { StateDetector } from "../../src/core/state/detector.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { docker } from "../../src/services/docker/client.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("StateDetector", () => {
  let tempDir: string;
  let configManager: ConfigManager;
  let detector: StateDetector;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-state-test-"));
    configManager = new ConfigManager(join(tempDir, "config"));
    await configManager.initialize();
    detector = new StateDetector(configManager);
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
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

  it("returns running state with container details when Docker reports a running container", async () => {
    await configManager.saveService("whoami", {
      enabled: true,
    });
    patchSet.patch(docker, "getContainer", async () => ({
      id: "container-id",
      name: "whoami",
      image: "whoami:latest",
      state: "running",
      status: "Up",
      health: "healthy",
      uptime: 123,
      ports: [{ privatePort: 80, publicPort: 8080, type: "tcp", ip: "0.0.0.0" }],
      labels: {},
    }));

    const status = await detector.detect("whoami");

    expect(status.state).toBe("running");
    expect(status.containerId).toBe("container-id");
    expect(status.health).toBe("healthy");
    expect(status.ports).toEqual([80]);
  });

  it("returns stopped state when an enabled service has a non-running container", async () => {
    await configManager.saveService("whoami", {
      enabled: true,
    });
    patchSet.patch(docker, "getContainer", async () => ({
      id: "container-id",
      name: "whoami",
      image: "whoami:latest",
      state: "exited",
      status: "Exited",
      health: "unhealthy",
      uptime: 45,
      ports: [{ privatePort: 80, publicPort: 8080, type: "tcp", ip: "0.0.0.0" }],
      labels: {},
    }));

    const status = await detector.detect("whoami");

    expect(status.state).toBe("stopped");
    expect(status.health).toBe("unhealthy");
  });

  it("falls back to enabled state when Docker inspection throws", async () => {
    await configManager.saveService("whoami", {
      enabled: true,
    });
    patchSet.patch(docker, "getContainer", async () => {
      throw new Error("docker unavailable");
    });

    const status = await detector.detect("whoami");

    expect(status.state).toBe("enabled");
    expect(status.containerId).toBeUndefined();
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
