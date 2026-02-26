import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { Container } from "../../src/docker/container.ts";
import { DockerApi, type ContainerInfo } from "../../src/docker/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

// Helper to create a mock ContainerInfo
function createMockContainerInfo(id: string, healthStatus?: "none" | "starting" | "healthy" | "unhealthy"): ContainerInfo {
  const info: any = {
    Id: id,
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
  let execSpy: any;

  beforeEach(() => {
    // Spy on the real DockerApi.prototype.exec method
    // This allows us to intercept CLI calls without mocking the entire module
    execSpy = vi.spyOn(DockerApi.prototype, "exec");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("inspect returns 'healthy' status", async (scope) => {
    const containerName = "health-test-healthy";
    const containerId = "test-id-healthy";
    let created = false;

    execSpy.mockImplementation(async (args: string[]) => {
      // Mock 'container inspect'
      if (args[0] === "container" && args[1] === "inspect") {
        const target = args[2];
        if (target === containerName) {
            if (!created) {
                // Simulate "does not exist" before creation by throwing error
                throw new Error("No such container");
            } else {
                // Return healthy status after creation
                return { stdout: JSON.stringify([createMockContainerInfo(containerId, "healthy")]), stderr: "" };
            }
        }
      }

      // Mock 'create'
      if (args[0] === "create") {
        created = true;
        return { stdout: containerId, stderr: "" };
      }

      // Mock 'start'
      if (args[0] === "start") {
        return { stdout: containerId, stderr: "" };
      }

      // Default behavior for other calls or unmatched args
      // We must throw for unmatched inspect calls to simulate "not found"
      if (args[0] === "container" && args[1] === "inspect") {
          throw new Error(`No such container: ${args[2]}`);
      }

      return { stdout: "", stderr: "" };
    });

    try {
      const container = await Container(containerName, {
        name: containerName, // Explicitly set name to match mock expectation
        image: "nginx:latest",
        start: true,
        adopt: false
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBe("healthy");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("inspect returns 'unhealthy' status", async (scope) => {
    const containerName = "health-test-unhealthy";
    const containerId = "test-id-unhealthy";
    let created = false;

    execSpy.mockImplementation(async (args: string[]) => {
      if (args[0] === "container" && args[1] === "inspect") {
        const target = args[2];
        if (target === containerName) {
            if (!created) throw new Error("No such container");
            return { stdout: JSON.stringify([createMockContainerInfo(containerId, "unhealthy")]), stderr: "" };
        }
      }
      if (args[0] === "create") {
        created = true;
        return { stdout: containerId, stderr: "" };
      }
      if (args[0] === "start") return { stdout: containerId, stderr: "" };

      if (args[0] === "container" && args[1] === "inspect") {
          throw new Error(`No such container: ${args[2]}`);
      }
      return { stdout: "", stderr: "" };
    });

    try {
      const container = await Container(containerName, {
        name: containerName,
        image: "nginx:latest",
        start: true,
        adopt: false
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBe("unhealthy");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("inspect returns 'starting' status", async (scope) => {
    const containerName = "health-test-starting";
    const containerId = "test-id-starting";
    let created = false;

    execSpy.mockImplementation(async (args: string[]) => {
      if (args[0] === "container" && args[1] === "inspect") {
        const target = args[2];
        if (target === containerName) {
            if (!created) throw new Error("No such container");
            return { stdout: JSON.stringify([createMockContainerInfo(containerId, "starting")]), stderr: "" };
        }
      }
      if (args[0] === "create") {
        created = true;
        return { stdout: containerId, stderr: "" };
      }
      if (args[0] === "start") return { stdout: containerId, stderr: "" };

      if (args[0] === "container" && args[1] === "inspect") {
          throw new Error(`No such container: ${args[2]}`);
      }
      return { stdout: "", stderr: "" };
    });

    try {
      const container = await Container(containerName, {
        name: containerName,
        image: "nginx:latest",
        start: true,
        adopt: false
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBe("starting");
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("inspect returns undefined health when no healthcheck configured", async (scope) => {
    const containerName = "health-test-none";
    const containerId = "test-id-none";
    let created = false;

    execSpy.mockImplementation(async (args: string[]) => {
      if (args[0] === "container" && args[1] === "inspect") {
        const target = args[2];
        if (target === containerName) {
            if (!created) throw new Error("No such container");
            return { stdout: JSON.stringify([createMockContainerInfo(containerId, undefined)]), stderr: "" };
        }
      }
      if (args[0] === "create") {
        created = true;
        return { stdout: containerId, stderr: "" };
      }
      if (args[0] === "start") return { stdout: containerId, stderr: "" };

      if (args[0] === "container" && args[1] === "inspect") {
          throw new Error(`No such container: ${args[2]}`);
      }
      return { stdout: "", stderr: "" };
    });

    try {
      const container = await Container(containerName, {
        name: containerName,
        image: "nginx:latest",
        start: true,
        adopt: false
      });

      const runtimeInfo = await container.inspect();
      expect(runtimeInfo.health).toBeUndefined();
    } finally {
      await alchemy.destroy(scope);
    }
  });
});
