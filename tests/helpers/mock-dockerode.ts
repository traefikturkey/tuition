// @ts-expect-error Bun exposes mock.module at runtime, but current typings lag.
import { mock } from "bun:test";

class FakeDocker {
  ping(): Promise<void> {
    return Promise.resolve();
  }

  version(): Promise<Record<string, never>> {
    return Promise.resolve({});
  }

  info(): Promise<Record<string, never>> {
    return Promise.resolve({});
  }

  listContainers(): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  getContainer(): { inspect: () => Promise<Record<string, never>>; logs: () => Promise<Buffer> } {
    return {
      inspect: () => Promise.resolve({}),
      logs: () => Promise.resolve(Buffer.from([])),
    };
  }

  createNetwork(): Promise<void> {
    return Promise.resolve();
  }

  listNetworks(): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  getNetwork(): { inspect: () => Promise<Record<string, never>> } {
    return {
      inspect: () => Promise.resolve({}),
    };
  }
}

mock.module("dockerode", () => ({
  default: FakeDocker,
}));
