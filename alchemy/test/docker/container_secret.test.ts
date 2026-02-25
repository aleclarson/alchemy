import { describe, expect, vi, beforeEach } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { Container } from "../../src/docker/container.ts";
import { secret } from "../../src/secret.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

// Mock DockerApi
const createContainerMock = vi.fn().mockResolvedValue("mock-container-id");
const containerExistsMock = vi.fn().mockResolvedValue(false);
const startContainerMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/docker/api.ts", () => {
  return {
    DockerApi: vi.fn().mockImplementation(() => {
      return {
        createContainer: createContainerMock,
        containerExists: containerExistsMock,
        startContainer: startContainerMock,
        inspectContainer: vi.fn().mockResolvedValue([]),
        removeContainer: vi.fn().mockResolvedValue(undefined),
        stopContainer: vi.fn().mockResolvedValue(undefined),
      };
    }),
    normalizeDuration: (d: any) => d.toString(),
  };
});

describe("Container with Secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createContainerMock.mockResolvedValue("mock-container-id");
    containerExistsMock.mockResolvedValue(false);
  });

  test("should unwrap secrets in environment variables", async (scope) => {
    try {
      const secretValue = "super-secret-value";
      const env = {
        API_KEY: secret(secretValue),
        PUBLIC_VAR: "public-value",
      };

      await Container("secret-container", {
        image: "nginx:latest",
        name: "secret-test-container",
        environment: env,
        start: false,
      });

      expect(createContainerMock).toHaveBeenCalledWith(
        "nginx:latest",
        "secret-test-container",
        expect.objectContaining({
          env: {
            API_KEY: secretValue,
            PUBLIC_VAR: "public-value",
          },
        })
      );
    } finally {
        await alchemy.destroy(scope);
    }
  });
});
