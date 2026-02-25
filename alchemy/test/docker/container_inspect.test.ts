import { describe, expect, vi, beforeAll } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { BRANCH_PREFIX } from "../util.ts";
import type { ContainerInfo } from "../../src/docker/api.ts";

import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Container inspect", () => {
  let Container: typeof import("../../src/docker/container.ts").Container;

  beforeAll(async () => {
    vi.doMock("../../src/docker/api.ts", async (importOriginal) => {
      const mod = await importOriginal<typeof import("../../src/docker/api.ts")>();
      return {
        ...mod,
        DockerApi: vi.fn().mockImplementation(() => ({
          containerExists: vi.fn().mockResolvedValue(false),
          createContainer: vi.fn().mockResolvedValue("mock-id"),
          startContainer: vi.fn().mockResolvedValue(undefined),
          stopContainer: vi.fn().mockResolvedValue(undefined),
          removeContainer: vi.fn().mockResolvedValue(undefined),
          connectNetwork: vi.fn().mockResolvedValue(undefined),
          disconnectNetwork: vi.fn().mockResolvedValue(undefined),
          inspectContainer: vi.fn().mockImplementation((name: string) => {
            // Return mock container info
            const info: ContainerInfo = {
              Id: "mock-id",
              State: { Status: name.includes("running") ? "running" : "created" },
              Created: new Date().toISOString(),
              Config: {
                Image: "hello-world:latest",
                Cmd: [],
                Env: [],
                Healthcheck: null,
              },
              HostConfig: {
                PortBindings: {},
                Binds: [],
                RestartPolicy: { Name: "no", MaximumRetryCount: 0 },
                AutoRemove: false,
              },
              NetworkSettings: {
                Networks: {},
                Ports: {}
              },
            };

            // Add port mappings for running containers or specific test cases
            if (name.includes("ports")) {
              info.NetworkSettings.Ports = {
                "80/tcp": [{ HostIp: "0.0.0.0", HostPort: "32768" }],
                "443/tcp": [{ HostIp: "0.0.0.0", HostPort: "32769" }],
              };
            }

            // Fix up name if needed, usually it has slash
            (info as any).Name = name.startsWith("/") ? name : `/${name}`;

            return Promise.resolve([info]);
          }),
          exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
        })),
      };
    });

    const containerModule = await import("../../src/docker/container.ts");
    Container = containerModule.Container;
  });

  test("should inspect a created container and return runtime info", async (scope) => {
    try {
      const containerName = `${BRANCH_PREFIX}-inspect-test`;
      const container = await Container("inspect-test", {
        image: "hello-world:latest",
        name: containerName,
        start: false,
      });

      expect(container.state).toBe("created");

      const info = await container.inspect();
      expect(info).toBeDefined();
      expect(info.id).toBe("mock-id");
      expect(info.ports).toEqual({});
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("should inspect a running container with ports and return distilled info", async (scope) => {
    try {
      const containerName = `${BRANCH_PREFIX}-inspect-ports-running-test`;
      const container = await Container("inspect-ports-running-test", {
        image: "nginx:latest",
        name: containerName,
        start: true,
        ports: [{ internal: 80, external: 0 }, { internal: 443, external: 0 }]
      });

      expect(container.state).toBe("running");

      const info = await container.inspect();
      expect(info).toBeDefined();
      expect(info.id).toBe("mock-id");

      // Check ports map
      expect(info.ports).toBeDefined();
      expect(info.ports["80/tcp"]).toBe(32768);
      expect(info.ports["443/tcp"]).toBe(32769);
    } finally {
      await alchemy.destroy(scope);
    }
  });
});
