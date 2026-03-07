/**
 * Service command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { catalog } from "../../src/core/catalog/loader.js";
import { ServiceCommand } from "../../src/cli/commands/service.js";
import { captureConsoleLog, createPatchSet } from "../helpers/test-utils.js";

describe("ServiceCommand", () => {
  let captured: string[];
  let consoleCapture: ReturnType<typeof captureConsoleLog>;
  let patchSet: ReturnType<typeof createPatchSet>;
  let command: ServiceCommand;

  beforeEach(() => {
    consoleCapture = captureConsoleLog();
    captured = consoleCapture.output;
    patchSet = createPatchSet();

    command = new ServiceCommand();
  });

  afterEach(() => {
    patchSet.restore();
    consoleCapture.restore();
  });

  it("shows not found message when service does not exist", async () => {
    (
      command as unknown as { lifecycle: { initialize: () => Promise<void>; getService: () => Promise<null> } }
    ).lifecycle = {
      initialize: async () => undefined,
      getService: async () => null,
    };

    await command.show("nope", {});

    const output = captured.join("\n");
    expect(output).toContain("Service 'nope' not found");
  });

  it("prints success message when enable succeeds", async () => {
    (
      command as unknown as {
        lifecycle: { initialize: () => Promise<void>; enable: () => Promise<{ success: boolean; message: string }> };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      enable: async () => ({ success: true, message: "Service enabled" }),
    };

    await command.enable("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Service enabled");
  });

  it("passes auto-start false when enable is called with noStart", async () => {
    let receivedOptions: { autoStart: boolean } | undefined;

    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          enable: (_name: string, options: { autoStart: boolean }) => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      enable: async (_name, options) => {
        receivedOptions = options;
        return { success: true, message: "Service enabled" };
      },
    };

    await command.enable("whoami", { noStart: true });

    expect(receivedOptions).toEqual({ autoStart: false });
  });

  it("prints failure message when stop fails", async () => {
    (
      command as unknown as {
        lifecycle: { initialize: () => Promise<void>; stop: () => Promise<{ success: boolean; message: string }> };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      stop: async () => ({ success: false, message: "Stop failed" }),
    };

    await command.stop("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Stop failed");
  });

  it("prints success message when start succeeds", async () => {
    (
      command as unknown as {
        lifecycle: { initialize: () => Promise<void>; start: () => Promise<{ success: boolean; message: string }> };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      start: async () => ({ success: true, message: "Started" }),
    };

    await command.start("whoami", {});

    expect(captured.join("\n")).toContain("Started");
  });

  it("prints failure message when start fails", async () => {
    (
      command as unknown as {
        lifecycle: { initialize: () => Promise<void>; start: () => Promise<{ success: boolean; message: string }> };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      start: async () => ({ success: false, message: "Start failed" }),
    };

    await command.start("whoami", {});

    expect(captured.join("\n")).toContain("Start failed");
  });

  it("prints failure message when disable fails", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          disable: () => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      disable: async () => ({ success: false, message: "Disable failed" }),
    };

    await command.disable("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Disable failed");
  });

  it("prints success message when disable succeeds", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          disable: () => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      disable: async () => ({ success: true, message: "Service disabled" }),
    };

    await command.disable("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Service disabled");
  });

  it("prints success message when restart succeeds", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          restart: () => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      restart: async () => ({ success: true, message: "Service restarted" }),
    };

    await command.restart("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Service restarted");
  });

  it("prints failure message when restart fails", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          restart: () => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      restart: async () => ({ success: false, message: "Restart failed" }),
    };

    await command.restart("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Restart failed");
  });

  it("prints success message when update succeeds", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          update: () => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      update: async () => ({ success: true, message: "Service updated" }),
    };

    await command.update("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Service updated");
  });

  it("prints failure message when update fails", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          update: () => Promise<{ success: boolean; message: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      update: async () => ({ success: false, message: "Update failed" }),
    };

    await command.update("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Update failed");
  });

  it("prints logs output on success", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          logs: () => Promise<{ success: boolean; output: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      logs: async () => ({ success: true, output: "Log line 1\nLog line 2" }),
    };

    await command.logs("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Log line 1");
  });

  it("prints failure message when logs fail", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          logs: () => Promise<{ success: boolean; output: string }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      logs: async () => ({ success: false, output: "No container" }),
    };

    await command.logs("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Failed to get logs");
  });

  it("prints no services message when catalog is empty", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          listAll: () => Promise<never[]>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      listAll: async () => [],
    };

    await command.list({});

    const output = captured.join("\n");
    expect(output).toContain("No services available");
  });

  it("shows service details when found", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          getService: () => Promise<{
            name: string;
            state: string;
            definition: { description: string; category: string; upstreamUrl: string };
            containerStatus: null;
          }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      getService: async () => ({
        name: "whoami",
        state: "available",
        definition: {
          description: "HTTP test service",
          category: "development",
          upstreamUrl: "https://example.com",
        },
        containerStatus: null,
      }),
    };

    await command.show("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("whoami");
    expect(output).toContain("HTTP test service");
  });

  it("shows container details when a service has a running container", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          getService: () => Promise<{
            name: string;
            state: string;
            definition: { description: string; category: string };
            containerStatus: { id: string; state: string; health?: string };
          }>;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      getService: async () => ({
        name: "whoami",
        state: "running",
        definition: {
          description: "HTTP test service",
          category: "development",
        },
        containerStatus: {
          id: "1234567890abcdef",
          state: "running",
          health: "healthy",
        },
      }),
    };

    await command.show("whoami", {});

    const output = captured.join("\n");
    expect(output).toContain("Container Status:");
    expect(output).toContain("1234567890ab");
    expect(output).toContain("healthy");
  });

  it("lists services grouped by category and filtered when requested", async () => {
    (
      command as unknown as {
        lifecycle: {
          initialize: () => Promise<void>;
          listAll: () => Promise<
            Array<{
              name: string;
              state: string;
              definition?: { category?: string; description?: string };
            }>
          >;
        };
      }
    ).lifecycle = {
      initialize: async () => undefined,
      listAll: async () => [
        {
          name: "whoami",
          state: "running",
          definition: { category: "development", description: "Echo server" },
        },
        {
          name: "pihole",
          state: "enabled",
          definition: { category: "dns", description: "DNS blocker" },
        },
      ],
    };

    await command.list({ category: "development" });

    const output = captured.join("\n");
    expect(output).toContain("DEVELOPMENT:");
    expect(output).toContain("whoami");
    expect(output).not.toContain("pihole");
    expect(output).toContain("Legend:");
  });

  it("shows search results from the catalog", async () => {
    (command as unknown as { lifecycle: { initialize: () => Promise<void> } }).lifecycle = {
      initialize: async () => undefined,
    };
    patchSet.patch(
      catalog,
      "search",
      async () =>
        [
          { name: "whoami", description: "HTTP echo" },
          { name: "webtop", description: "Browser desktop" },
        ] as never
    );

    await command.search("web", {});

    const output = captured.join("\n");
    expect(output).toContain("Search results for 'web'");
    expect(output).toContain("whoami");
    expect(output).toContain("webtop");
  });

  it("prints a no-results message when search finds nothing", async () => {
    (command as unknown as { lifecycle: { initialize: () => Promise<void> } }).lifecycle = {
      initialize: async () => undefined,
    };
    patchSet.patch(catalog, "search", async () => []);

    await command.search("missing", {});

    expect(captured.join("\n")).toContain("No services found matching 'missing'");
  });
});
