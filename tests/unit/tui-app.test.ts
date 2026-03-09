/**
 * TUI app tests
 */

import { beforeEach, describe, expect, it } from "bun:test";
import blessed from "blessed";
import { TuiApp } from "../../src/tui/app.js";
import { ServiceBrowser } from "../../src/tui/views/service-browser.js";
import { StatusDashboard } from "../../src/tui/views/status-dashboard.js";
import { CaddyManager } from "../../src/services/caddy/manager.js";
import { CoreDnsManager } from "../../src/services/dns/coredns.js";
import { ConfigManager } from "../../src/core/config/manager.js";
import { createPatchSet, stubProcessExit, captureConsoleLog } from "../helpers/test-utils.js";
import {
  createBlessedFactory,
  FakeBlessedElement,
  FakeBlessedScreen,
  findChildByContent,
} from "../helpers/fake-blessed.js";

describe("TuiApp", () => {
  let screen: FakeBlessedScreen;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(() => {
    screen = new FakeBlessedScreen({});
    patchSet = createPatchSet();
    const factory = createBlessedFactory(screen);

    patchSet.patch(blessed, "screen", factory.screen as unknown as typeof blessed.screen);
    patchSet.patch(blessed, "box", factory.box as unknown as typeof blessed.box);
    patchSet.patch(blessed, "button", factory.button as unknown as typeof blessed.button);
    patchSet.patch(blessed, "question", factory.question as unknown as typeof blessed.question);
  });

  it("initializes config, caddy, and dns managers", async () => {
    let configInitCalls = 0;
    let caddyInitCalls = 0;
    let dnsInitCalls = 0;

    patchSet.patch(ConfigManager.prototype, "initialize", async () => {
      configInitCalls += 1;
    });
    patchSet.patch(CaddyManager.prototype, "initialize", async () => {
      caddyInitCalls += 1;
    });
    patchSet.patch(CoreDnsManager.prototype, "initialize", async () => {
      dnsInitCalls += 1;
    });
    patchSet.patch(StatusDashboard.prototype, "render", async () => undefined);

    const app = new TuiApp();
    await app.initialize();

    expect(configInitCalls).toBe(1);
    expect(caddyInitCalls).toBe(1);
    expect(dnsInitCalls).toBe(1);

    patchSet.restore();
  });

  it("shows the dashboard view and clears old content when switching views", async () => {
    let dashboardRenderCalls = 0;
    let browserRenderCalls = 0;

    patchSet.patch(StatusDashboard.prototype, "render", async () => {
      dashboardRenderCalls += 1;
    });
    patchSet.patch(ServiceBrowser.prototype, "render", async () => {
      browserRenderCalls += 1;
    });

    const app = new TuiApp();
    const screenRef = (app as unknown as { screen: FakeBlessedScreen }).screen;
    const extraOne = new FakeBlessedElement({ parent: screenRef });
    const extraTwo = new FakeBlessedElement({ parent: screenRef });
    const extraThree = new FakeBlessedElement({ parent: screenRef });

    await (app as unknown as { showServiceBrowser: () => Promise<void> }).showServiceBrowser();

    expect(dashboardRenderCalls).toBeGreaterThanOrEqual(1);
    expect(browserRenderCalls).toBe(1);
    expect(extraOne.destroyed || extraTwo.destroyed || extraThree.destroyed).toBe(true);

    patchSet.restore();
  });

  it("handles menu buttons and key bindings", async () => {
    const exitStub = stubProcessExit();
    let dashboardRenderCalls = 0;
    let browserRenderCalls = 0;

    patchSet.patch(StatusDashboard.prototype, "render", async () => {
      dashboardRenderCalls += 1;
    });
    patchSet.patch(ServiceBrowser.prototype, "render", async () => {
      browserRenderCalls += 1;
    });

    const app = new TuiApp();
    const screenRef = (app as unknown as { screen: FakeBlessedScreen }).screen;
    const servicesButton = findChildByContent(screenRef, "[S]ervices");
    const dashboardButton = findChildByContent(screenRef, "[D]ashboard");
    const quitButton = findChildByContent(screenRef, "[Q]uit");

    await servicesButton?.emitAsync("press");
    await dashboardButton?.emitAsync("press");
    await screenRef.emitAsync("key:tab");
    await screenRef.emitAsync("key:S-tab");
    await quitButton?.emitAsync("press");

    expect(browserRenderCalls).toBe(1);
    expect(dashboardRenderCalls).toBeGreaterThanOrEqual(2);
    expect(screenRef.focused).toBe(true);
    expect(screenRef.destroyed).toBe(true);
    expect(exitStub.lastCode()).toBe(0);

    exitStub.restore();
    patchSet.restore();
  });

  it("switches views via keyboard shortcuts", async () => {
    let dashboardRenderCalls = 0;
    let browserRenderCalls = 0;

    patchSet.patch(StatusDashboard.prototype, "render", async () => {
      dashboardRenderCalls += 1;
    });
    patchSet.patch(ServiceBrowser.prototype, "render", async () => {
      browserRenderCalls += 1;
    });

    const app = new TuiApp();
    const screenRef = (app as unknown as { screen: FakeBlessedScreen }).screen;

    // 's' key should switch to service browser
    await screenRef.emitAsync("key:s");
    expect(browserRenderCalls).toBe(1);

    // 'd' key should switch to dashboard
    const beforeDashboard = dashboardRenderCalls;
    await screenRef.emitAsync("key:d");
    expect(dashboardRenderCalls).toBeGreaterThan(beforeDashboard);

    patchSet.restore();
  });

  it("exits immediately on escape key", async () => {
    const exitStub = stubProcessExit();
    patchSet.patch(StatusDashboard.prototype, "render", async () => undefined);

    const app = new TuiApp();
    const screenRef = (app as unknown as { screen: FakeBlessedScreen }).screen;

    await screenRef.emitAsync("key:escape");

    expect(screenRef.destroyed).toBe(true);
    expect(exitStub.lastCode()).toBe(0);

    exitStub.restore();
    patchSet.restore();
  });

  it("prompts for setup when configuration does not exist and exits on yes", async () => {
    const exitStub = stubProcessExit();
    const consoleCapture = captureConsoleLog();

    patchSet.patch(StatusDashboard.prototype, "render", async () => undefined);

    const app = new TuiApp();
    patchSet.patch(app as unknown as { initialize: () => Promise<void> }, "initialize", async () => undefined);
    patchSet.patch(
      (app as unknown as { configManager: { exists: () => Promise<boolean> } }).configManager,
      "exists",
      async () => false
    );

    const questionFactory = createBlessedFactory(screen);
    let questionElement: FakeBlessedElement | undefined;
    patchSet.patch(blessed, "question", ((options: Record<string, unknown>) => {
      questionElement = questionFactory.question(options);
      return questionElement as never;
    }) as unknown as typeof blessed.question);

    const runPromise = app.run();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(questionElement).toBeDefined();
    questionElement?.askHandler?.(null, "y");
    await runPromise;

    expect(consoleCapture.output.join("\n")).toContain("Running: tuition init");
    expect(exitStub.lastCode()).toBe(0);

    consoleCapture.restore();
    exitStub.restore();
    patchSet.restore();
  });

  it("exits with code 1 when setup is declined", async () => {
    const exitStub = stubProcessExit();

    patchSet.patch(StatusDashboard.prototype, "render", async () => undefined);

    const app = new TuiApp();
    patchSet.patch(app as unknown as { initialize: () => Promise<void> }, "initialize", async () => undefined);
    patchSet.patch(
      (app as unknown as { configManager: { exists: () => Promise<boolean> } }).configManager,
      "exists",
      async () => false
    );

    let questionElement: FakeBlessedElement | undefined;
    patchSet.patch(blessed, "question", ((options: Record<string, unknown>) => {
      questionElement = new FakeBlessedElement(options);
      return questionElement as never;
    }) as unknown as typeof blessed.question);

    const runPromise = app.run();
    await new Promise((resolve) => setTimeout(resolve, 0));
    questionElement?.askHandler?.(null, "n");
    await runPromise;

    expect(exitStub.lastCode()).toBe(1);

    exitStub.restore();
    patchSet.restore();
  });

  it("renders the screen when configuration already exists", async () => {
    patchSet.patch(StatusDashboard.prototype, "render", async () => undefined);

    const app = new TuiApp();
    patchSet.patch(app as unknown as { initialize: () => Promise<void> }, "initialize", async () => undefined);
    patchSet.patch(
      (app as unknown as { configManager: { exists: () => Promise<boolean> } }).configManager,
      "exists",
      async () => true
    );

    const screenRef = (app as unknown as { screen: FakeBlessedScreen }).screen;
    await app.run();

    expect(screenRef.renderCount).toBeGreaterThan(0);

    patchSet.restore();
  });
});
