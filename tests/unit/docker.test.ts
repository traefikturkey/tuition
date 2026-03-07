/**
 * Docker client tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { DockerClient } from "../../src/services/docker/client.js";
import type { ContainerStatus } from "../../src/services/docker/client.js";

describe("DockerClient", () => {
  let client: DockerClient;
  let dockerApi: {
    ping: () => Promise<void>;
    version: () => Promise<unknown>;
    info: () => Promise<unknown>;
    listContainers: (options: { all: boolean }) => Promise<unknown[]>;
    getContainer: (id: string) => { inspect: () => Promise<unknown>; logs: () => Promise<unknown> };
    createNetwork: (options: Record<string, unknown>) => Promise<void>;
    listNetworks: () => Promise<Array<{ Name: string }>>;
    getNetwork: (name: string) => { inspect: () => Promise<unknown> };
  };

  beforeEach(() => {
    client = new DockerClient();
    dockerApi = {
      ping: async () => undefined,
      version: async () => ({ Version: "1.0" }),
      info: async () => ({ ServerVersion: "26.0", Containers: 3, Images: 7 }),
      listContainers: async () => [],
      getContainer: () => ({
        inspect: async () => ({ Id: "container-id" }),
        logs: async () => Buffer.from([]),
      }),
      createNetwork: async () => undefined,
      listNetworks: async () => [],
      getNetwork: () => ({
        inspect: async () => ({ IPAM: { Config: [{ Gateway: "10.0.0.1" }] } }),
      }),
    };

    (client as unknown as { docker: typeof dockerApi }).docker = dockerApi;
  });

  describe("mapContainerInfo", () => {
    it("should map container info correctly", () => {
      // Access private method for testing via any cast
      const dockerClient = client as unknown as {
        mapContainerInfo: (container: {
          Id: string;
          Names: string[];
          Image: string;
          State: string;
          Status: string;
          Ports: Array<{
            PrivatePort: number;
            PublicPort?: number;
            Type: string;
          }>;
          Labels: Record<string, string> | null;
        }) => ContainerStatus;
      };

      const mockContainer = {
        Id: "abc123",
        Names: ["/test-container"],
        Image: "test:latest",
        State: "running",
        Status: "Up 5 minutes (healthy)",
        Ports: [{ PrivatePort: 80, PublicPort: 8080, Type: "tcp" }],
        Labels: { "test.label": "value" },
      };

      const result = dockerClient.mapContainerInfo(mockContainer);

      expect(result.id).toBe("abc123");
      expect(result.name).toBe("/test-container");
      expect(result.image).toBe("test:latest");
      expect(result.state).toBe("running");
      expect(result.status).toBe("Up 5 minutes (healthy)");
      expect(result.health).toBe("healthy");
      expect(result.ports).toHaveLength(1);
      expect(result.ports[0]?.privatePort).toBe(80);
      expect(result.ports[0]?.publicPort).toBe(8080);
    });

    it("should handle container without health status", () => {
      const dockerClient = client as unknown as {
        mapContainerInfo: (container: {
          Id: string;
          Names: string[];
          Image: string;
          State: string;
          Status: string;
          Ports: Array<{
            PrivatePort: number;
            PublicPort?: number;
            Type: string;
          }>;
          Labels: Record<string, string> | null;
        }) => ContainerStatus;
      };

      const mockContainer = {
        Id: "def456",
        Names: ["/simple-container"],
        Image: "nginx:latest",
        State: "running",
        Status: "Up 2 hours",
        Ports: [],
        Labels: null,
      };

      const result = dockerClient.mapContainerInfo(mockContainer);

      expect(result.health).toBeUndefined();
      expect(result.ports).toHaveLength(0);
      expect(result.labels).toEqual({});
    });

    it("should handle all health states", () => {
      const dockerClient = client as unknown as {
        mapContainerInfo: (container: {
          Id: string;
          Names: string[];
          Image: string;
          State: string;
          Status: string;
          Ports: Array<{
            PrivatePort: number;
            PublicPort?: number;
            Type: string;
          }>;
          Labels: Record<string, string> | null;
        }) => ContainerStatus;
      };

      const healthStates = [
        { status: "Up 1 minute (healthy)", expected: "healthy" },
        { status: "Up 1 minute (unhealthy)", expected: "unhealthy" },
        { status: "Up 1 minute (health: starting)", expected: "starting" },
        { status: "Up 1 minute", expected: undefined },
      ];

      for (const { status, expected } of healthStates) {
        const result = dockerClient.mapContainerInfo({
          Id: "test",
          Names: ["/test"],
          Image: "test",
          State: "running",
          Status: status,
          Ports: [],
          Labels: {},
        });

        expect(result.health).toBe(expected);
      }
    });
  });

  describe("containerExists", () => {
    it("should return false when no containers match", async () => {
      // Stub listContainers to return empty
      const original = client.listContainers.bind(client);
      (client as unknown as { listContainers: () => Promise<ContainerStatus[]> }).listContainers = async () => [];

      const result = await client.containerExists("nonexistent");
      expect(result).toBe(false);

      client.listContainers = original;
    });

    it("should return true when container name matches", async () => {
      const original = client.listContainers.bind(client);
      (client as unknown as { listContainers: () => Promise<ContainerStatus[]> }).listContainers = async () => [
        {
          id: "abc123",
          name: "/mycontainer",
          image: "test:latest",
          state: "running",
          status: "Up 1 minute",
          ports: [],
          labels: {},
        },
      ];

      const result = await client.containerExists("mycontainer");
      expect(result).toBe(true);

      client.listContainers = original;
    });
  });

  describe("ping", () => {
    it("should return true when Docker responds to ping", async () => {
      const result = await client.ping();
      expect(result).toBe(true);
    });

    it("should return false when Docker ping throws", async () => {
      dockerApi.ping = async () => {
        throw new Error("daemon unavailable");
      };

      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe("version", () => {
    it("should return Docker version information", async () => {
      dockerApi.version = async () => ({ Version: "26.1.0" });

      const result = await client.version();
      expect(result).toEqual({ Version: "26.1.0" });
    });
  });

  describe("listContainers", () => {
    it("should map Docker containers from the daemon", async () => {
      dockerApi.listContainers = async () => [
        {
          Id: "mapped1",
          Names: ["/mapped"],
          Image: "nginx:latest",
          State: "running",
          Status: "Up 10 minutes (healthy)",
          Ports: [{ PrivatePort: 80, PublicPort: 8080, Type: "tcp" }],
          Labels: { role: "web" },
        },
      ];

      const result = await client.listContainers();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("mapped1");
      expect(result[0]?.name).toBe("/mapped");
      expect(result[0]?.image).toBe("nginx:latest");
      expect(result[0]?.state).toBe("running");
      expect(result[0]?.health).toBe("healthy");
    });
  });

  describe("getContainer", () => {
    it("should return null when no containers match", async () => {
      const original = client.listContainers.bind(client);
      (client as unknown as { listContainers: () => Promise<ContainerStatus[]> }).listContainers = async () => [];

      const result = await client.getContainer("missing");
      expect(result).toBeNull();

      client.listContainers = original;
    });

    it("should match by exact name", async () => {
      const original = client.listContainers.bind(client);
      (client as unknown as { listContainers: () => Promise<ContainerStatus[]> }).listContainers = async () => [
        {
          id: "abc",
          name: "whoami",
          image: "traefik/whoami:latest",
          state: "running",
          status: "Up 5 min",
          ports: [],
          labels: {},
        },
      ];

      const result = await client.getContainer("whoami");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("abc");

      client.listContainers = original;
    });

    it("should match by partial ID prefix", async () => {
      const original = client.listContainers.bind(client);
      (client as unknown as { listContainers: () => Promise<ContainerStatus[]> }).listContainers = async () => [
        {
          id: "abc123def456",
          name: "/container1",
          image: "test",
          state: "running",
          status: "Up",
          ports: [],
          labels: {},
        },
      ];

      const result = await client.getContainer("abc123");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("abc123def456");

      client.listContainers = original;
    });
  });

  describe("getLogs", () => {
    it("should decode Docker multiplexed log buffers", async () => {
      const payload = Buffer.concat([
        Buffer.from([1, 0, 0, 0, 0, 0, 0, 5]),
        Buffer.from("hello"),
        Buffer.from([2, 0, 0, 0, 0, 0, 0, 5]),
        Buffer.from("world"),
      ]);

      dockerApi.getContainer = () => ({
        inspect: async () => ({ Id: "container-id" }),
        logs: async () => payload,
      });

      const result = await client.getLogs("abc123", { tail: 10, timestamps: true });

      expect(result).toBe("helloworld");
    });

    it("should return empty string for non-buffer log responses", async () => {
      dockerApi.getContainer = () => ({
        inspect: async () => ({ Id: "container-id" }),
        logs: async () => "not-a-buffer",
      });

      const result = await client.getLogs("abc123");

      expect(result).toBe("");
    });
  });

  describe("inspectContainer", () => {
    it("should inspect the requested container", async () => {
      dockerApi.getContainer = (id: string) => ({
        inspect: async () => ({ Id: id, Name: "inspected" }),
        logs: async () => Buffer.from([]),
      });

      const result = await client.inspectContainer("inspect-me");
      expect(result).toEqual({ Id: "inspect-me", Name: "inspected" });
    });
  });

  describe("createNetwork", () => {
    it("should create a bridge network", async () => {
      let receivedOptions: Record<string, unknown> | undefined;
      dockerApi.createNetwork = async (options) => {
        receivedOptions = options;
      };

      await client.createNetwork("tuition");

      expect(receivedOptions).toEqual({
        Name: "tuition",
        Driver: "bridge",
        CheckDuplicate: true,
      });
    });

    it("should ignore already existing networks", async () => {
      dockerApi.createNetwork = async () => {
        throw new Error("network already exists");
      };

      await expect(client.createNetwork("tuition")).resolves.toBeUndefined();
    });

    it("should rethrow unexpected network creation errors", async () => {
      dockerApi.createNetwork = async () => {
        throw new Error("permission denied");
      };

      try {
        await client.createNetwork("tuition");
        throw new Error("Expected createNetwork to throw");
      } catch (error) {
        expect((error as Error).message).toContain("permission denied");
      }
    });
  });

  describe("networkExists", () => {
    it("should return true when the network exists", async () => {
      dockerApi.listNetworks = async () => [{ Name: "tuition" }];

      const result = await client.networkExists("tuition");
      expect(result).toBe(true);
    });

    it("should return false when listing networks fails", async () => {
      dockerApi.listNetworks = async () => {
        throw new Error("daemon unavailable");
      };

      const result = await client.networkExists("tuition");
      expect(result).toBe(false);
    });
  });

  describe("info", () => {
    it("should return Docker system information", async () => {
      dockerApi.info = async () => ({ ServerVersion: "26.1.0", Containers: 5 });

      const result = await client.info();
      expect(result).toEqual({ ServerVersion: "26.1.0", Containers: 5 });
    });
  });

  describe("getNetworkGateway", () => {
    it("should return the configured network gateway", async () => {
      dockerApi.getNetwork = () => ({
        inspect: async () => ({ IPAM: { Config: [{ Gateway: "10.0.7.1" }] } }),
      });

      const result = await client.getNetworkGateway("tuition");
      expect(result).toBe("10.0.7.1");
    });

    it("should return null when network inspection fails", async () => {
      dockerApi.getNetwork = () => ({
        inspect: async () => {
          throw new Error("not found");
        },
      });

      const result = await client.getNetworkGateway("missing");
      expect(result).toBeNull();
    });
  });

  describe("getContainerIP", () => {
    it("should return the container IP without CIDR suffix", async () => {
      dockerApi.getNetwork = () => ({
        inspect: async () => ({
          Containers: {
            abc123: {
              Name: "whoami",
              IPv4Address: "10.0.7.2/24",
            },
          },
        }),
      });

      const result = await client.getContainerIP("whoami", "tuition");
      expect(result).toBe("10.0.7.2");
    });

    it("should return null when the container is not on the network", async () => {
      dockerApi.getNetwork = () => ({
        inspect: async () => ({ Containers: {} }),
      });

      const result = await client.getContainerIP("whoami", "tuition");
      expect(result).toBeNull();
    });

    it("should return null when network inspection throws", async () => {
      dockerApi.getNetwork = () => ({
        inspect: async () => {
          throw new Error("daemon unavailable");
        },
      });

      const result = await client.getContainerIP("whoami", "tuition");
      expect(result).toBeNull();
    });
  });
});
