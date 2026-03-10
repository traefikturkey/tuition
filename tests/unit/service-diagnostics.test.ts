/**
 * Service diagnostics view tests
 */

import { beforeEach, describe, expect, it } from "bun:test";
import blessed from "blessed";
import { docker } from "../../src/services/docker/client.js";
import { ServiceDiagnostics } from "../../src/tui/views/service-diagnostics.js";
import { createPatchSet } from "../helpers/test-utils.js";
import {
  createBlessedFactory,
  FakeBlessedElement,
  FakeBlessedScreen,
  findChildByLabel,
  findChildByContent,
} from "../helpers/fake-blessed.js";

describe("ServiceDiagnostics", () => {
  let screen: FakeBlessedScreen;
  let patchSet: ReturnType<typeof createPatchSet>;
  let backCalled: boolean;
  let service: Record<string, unknown>;
  let lifecycleManager: {
    getService: (name: string) => Promise<Record<string, unknown> | null>;
    restart: (name: string) => Promise<{ success: boolean; message: string }>;
    start: (name: string) => Promise<{ success: boolean; message: string }>;
    stop: (name: string) => Promise<{ success: boolean; message: string }>;
  };
  let configManager: {
    loadGlobal: () => Promise<{ domain: string; adminEmail: string }>;
    getTuitionDir: () => string;
  };
  let caddyManager: {
    status: () => Promise<{ running: boolean; routes: number; configValid: boolean }>;
  };
  let dnsManager: {
    status: () => Promise<{ running: boolean; hosts: number }>;
  };

  beforeEach(() => {
    screen = new FakeBlessedScreen({});
    patchSet = createPatchSet();
    backCalled = false;

    const factory = createBlessedFactory(screen);

    patchSet.patch(blessed, "box", factory.box as unknown as typeof blessed.box);
    patchSet.patch(blessed, "list", factory.list as unknown as typeof blessed.list);
    patchSet.patch(blessed, "button", factory.button as unknown as typeof blessed.button);
    patchSet.patch(blessed, "message", factory.message as unknown as typeof blessed.message);

    service = {
      name: "whoami",
      state: "running",
      definition: {
        category: "development",
        description: "HTTP echo service",
        image: "traefik/whoami:latest",
        ports: [{ host: 80, container: 80, protocol: "tcp" }],
        volumes: [{ host: "./data/whoami", container: "/data", readOnly: false }],
        resourceLimits: { cpus: 2, memory: "512M", gpus: false },
        labels: { caddy: "${HOSTNAME}.${DOMAIN}" },
        upstreamUrl: "https://github.com/traefik/whoami",
      },
      config: { enabled: true, imageTag: "latest" },
      containerStatus: {
        id: "abc123def456",
        state: "running",
        health: "healthy",
        uptime: 3600,
      },
    };

    lifecycleManager = {
      getService: async () => service,
      restart: async () => ({ success: true, message: "restarted whoami" }),
      start: async () => ({ success: true, message: "started whoami" }),
      stop: async () => ({ success: true, message: "stopped whoami" }),
    };

    configManager = {
      loadGlobal: async () => ({ domain: "example.com", adminEmail: "admin@example.com" }),
      getTuitionDir: () => "/tmp/tuition-test",
    };

    caddyManager = {
      status: async () => ({ running: true, routes: 3, configValid: true }),
    };

    dnsManager = {
      status: async () => ({ running: true, hosts: 5 }),
    };
  });

  function createDiagnostics() {
    return new ServiceDiagnostics(
      screen as never,
      "whoami",
      lifecycleManager as never,
      configManager as never,
      caddyManager as never,
      dnsManager as never,
      () => { backCalled = true; }
    );
  }

  it("renders the diagnostics container with service name in label", async () => {
    const diag = createDiagnostics();
    await diag.render();

    const container = findChildByLabel(screen, " Diagnostics: whoami ");
    expect(container).toBeDefined();

    patchSet.restore();
  });

  it("displays the info bar with service status and image", async () => {
    const diag = createDiagnostics();
    await diag.render();

    const statusBox = findChildByLabel(screen, " Status ");
    expect(statusBox).toBeDefined();
    expect(statusBox?.content).toContain("running");
    expect(statusBox?.content).toContain("healthy");
    expect(statusBox?.content).toContain("traefik/whoami:latest");

    patchSet.restore();
  });

  it("renders action buttons (Back, Restart, Stop)", async () => {
    const diag = createDiagnostics();
    await diag.render();

    const backBtn = findChildByContent(screen, "Back");
    const restartBtn = findChildByContent(screen, "Restart");
    const stopBtn = findChildByContent(screen, "Stop");

    expect(backBtn).toBeDefined();
    expect(restartBtn).toBeDefined();
    expect(stopBtn).toBeDefined();

    patchSet.restore();
  });

  it("shows Start button when service is not running", async () => {
    service.state = "stopped";
    service.containerStatus = null;

    const diag = createDiagnostics();
    await diag.render();

    const startBtn = findChildByContent(screen, "Start");
    expect(startBtn).toBeDefined();

    patchSet.restore();
  });

  it("renders tab buttons for Overview, Logs, Network", async () => {
    const diag = createDiagnostics();
    await diag.render();

    const overviewTab = findChildByContent(screen, "[O]verview");
    const logsTab = findChildByContent(screen, "[L]ogs");
    const networkTab = findChildByContent(screen, "[N]etwork");

    expect(overviewTab).toBeDefined();
    expect(logsTab).toBeDefined();
    expect(networkTab).toBeDefined();

    patchSet.restore();
  });

  it("renders Overview tab with ports, volumes, resource limits, and routing", async () => {
    const diag = createDiagnostics();
    await diag.render();

    const portsBox = findChildByLabel(screen, " Ports ");
    const volumesBox = findChildByLabel(screen, " Volumes ");
    const limitsBox = findChildByLabel(screen, " Resource Limits ");
    const routingBox = findChildByLabel(screen, " Routing ");
    const imageBox = findChildByLabel(screen, " Image ");

    expect(portsBox).toBeDefined();
    expect(portsBox?.content).toContain("80:80/tcp");

    expect(volumesBox).toBeDefined();
    expect(volumesBox?.content).toContain("./data/whoami:/data");

    expect(limitsBox).toBeDefined();
    expect(limitsBox?.content).toContain("CPUs: 2");
    expect(limitsBox?.content).toContain("Memory: 512M");

    expect(routingBox).toBeDefined();
    expect(routingBox?.content).toContain("route configured");

    expect(imageBox).toBeDefined();
    expect(imageBox?.content).toContain("traefik/whoami:latest");
    expect(imageBox?.content).toContain("abc123def456");

    patchSet.restore();
  });

  it("calls onBack when Back button is pressed", async () => {
    const diag = createDiagnostics();
    await diag.render();

    const backBtn = findChildByContent(screen, "Back");
    await backBtn?.emitAsync("press");

    expect(backCalled).toBe(true);

    patchSet.restore();
  });

  it("calls restart when Restart button is pressed", async () => {
    const actions: string[] = [];
    lifecycleManager.restart = async (name: string) => {
      actions.push(`restart:${name}`);
      return { success: true, message: "restarted" };
    };

    const diag = createDiagnostics();
    await diag.render();

    const restartBtn = findChildByContent(screen, "Restart");
    await restartBtn?.emitAsync("press");

    expect(actions).toEqual(["restart:whoami"]);

    patchSet.restore();
  });

  it("calls stop when Stop button is pressed for a running service", async () => {
    const actions: string[] = [];
    lifecycleManager.stop = async (name: string) => {
      actions.push(`stop:${name}`);
      return { success: true, message: "stopped" };
    };

    const diag = createDiagnostics();
    await diag.render();

    const stopBtn = findChildByContent(screen, "Stop");
    await stopBtn?.emitAsync("press");

    expect(actions).toEqual(["stop:whoami"]);

    patchSet.restore();
  });

  it("Stop button label updates to Start after stopping the service", async () => {
    // service.state starts as 'running' (set in beforeEach)
    lifecycleManager.stop = async () => {
      // Mutate the shared service object so subsequent getService() calls see stopped state
      service.state = "stopped";
      return { success: true, message: "stopped whoami" };
    };

    const diag = createDiagnostics();
    await diag.render();

    const stopBtn = findChildByContent(screen, "Stop");
    expect(stopBtn?.content).toBe("Stop");

    await stopBtn?.emitAsync("press");

    // Button label and bg should reflect the new stopped state
    expect(stopBtn?.content).toBe("Start");
    expect((stopBtn?.style as { bg?: string })?.bg).toBe("green");

    patchSet.restore();
  });

  it("calls start when Start button is pressed for a stopped service", async () => {
    service.state = "stopped";
    service.containerStatus = null;

    const actions: string[] = [];
    lifecycleManager.start = async (name: string) => {
      actions.push(`start:${name}`);
      return { success: true, message: "started" };
    };

    const diag = createDiagnostics();
    await diag.render();

    const startBtn = findChildByContent(screen, "Start");
    await startBtn?.emitAsync("press");

    expect(actions).toEqual(["start:whoami"]);

    patchSet.restore();
  });

  it("calls onBack when service is not found", async () => {
    lifecycleManager.getService = async () => null;

    const diag = createDiagnostics();
    await diag.render();

    expect(backCalled).toBe(true);

    patchSet.restore();
  });

  it("shows 'No ports defined' when service has no ports", async () => {
    (service.definition as Record<string, unknown>).ports = undefined;

    const diag = createDiagnostics();
    await diag.render();

    const portsBox = findChildByLabel(screen, " Ports ");
    expect(portsBox?.content).toContain("No ports defined");

    patchSet.restore();
  });

  it("shows 'No volumes defined' when service has no volumes", async () => {
    (service.definition as Record<string, unknown>).volumes = undefined;

    const diag = createDiagnostics();
    await diag.render();

    const volumesBox = findChildByLabel(screen, " Volumes ");
    expect(volumesBox?.content).toContain("No volumes defined");

    patchSet.restore();
  });

  it("shows 'No resource limits defined' when service has no limits", async () => {
    (service.definition as Record<string, unknown>).resourceLimits = undefined;

    const diag = createDiagnostics();
    await diag.render();

    const limitsBox = findChildByLabel(screen, " Resource Limits ");
    expect(limitsBox?.content).toContain("No resource limits defined");

    patchSet.restore();
  });

  it("renders Network tab with container network and port bindings", async () => {
    // Patch docker methods for network tab
    patchSet.patch(docker, "getContainerIP", (async () => "172.18.0.5") as never);
    patchSet.patch(docker, "getNetworkGateway", (async () => "172.18.0.1") as never);
    patchSet.patch(docker, "getContainer", (async () => ({
      id: "abc123",
      name: "whoami",
      image: "traefik/whoami",
      state: "running",
      status: "Up 1 hour",
      ports: [{ privatePort: 80, publicPort: 8080, type: "tcp" }],
      labels: {},
    })) as never);

    const diag = createDiagnostics();
    await diag.render();

    // Switch to network tab by pressing the tab button
    const networkTab = findChildByContent(screen, "[N]etwork");
    await networkTab?.emitAsync("press");

    const containerNetworkBox = findChildByLabel(screen, " Container Network ");
    const portBindingsBox = findChildByLabel(screen, " Port Bindings (actual) ");
    const caddyRouteBox = findChildByLabel(screen, " Caddy Route ");
    const dnsEntryBox = findChildByLabel(screen, " DNS Entry ");

    expect(containerNetworkBox).toBeDefined();
    expect(containerNetworkBox?.content).toContain("172.18.0.5");
    expect(containerNetworkBox?.content).toContain("172.18.0.1");

    expect(portBindingsBox).toBeDefined();
    expect(portBindingsBox?.content).toContain("8080");
    expect(portBindingsBox?.content).toContain("80/tcp");

    expect(caddyRouteBox).toBeDefined();
    expect(caddyRouteBox?.content).toContain("whoami.example.com");

    expect(dnsEntryBox).toBeDefined();
    expect(dnsEntryBox?.content).toContain("whoami.example.com");
    expect(dnsEntryBox?.content).toContain("172.18.0.5");

    patchSet.restore();
  });

  it("renders Logs tab with log streaming placeholder", async () => {
    const diag = createDiagnostics();
    await diag.render();

    // Switch to logs tab
    const logsTab = findChildByContent(screen, "[L]ogs");
    await logsTab?.emitAsync("press");

    const logsBox = findChildByLabel(screen, " Logs (streaming) ");
    expect(logsBox).toBeDefined();
    expect(logsBox?.content).toContain("Starting log stream");

    patchSet.restore();
  });

  it("formats uptime correctly in the info bar", async () => {
    // 1 day, 2 hours, 30 minutes = 95400 seconds
    (service.containerStatus as Record<string, unknown>).uptime = 95400;

    const diag = createDiagnostics();
    await diag.render();

    const statusBox = findChildByLabel(screen, " Status ");
    expect(statusBox?.content).toContain("1d 2h 30m");

    patchSet.restore();
  });

  it("shows read-only marker for read-only volumes", async () => {
    (service.definition as Record<string, unknown>).volumes = [
      { host: "/media", container: "/media", readOnly: true },
    ];

    const diag = createDiagnostics();
    await diag.render();

    const volumesBox = findChildByLabel(screen, " Volumes ");
    expect(volumesBox?.content).toContain("(ro)");

    patchSet.restore();
  });
});
