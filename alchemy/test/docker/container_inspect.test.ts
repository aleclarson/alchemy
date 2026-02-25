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
              },
            };
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

  test("should inspect a created container", async (scope) => {
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
      expect(info.Id).toBe("mock-id");
      expect(info.Name).toBe(`/${containerName}`);
      expect(info.State.Status).toBe("created");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("should inspect a running container", async (scope) => {
    try {
      const containerName = `${BRANCH_PREFIX}-inspect-running-test`;
      const container = await Container("inspect-running-test", {
        image: "nginx:latest",
        name: containerName,
        start: true,
      });

      expect(container.state).toBe("running");

      const info = await container.inspect();
      expect(info).toBeDefined();
      expect(info.Id).toBe("mock-id");
      expect(info.Name).toBe(`/${containerName}`);
      expect(info.State.Status).toBe("running");
    } finally {
      await alchemy.destroy(scope);
    }
  });
});
