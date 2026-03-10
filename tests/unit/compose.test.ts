/**
 * Docker Compose manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ComposeManager } from "../../src/services/docker/compose.js";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseYaml } from "yaml";
import type { ServiceDefinition } from "../../src/types/index.js";
import { createPatchSet } from "../helpers/test-utils.js";

describe("ComposeManager", () => {
  let tempDir: string;
  let composeManager: ComposeManager;
  let patchSet: ReturnType<typeof createPatchSet>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tuition-compose-test-"));
    composeManager = new ComposeManager(tempDir);
    patchSet = createPatchSet();
  });

  afterEach(async () => {
    patchSet.restore();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("generateCompose", () => {
    it("should generate compose file for simple service", async () => {
      const definition: ServiceDefinition = {
        name: "test-service",
        category: "dns",
        description: "Test service",
        image: "test:latest",
      };

      const path = await composeManager.generateCompose("test-service", definition, { TEST_VAR: "value" });

      expect(path).toContain("test-service.docker-compose.yaml");
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { image: string; container_name: string; restart: string; networks?: string[] }>;
        networks: Record<string, { driver: string; external: boolean }>;
      };

      expect(compose.services["test-service"]?.image).toBe("test:latest");
      expect(compose.services["test-service"]?.container_name).toBe("test-service");
      expect(compose.services["test-service"]?.restart).toBe("unless-stopped");
      expect(compose.services["test-service"]?.networks).toEqual(["tuition"]);
      expect(compose.networks?.tuition).toEqual({ driver: "bridge", external: true });
    });

    it("should include environment variables", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
        environment: {
          VAR1: "${TEST_VAR}",
          VAR2: "static",
        },
      };

      const path = await composeManager.generateCompose("test", definition, {
        TEST_VAR: "resolved",
      });

      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { environment: Record<string, string> }>;
      };

      expect(compose.services.test?.environment).toEqual({
        VAR1: "resolved",
        VAR2: "static",
      });
    });

    it("should format ports correctly", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
        ports: [
          { host: 80, container: 80, protocol: "tcp" },
          { host: 443, container: 443, protocol: "tcp" },
        ],
      };

      const path = await composeManager.generateCompose("test", definition, {});
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { ports: string[]; healthcheck?: { test: string[] } }>;
      };

      expect(compose.services.test?.ports).toEqual(["80:80/tcp", "443:443/tcp"]);
      expect(compose.services.test?.healthcheck?.test).toEqual(["CMD", "nc", "-z", "localhost", "80"]);
    });

    it("should handle volumes with variable substitution", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
        volumes: [{ host: "./data/test", container: "/data", readOnly: false }],
      };

      const path = await composeManager.generateCompose("test", definition, {});
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { volumes: string[] }>;
      };

      expect(compose.services.test?.volumes).toEqual(["././data/test:/data"]);
    });

    it("should include resource limits when present", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
        resourceLimits: {
          cpus: 2,
          memory: "512M",
        },
      };

      const path = await composeManager.generateCompose("test", definition, {});
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { deploy?: { resources?: { limits?: { cpus?: string; memory?: string } } } }>;
      };

      expect(compose.services.test?.deploy?.resources?.limits).toEqual({
        cpus: "2",
        memory: "512M",
      });
    });

    it("should auto-generate coredns.host.name label from caddy label", async () => {
      const definition: ServiceDefinition = {
        name: "sonarr",
        category: "downloads",
        description: "TV automation",
        image: "linuxserver/sonarr:latest",
        labels: {
          caddy: "sonarr.${DOMAIN}",
          "caddy.reverse_proxy": "{{upstreams 8989}}",
        },
      };

      const path = await composeManager.generateCompose("sonarr", definition, {
        DOMAIN: "nexus-central.tech",
      });
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { labels: Record<string, string> }>;
      };

      expect(compose.services.sonarr?.labels["coredns.host.name"]).toBe("sonarr.nexus-central.tech");
    });

    it("should not add coredns.host.name when no caddy label exists", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
        labels: {
          "some.other.label": "value",
        },
      };

      const path = await composeManager.generateCompose("test", definition, {});
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { labels: Record<string, string> }>;
      };

      expect(compose.services.test?.labels["coredns.host.name"]).toBeUndefined();
    });

    it("should not add coredns.host.name when service has no labels", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
      };

      const path = await composeManager.generateCompose("test", definition, {});
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { labels?: Record<string, string> }>;
      };

      expect(compose.services.test?.labels).toBeUndefined();
    });

    it("should resolve DOMAIN placeholder in coredns.host.name", async () => {
      const definition: ServiceDefinition = {
        name: "webtop",
        category: "media",
        description: "Desktop",
        image: "linuxserver/webtop:latest",
        labels: {
          caddy: "webtop.${DOMAIN}",
          "caddy.reverse_proxy": "{{upstreams 3000}}",
        },
      };

      const path = await composeManager.generateCompose("webtop", definition, {
        DOMAIN: "example.com",
      });
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { labels: Record<string, string> }>;
      };

      expect(compose.services.webtop?.labels["coredns.host.name"]).toBe("webtop.example.com");
      // Original caddy label should be preserved as-is (unresolved)
      expect(compose.services.webtop?.labels["caddy"]).toBe("webtop.${DOMAIN}");
    });
  });

  describe("command execution wrappers", () => {
    it("returns a clear error when compose file is missing for up()", async () => {
      const result = await composeManager.up("missing-service");

      expect(result.success).toBe(false);
      expect(result.output).toContain("Compose file not found");
      expect(result.output).toContain("missing-service.docker-compose.yaml");
    });

    it("passes compose up arguments and merged environment to execDocker()", async () => {
      const composePath = join(tempDir, "whoami.docker-compose.yaml");
      await writeFile(composePath, "services: {}", "utf-8");

      let capturedArgs: string[] | undefined;
      let capturedEnv: Record<string, string> | undefined;
      (
        composeManager as unknown as {
          execDocker: (args: string[], env?: Record<string, string>) => Promise<{ success: boolean; output: string }>;
        }
      ).execDocker = async (args, env) => {
        capturedArgs = args;
        capturedEnv = env;
        return { success: true, output: "started" };
      };

      const result = await composeManager.up("whoami", {
        detached: false,
        build: true,
        env: { CF_API_TOKEN: "token" },
      });

      expect(result).toEqual({ success: true, output: "started" });
      expect(capturedArgs).toEqual(["compose", "-f", composePath, "-p", "whoami", "up", "--build"]);
      expect(capturedEnv).toEqual({ CF_API_TOKEN: "token" });
    });

    it("adds detached mode by default for up()", async () => {
      const composePath = join(tempDir, "whoami.docker-compose.yaml");
      await writeFile(composePath, "services: {}", "utf-8");

      let capturedArgs: string[] | undefined;
      (
        composeManager as unknown as {
          execDocker: (args: string[], env?: Record<string, string>) => Promise<{ success: boolean; output: string }>;
        }
      ).execDocker = async (args) => {
        capturedArgs = args;
        return { success: true, output: "started" };
      };

      await composeManager.up("whoami");

      expect(capturedArgs).toEqual(["compose", "-f", composePath, "-p", "whoami", "up", "-d"]);
    });

    it("passes removal flags to down()", async () => {
      const composePath = join(tempDir, "whoami.docker-compose.yaml");
      let capturedArgs: string[] | undefined;
      (
        composeManager as unknown as {
          execDocker: (args: string[], env?: Record<string, string>) => Promise<{ success: boolean; output: string }>;
        }
      ).execDocker = async (args) => {
        capturedArgs = args;
        return { success: true, output: "stopped" };
      };

      const result = await composeManager.down("whoami", {
        removeVolumes: true,
        removeImages: true,
      });

      expect(result).toEqual({ success: true, output: "stopped" });
      expect(capturedArgs).toEqual(["compose", "-f", composePath, "-p", "whoami", "down", "-v", "--rmi", "all"]);
    });

    it("builds ps(), logs(), and pull() commands correctly", async () => {
      const commands: string[][] = [];
      (
        composeManager as unknown as {
          execDocker: (args: string[], env?: Record<string, string>) => Promise<{ success: boolean; output: string }>;
        }
      ).execDocker = async (args) => {
        commands.push(args);
        return { success: true, output: "ok" };
      };

      await composeManager.ps("whoami");
      await composeManager.logs("whoami", { tail: 50, timestamps: true, follow: true });
      await composeManager.pull("whoami");

      expect(commands).toEqual([
        ["compose", "-f", join(tempDir, "whoami.docker-compose.yaml"), "-p", "whoami", "ps"],
        [
          "compose",
          "-f",
          join(tempDir, "whoami.docker-compose.yaml"),
          "-p",
          "whoami",
          "logs",
          "--tail",
          "50",
          "--timestamps",
          "-f",
        ],
        ["compose", "-f", join(tempDir, "whoami.docker-compose.yaml"), "-p", "whoami", "pull"],
      ]);
    });
  });

  describe("private helpers", () => {
    it("returns trimmed stdout and stderr from execDocker", async () => {
      patchSet.patch(
        composeManager as unknown as {
          spawnProcess: (
            command: string,
            args: string[],
            options: Record<string, unknown>
          ) => {
            stdout: { on: (event: string, handler: (data: Buffer) => void) => void };
            stderr: { on: (event: string, handler: (data: Buffer) => void) => void };
            on: (event: string, handler: (value: unknown) => void) => void;
          };
        },
        "spawnProcess",
        ((_command: string, _args: string[], _options: Record<string, unknown>) => {
          const handlers: Record<string, (value: unknown) => void> = {};

          queueMicrotask(() => {
            handlers["stdout:data"]?.(Buffer.from("compose-stdout"));
            handlers["stderr:data"]?.(Buffer.from("compose-stderr"));
            handlers.close?.(0);
          });

          return {
            stdout: {
              on: (event: string, handler: (data: Buffer) => void) => {
                handlers[`stdout:${event}`] = handler as (value: unknown) => void;
              },
            },
            stderr: {
              on: (event: string, handler: (data: Buffer) => void) => {
                handlers[`stderr:${event}`] = handler as (value: unknown) => void;
              },
            },
            on: (event: string, handler: (value: unknown) => void) => {
              handlers[event] = handler;
            },
          };
        }) as never
      );

      const result = await (
        composeManager as unknown as {
          execDocker: (args: string[], env?: Record<string, string>) => Promise<{ success: boolean; output: string }>;
        }
      ).execDocker(["compose", "ps"], { TEST: "value" });

      expect(result).toEqual({
        success: true,
        output: "compose-stdout\ncompose-stderr",
      });
    });

    it("returns spawn errors from execDocker", async () => {
      patchSet.patch(
        composeManager as unknown as {
          spawnProcess: (
            command: string,
            args: string[],
            options: Record<string, unknown>
          ) => {
            stdout: { on: () => void };
            stderr: { on: () => void };
            on: (event: string, handler: (value: unknown) => void) => void;
          };
        },
        "spawnProcess",
        ((_command: string, _args: string[], _options: Record<string, unknown>) => {
          const handlers: Record<string, (value: unknown) => void> = {};

          queueMicrotask(() => {
            handlers.error?.(new Error("spawn boom"));
          });

          return {
            stdout: { on: () => undefined },
            stderr: { on: () => undefined },
            on: (event: string, handler: (value: unknown) => void) => {
              handlers[event] = handler;
            },
          };
        }) as never
      );

      const result = await (
        composeManager as unknown as {
          execDocker: (args: string[], env?: Record<string, string>) => Promise<{ success: boolean; output: string }>;
        }
      ).execDocker(["compose", "ps"]);

      expect(result).toEqual({
        success: false,
        output: "spawn boom",
      });
    });

    it("preserves unresolved environment placeholders", () => {
      const result = (
        composeManager as unknown as {
          resolveEnvironment: (env: Record<string, string>, vars: Record<string, string>) => Record<string, string>;
        }
      ).resolveEnvironment({ TOKEN: "${KNOWN}", OPTIONAL: "${UNKNOWN}" }, { KNOWN: "value" });

      expect(result).toEqual({ TOKEN: "value", OPTIONAL: "${UNKNOWN}" });
    });

    it("formats read-only, absolute, and home-directory volumes correctly", () => {
      const { serviceVolumes } = (
        composeManager as unknown as {
          resolveVolumes: (
            volumes: Array<{ host: string; container: string; readOnly?: boolean }>,
            vars: Record<string, string>
          ) => { serviceVolumes: string[]; topLevelVolumes: Record<string, unknown> };
        }
      ).resolveVolumes(
        [
          { host: "/var/lib/data", container: "/data", readOnly: true },
          { host: "~/config", container: "/config" },
          { host: "${ROOT}/cache", container: "/cache" },
        ],
        { ROOT: "storage" }
      );

      expect(serviceVolumes).toEqual(["/var/lib/data:/data:ro", "~/config:/config", "./storage/cache:/cache"]);
    });
  });

  describe("NFS volume generation", () => {
    it("generates a Docker named volume with driver_opts for a type:nfs volume", async () => {
      const definition: ServiceDefinition = {
        name: "plex",
        category: "media",
        description: "Media server",
        image: "plexinc/pms-docker:latest",
        volumes: [
          { host: "./data/plex/config", container: "/config" },
          { type: "nfs", nfsName: "media", subPath: "tv", container: "/data/tv" },
        ],
      };

      const nfsConfigs = [{ name: "media", server: "192.168.1.10", path: "/export/media", mountPoint: "" }];
      const path = await composeManager.generateCompose("plex", definition, {}, nfsConfigs);
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        services: Record<string, { volumes: string[] }>;
        volumes?: Record<string, { driver: string; driver_opts: Record<string, string> }>;
      };

      // Service entry should reference named volume and bind mount
      expect(compose.services["plex"]?.volumes).toContain("nfs_media_tv:/data/tv");
      expect(compose.services["plex"]?.volumes).toContain("././data/plex/config:/config");

      // Top-level named volume should carry NFS driver_opts
      const vol = compose.volumes?.["nfs_media_tv"];
      expect(vol?.driver).toBe("local");
      expect(vol?.driver_opts["type"]).toBe("nfs");
      expect(vol?.driver_opts["o"]).toContain("addr=192.168.1.10");
      expect(vol?.driver_opts["device"]).toBe(":/export/media/tv");
    });

    it("uses root device path when no subPath is provided", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "storage",
        description: "Test",
        image: "test:latest",
        volumes: [{ type: "nfs", nfsName: "media", container: "/data" }],
      };

      const nfsConfigs = [{ name: "media", server: "10.0.0.1", path: "/share", mountPoint: "" }];
      const path = await composeManager.generateCompose("test", definition, {}, nfsConfigs);
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        volumes?: Record<string, { driver_opts: Record<string, string> }>;
      };

      expect(compose.volumes?.["nfs_media_root"]?.driver_opts["device"]).toBe(":/share");
    });

    it("applies readOnly flag to NFS named volume service entry", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "storage",
        description: "Test",
        image: "test:latest",
        volumes: [{ type: "nfs", nfsName: "media", subPath: "music", container: "/music", readOnly: true }],
      };

      const nfsConfigs = [{ name: "media", server: "10.0.0.1", path: "/export", mountPoint: "" }];
      const path = await composeManager.generateCompose("test", definition, {}, nfsConfigs);
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as { services: Record<string, { volumes: string[] }> };

      expect(compose.services["test"]?.volumes[0]).toBe("nfs_media_music:/music:ro");
    });

    it("uses NfsConfig.options as mount options when no per-volume override is given", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "storage",
        description: "Test",
        image: "test:latest",
        volumes: [{ type: "nfs", nfsName: "data", subPath: "files", container: "/files" }],
      };

      const nfsConfigs = [{ name: "data", server: "10.0.0.1", path: "/data", mountPoint: "", options: "ro,noatime" }];
      const path = await composeManager.generateCompose("test", definition, {}, nfsConfigs);
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as {
        volumes?: Record<string, { driver_opts: Record<string, string> }>;
      };

      expect(compose.volumes?.["nfs_data_files"]?.driver_opts["o"]).toBe("addr=10.0.0.1,ro,noatime");
    });

    it("omits top-level volumes section when only bind mounts are present", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "dns",
        description: "Test",
        image: "test:latest",
        volumes: [{ host: "./data", container: "/data" }],
      };

      const path = await composeManager.generateCompose("test", definition, {}, []);
      const content = await readFile(path, "utf-8");
      const compose = parseYaml(content) as { volumes?: unknown };

      expect(compose.volumes).toBeUndefined();
    });

    it("inserts a placeholder comment for an unresolvable NFS reference", async () => {
      const definition: ServiceDefinition = {
        name: "test",
        category: "storage",
        description: "Test",
        image: "test:latest",
        volumes: [{ type: "nfs", nfsName: "missing", subPath: "tv", container: "/data" }],
      };

      const path = await composeManager.generateCompose("test", definition, {}, []);
      const content = await readFile(path, "utf-8");
      // The placeholder comment is emitted in the raw YAML, not as a parsed entry
      expect(content).toContain("UNRESOLVED NFS");
    });
  });
});
