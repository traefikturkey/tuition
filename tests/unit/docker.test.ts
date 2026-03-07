/**
 * Docker client tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { DockerClient } from "../../src/services/docker/client.js";
import type { ContainerStatus } from "../../src/services/docker/client.js";

describe("DockerClient", () => {
  let client: DockerClient;

  beforeEach(() => {
    client = new DockerClient();
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

  describe("listContainers", () => {
    it("should be defined as a method", () => {
      expect(typeof client.listContainers).toBe("function");
    });
  });

  describe("ping", () => {
    it("should be defined as a method", () => {
      expect(typeof client.ping).toBe("function");
    });
  });

  describe("networkExists", () => {
    it("should be defined as a method", () => {
      expect(typeof client.networkExists).toBe("function");
    });
  });

  describe("createNetwork", () => {
    it("should be defined as a method", () => {
      expect(typeof client.createNetwork).toBe("function");
    });
  });

  describe("getNetworkGateway", () => {
    it("should be defined as a method", () => {
      expect(typeof client.getNetworkGateway).toBe("function");
    });
  });

  describe("getContainerIP", () => {
    it("should be defined as a method", () => {
      expect(typeof client.getContainerIP).toBe("function");
    });
  });

  describe("getLogs", () => {
    it("should be defined as a method", () => {
      expect(typeof client.getLogs).toBe("function");
    });
  });

  describe("inspectContainer", () => {
    it("should be defined as a method", () => {
      expect(typeof client.inspectContainer).toBe("function");
    });
  });

  describe("version", () => {
    it("should be defined as a method", () => {
      expect(typeof client.version).toBe("function");
    });
  });

  describe("info", () => {
    it("should be defined as a method", () => {
      expect(typeof client.info).toBe("function");
    });
  });
});
