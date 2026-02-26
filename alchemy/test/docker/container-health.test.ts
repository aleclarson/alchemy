import { describe, expect, vi } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { Container } from "../../src/docker/container.ts";
import { DockerApi, type ContainerInfo } from "../../src/docker/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

// Mock DockerApi
vi.mock("../../src/docker/api.ts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/docker/api.ts")>();
  const DockerApi = vi.fn();

  // Default mock implementations
  DockerApi.prototype.containerExists = vi.fn().mockResolvedValue(true);
  DockerApi.prototype.createContainer = vi.fn().mockResolvedValue("test-id");
  DockerApi.prototype.startContainer = vi.fn().mockResolvedValue(undefined);
  DockerApi.prototype.stopContainer = vi.fn().mockResolvedValue(undefined);
  DockerApi.prototype.removeContainer = vi.fn().mockResolvedValue(undefined);
  DockerApi.prototype.connectNetwork = vi.fn().mockResolvedValue(undefined);
  DockerApi.prototype.disconnectNetwork = vi.fn().mockResolvedValue(undefined);
  DockerApi.prototype.inspectContainer = vi.fn().mockResolvedValue([]);

  return {
    ...mod,
    DockerApi,
  };
});

// Helper to create a mock ContainerInfo
function createMockContainerInfo(healthStatus?: "none" | "starting" | "healthy" | "unhealthy"): ContainerInfo {
  const info: any = {
    Id: "test-id",
    State: {
      Status: "running",
    },
    Created: new Date().toISOString(),
    Config: {
      Image: "nginx:latest",
      Cmd: [],
      Env: [],
    },
    HostConfig: {
      PortBindings: {},
      Binds: [],
      RestartPolicy: { Name: "no", MaximumRetryCount: 0 },
      AutoRemove: false,
    },
    NetworkSettings: {
      Networks: {},
      Ports: {},
    },
  };

  if (healthStatus) {
    info.State.Health = {
      Status: healthStatus,
      FailingStreak: 0,
      Log: [],
    };
  }

  return info;
}

describe.sequential("Container Health", () => {

  test("inspect returns 'healthy' status", async (scope) => {
    // Mock inspectContainer to return healthy status
    const mockInfo = createMockContainerInfo("healthy");
    (DockerApi.prototype.inspectContainer as any).mockResolvedValue([mockInfo]);

    try {
      const container = await Container("health-test-healthy", {
        image: "nginx:latest",
        start: true,
        adopt: true // force adoption to avoid create call
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBe("healthy");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("inspect returns 'unhealthy' status", async (scope) => {
    // Mock inspectContainer to return unhealthy status
    const mockInfo = createMockContainerInfo("unhealthy");
    (DockerApi.prototype.inspectContainer as any).mockResolvedValue([mockInfo]);

    try {
      const container = await Container("health-test-unhealthy", {
        image: "nginx:latest",
        start: true,
        adopt: true
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBe("unhealthy");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("inspect returns 'starting' status", async (scope) => {
    // Mock inspectContainer to return starting status
    const mockInfo = createMockContainerInfo("starting");
    (DockerApi.prototype.inspectContainer as any).mockResolvedValue([mockInfo]);

    try {
      const container = await Container("health-test-starting", {
        image: "nginx:latest",
        start: true,
        adopt: true
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBe("starting");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("inspect returns undefined health when no healthcheck configured", async (scope) => {
    // Mock inspectContainer to return no health info
    const mockInfo = createMockContainerInfo(undefined);
    (DockerApi.prototype.inspectContainer as any).mockResolvedValue([mockInfo]);

    try {
      const container = await Container("health-test-none", {
        image: "nginx:latest",
        start: true,
        adopt: true
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBeUndefined();
    } finally {
      await alchemy.destroy(scope);
    }
  });
});
