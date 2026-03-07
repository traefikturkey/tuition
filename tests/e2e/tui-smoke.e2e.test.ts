/**
 * Thin TUI end-to-end smoke tests
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import blessed from "blessed";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { TuiApp } from "../../src/tui/app.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { LifecycleManager } from "../../src/core/lifecycle/manager.js";
import { CaddyManager } from "../../src/services/caddy/manager.js";
import { CoreDnsManager } from "../../src/services/dns/coredns.js";
import { docker } from "../../src/services/docker/client.js";
import { captureConsoleLog, createPatchSet, stubProcessExit } from "../helpers/test-utils.js";
import { createBlessedFactory, FakeBlessedElement, FakeBlessedScreen, findChildByLabel } from "../helpers/fake-blessed.js";

async function waitFor<T>(resolveValue: () => T | undefined, attempts = 10): Promise<T | undefined> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = resolveValue();

    if (value !== undefined) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return undefined;
}

describe("TUI e2e smoke", () => {
  let tempDir: string;
  let configPath: string;
  let screen: FakeBlessedScreen;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-e2e-tui-"));
    configPath = join(tempDir, "config");
    screen = new FakeBlessedScreen({});
    patchSet = createPatchSet();

    const factory = createBlessedFactory(screen);
    patchSet.patch(blessed, "screen", factory.screen as unknown as typeof blessed.screen);
    patchSet.patch(blessed, "box", factory.box as unknown as typeof blessed.box);
    patchSet.patch(blessed, "list", factory.list as unknown as typeof blessed.list);
    patchSet.patch(blessed, "button", factory.button as unknown as typeof blessed.button);
    patchSet.patch(blessed, "question", factory.question as unknown as typeof blessed.question);
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("renders the dashboard on launch when configuration exists", async () => {
    const manager = new ConfigManager(configPath);
    await manager.initialize();
    await manager.saveGlobal({
      hostname: "homelab",
      domain: "example.com",
      timezone: "UTC",
      adminEmail: "admin@example.com",
      puid: 1000,
      pgid: 1000,
      dnsProvider: "cloudflare",
      upstreamDns: { primary: "1.1.1.1" },
    });

    patchSet.patch(LifecycleManager.prototype, "listAll", async () => [
      {
        name: "whoami",
        state: "running",
        definition: { category: "development" },
      },
    ] as never);
    patchSet.patch(CaddyManager.prototype, "status", async () => ({ running: true, configValid: true, routes: 1 }));
    patchSet.patch(CoreDnsManager.prototype, "status", async () => ({ running: true, hosts: 1 }));
    patchSet.patch(docker, "info", async () => ({ ServerVersion: "26.1.0", Containers: 1, Images: 5 }));
    patchSet.patch(docker, "listContainers", async () => [
      { id: "1", name: "whoami", image: "test", state: "running", status: "Up", ports: [], labels: {} },
    ] as never);

    const app = new TuiApp(configPath);
    await app.run();

    const dashboard = await waitFor(() => findChildByLabel(screen, " Dashboard "));
    const systemBox = dashboard ? findChildByLabel(dashboard, " System ") : undefined;
    const statsBox = dashboard ? findChildByLabel(dashboard, " Statistics ") : undefined;

    expect(dashboard).toBeDefined();
    expect(systemBox?.content).toContain("example.com");
    expect(statsBox?.content).toContain("Total Services: 1");
    expect(screen.renderCount).toBeGreaterThan(0);
  });

  it("shows the first-run setup prompt and exits cleanly when accepted", async () => {
    const exitStub = stubProcessExit();
    const consoleCapture = captureConsoleLog();
    let questionElement: FakeBlessedElement | undefined;

    patchSet.patch(blessed, "question", ((options: Record<string, unknown>) => {
      questionElement = new FakeBlessedElement(options);
      const parent = options.parent as FakeBlessedElement | undefined;
      parent?.children.push(questionElement);
      return questionElement as never;
    }) as unknown as typeof blessed.question);

    try {
      const app = new TuiApp(configPath);
      const runPromise = app.run();
      await waitFor(() => questionElement);

      expect(questionElement).toBeDefined();
      questionElement?.askHandler?.(null, "y");
      await runPromise;
      await waitFor(() => findChildByLabel(screen, " Dashboard "));

      expect(exitStub.lastCode()).toBe(0);
      expect(consoleCapture.output.join("\n")).toContain("Running: tuition init");
    } finally {
      consoleCapture.restore();
      exitStub.restore();
    }
  });
});