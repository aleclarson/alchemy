import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { Container } from "../../src/docker/container.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Container dependsOn", () => {
  test("should wait for dependsOn resources", async (scope) => {
    try {
      const delay = 200;
      const start = Date.now();

      // Create a slow dependency promise
      const slowDependency = new Promise((resolve) => {
        setTimeout(() => {
          resolve({ id: "mock-dependency" });
        }, delay);
      });

      // Create a container that depends on the slow dependency
      // We expect this to fail in this environment due to Docker issues,
      // but we care about the timing.
      try {
        await Container("dependent-container", {
          image: "hello-world:latest",
          name: `alchemy-test-dependent-${Date.now()}`,
          start: false,
          dependsOn: slowDependency,
        });
      } catch (e) {
        // Ignore Docker errors, we only care about timing
      }

      const end = Date.now();
      const duration = end - start;

      // The duration should be at least the delay
      expect(duration).toBeGreaterThanOrEqual(delay);
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("should wait for multiple dependsOn resources", async (scope) => {
    try {
      const delay1 = 100;
      const delay2 = 300;
      const start = Date.now();

      const dep1 = new Promise((resolve) => setTimeout(resolve, delay1));
      const dep2 = new Promise((resolve) => setTimeout(resolve, delay2));

      try {
        await Container("multi-dependent-container", {
          image: "hello-world:latest",
          name: `alchemy-test-multi-dependent-${Date.now()}`,
          start: false,
          dependsOn: [dep1, dep2],
        });
      } catch (e) {
        // Ignore Docker errors
      }

      const end = Date.now();
      const duration = end - start;

      // The duration should be at least the longest delay
      expect(duration).toBeGreaterThanOrEqual(Math.max(delay1, delay2));
    } finally {
      await alchemy.destroy(scope);
    }
  });
});
