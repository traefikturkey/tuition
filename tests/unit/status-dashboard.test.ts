/**
 * Status dashboard view tests
 */

import { beforeEach, describe, expect, it } from "bun:test";
import blessed from "blessed";
import { docker } from "../../src/services/docker/client.js";
import { StatusDashboard } from "../../src/tui/views/status-dashboard.js";
import { createPatchSet } from "../helpers/test-utils.js";
import { createBlessedFactory, FakeBlessedScreen, findChildByLabel } from "../helpers/fake-blessed.js";

describe("StatusDashboard", () => {
  let screen: FakeBlessedScreen;
  let patchSet: ReturnType<typeof createPatchSet>;
  let configManager: { loadGlobal: () => Promise<{ domain: string; adminEmail: string }> };
  let lifecycleManager: { listAll: () => Promise<Array<Record<string, unknown>>> };
  let caddyManager: { status: () => Promise<{ running: boolean; routes: number }> };
  let dnsManager: { status: () => Promise<{ running: boolean; hosts: number }> };

  beforeEach(() => {
    screen = new FakeBlessedScreen({});
    patchSet = createPatchSet();
    const factory = createBlessedFactory(screen);

    patchSet.patch(blessed, "box", factory.box as unknown as typeof blessed.box);
    patchSet.patch(blessed, "list", factory.list as unknown as typeof blessed.list);

    configManager = {
      loadGlobal: async () => ({ domain: "example.com", adminEmail: "admin@example.com" }),
    };
    lifecycleManager = {
      listAll: async () => [
        { name: "whoami", state: "running", definition: { category: "development" } },
        { name: "pihole", state: "enabled", definition: { category: "dns" } },
      ],
    };
    caddyManager = { status: async () => ({ running: true, routes: 3 }) };
    dnsManager = { status: async () => ({ running: true, hosts: 5 }) };
  });

  it("renders dashboard statistics and Docker status when Docker is accessible", async () => {
    patchSet.patch(docker, "info", async () => ({ ServerVersion: "26.1.0", Containers: 2, Images: 12 }));
    patchSet.patch(docker, "listContainers", async () => [
      { id: "1", name: "whoami", image: "test", state: "running", status: "Up", ports: [], labels: {} },
    ]);

    const dashboard = new StatusDashboard(
      screen as never,
      configManager as never,
      lifecycleManager as never,
      caddyManager as never,
      dnsManager as never
    );

    await dashboard.render();

    const container = findChildByLabel(screen, " Dashboard ");
    const systemBox = container ? findChildByLabel(container, " System ") : undefined;
    const statsBox = container ? findChildByLabel(container, " Statistics ") : undefined;
    const dockerBox = container ? findChildByLabel(container, " Docker Status ") : undefined;

    expect(systemBox?.content).toContain("example.com");
    expect(systemBox?.content).toContain("Running");
    expect(statsBox?.content).toContain("Total Services: 2");
    expect(statsBox?.content).toContain("Running: {green-fg}1{/}");
    expect(dockerBox?.content).toContain("26.1.0");
    expect(dockerBox?.content).toContain("Containers: 1 running");

    patchSet.restore();
  });

  it("shows a Docker access error when Docker info retrieval fails", async () => {
    patchSet.patch(docker, "info", async () => {
      throw new Error("daemon unavailable");
    });

    const dashboard = new StatusDashboard(
      screen as never,
      configManager as never,
      lifecycleManager as never,
      caddyManager as never,
      dnsManager as never
    );

    await dashboard.render();

    const container = findChildByLabel(screen, " Dashboard ");
    const dockerBox = container ? findChildByLabel(container, " Docker Status ") : undefined;

    expect(dockerBox?.content).toContain("Docker is not accessible");

    patchSet.restore();
  });
});
