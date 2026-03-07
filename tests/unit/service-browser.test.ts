/**
 * Service browser view tests
 */

import { beforeEach, describe, expect, it } from "bun:test";
import blessed from "blessed";
import { ServiceBrowser } from "../../src/tui/views/service-browser.js";
import { createPatchSet } from "../helpers/test-utils.js";
import {
  createBlessedFactory,
  FakeBlessedScreen,
  findChildByContent,
  findChildByLabel,
} from "../helpers/fake-blessed.js";

describe("ServiceBrowser", () => {
  let screen: FakeBlessedScreen;
  let patchSet: ReturnType<typeof createPatchSet>;
  let services: Array<Record<string, unknown>>;
  let lifecycleManager: {
    listAll: () => Promise<Array<Record<string, unknown>>>;
    enable: (name: string) => Promise<{ success: boolean; message: string }>;
    disable: (name: string) => Promise<{ success: boolean; message: string }>;
    start: (name: string) => Promise<{ success: boolean; message: string }>;
    stop: (name: string) => Promise<{ success: boolean; message: string }>;
  };

  beforeEach(() => {
    screen = new FakeBlessedScreen({});
    patchSet = createPatchSet();
    const factory = createBlessedFactory(screen);

    patchSet.patch(blessed, "box", factory.box as unknown as typeof blessed.box);
    patchSet.patch(blessed, "list", factory.list as unknown as typeof blessed.list);
    patchSet.patch(blessed, "button", factory.button as unknown as typeof blessed.button);
    patchSet.patch(blessed, "message", factory.message as unknown as typeof blessed.message);

    services = [
      {
        name: "whoami",
        state: "running",
        definition: {
          category: "development",
          description: "HTTP echo service",
          upstreamUrl: "https://example.com/whoami",
        },
        containerStatus: {
          id: "1234567890abcdef",
          state: "running",
          health: "healthy",
        },
      },
    ];

    lifecycleManager = {
      listAll: async () => services,
      enable: async () => ({ success: true, message: "enabled whoami" }),
      disable: async () => ({ success: true, message: "disabled whoami" }),
      start: async () => ({ success: true, message: "started whoami" }),
      stop: async () => ({ success: true, message: "stopped whoami" }),
    };
  });

  it("renders the service list and updates the details panel on selection", async () => {
    const browser = new ServiceBrowser(screen as never, lifecycleManager as never);

    await browser.render();

    const container = findChildByLabel(screen, " Services ");
    const list = container ? findChildByLabel(container, " Available ") : undefined;
    const details = container ? findChildByLabel(container, " Details ") : undefined;

    expect(container).toBeDefined();
    expect(list?.items).toHaveLength(1);
    expect(list?.items[0]).toContain("whoami");

    await list?.emitAsync("select", {}, 0);

    expect(details?.content).toContain("whoami");
    expect(details?.content).toContain("HTTP echo service");
    expect(details?.content).toContain("healthy");
    expect(screen.renderCount).toBeGreaterThan(0);

    patchSet.restore();
  });

  it("runs button actions and refreshes the service list", async () => {
    let listAllCalls = 0;
    const actions: string[] = [];
    lifecycleManager.listAll = async () => {
      listAllCalls += 1;
      return services;
    };
    lifecycleManager.enable = async (name: string) => {
      actions.push(`enable:${name}`);
      return { success: true, message: "enabled whoami" };
    };
    lifecycleManager.disable = async (name: string) => {
      actions.push(`disable:${name}`);
      return { success: false, message: "disable failed" };
    };
    lifecycleManager.start = async (name: string) => {
      actions.push(`start:${name}`);
      return { success: true, message: "started whoami" };
    };
    lifecycleManager.stop = async (name: string) => {
      actions.push(`stop:${name}`);
      return { success: false, message: "stop failed" };
    };

    const browser = new ServiceBrowser(screen as never, lifecycleManager as never);
    await browser.render();

    const container = findChildByLabel(screen, " Services ");
    const list = container ? findChildByLabel(container, " Available ") : undefined;
    const enableButton = container ? findChildByContent(container, "Enable") : undefined;
    const disableButton = container ? findChildByContent(container, "Disable") : undefined;
    const startButton = container ? findChildByContent(container, "Start") : undefined;
    const stopButton = container ? findChildByContent(container, "Stop") : undefined;

    await list?.emitAsync("select", {}, 0);
    await enableButton?.emitAsync("press");
    await disableButton?.emitAsync("press");
    await startButton?.emitAsync("press");
    await stopButton?.emitAsync("press");

    expect(listAllCalls).toBeGreaterThanOrEqual(2);
    expect(actions).toEqual(["enable:whoami", "disable:whoami", "start:whoami", "stop:whoami"]);
    expect(list?.items[0]).toContain("whoami");
    expect(screen.renderCount).toBeGreaterThan(0);

    patchSet.restore();
  });
});
