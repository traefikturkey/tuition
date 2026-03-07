/**
 * Service command tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ServiceCommand } from "../../src/cli/commands/service.js";

describe("ServiceCommand", () => {
  let captured: string[];
  let originalLog: typeof console.log;
  let command: ServiceCommand;

  beforeEach(() => {
    captured = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    };

    command = new ServiceCommand();
  });

  afterEach(() => {
    console.log = originalLog;
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
});
