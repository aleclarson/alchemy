import { describe, expect, vi, beforeEach } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { Network } from "../../src/docker/network.ts";
import { BRANCH_PREFIX } from "../util.ts";
import { DockerApi } from "../../src/docker/api.ts";

import "../../src/test/vitest.ts";

// Mock DockerApi module, but leave implementation empty/default
vi.mock("../../src/docker/api.ts", async () => {
  const Actual = await vi.importActual("../../src/docker/api.ts");
  return {
    ...Actual,
    DockerApi: vi.fn(),
  };
});

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe.sequential("Network", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should ignore 'network already exists' error and return existing network", async (scope) => {
    try {
      const networkName = "existing-network";
      const existingNetworkId = "existing-network-id";
      const existingNetworkCreated = "2023-01-01T00:00:00Z";

      const mockCreateNetwork = vi.fn();
      const mockInspectNetwork = vi.fn();
      const mockRemoveNetwork = vi.fn();

      // Setup the mock for this specific test
      vi.mocked(DockerApi).mockImplementation(() => ({
        createNetwork: mockCreateNetwork,
        inspectNetwork: mockInspectNetwork,
        removeNetwork: mockRemoveNetwork,
        networkExists: vi.fn(),
        // Add other methods if needed by the resource, but Network mostly uses create/remove
        exec: vi.fn(),
        dockerPath: "docker",
        configDir: undefined,
        isRunning: vi.fn(),
        pullImage: vi.fn(),
        tagImage: vi.fn(),
        buildImage: vi.fn(),
        listImages: vi.fn(),
        createContainer: vi.fn(),
        startContainer: vi.fn(),
        stopContainer: vi.fn(),
        removeContainer: vi.fn(),
        getContainerLogs: vi.fn(),
        inspectContainer: vi.fn(),
        containerExists: vi.fn(),
        connectNetwork: vi.fn(),
        disconnectNetwork: vi.fn(),
        createVolume: vi.fn(),
        removeVolume: vi.fn(),
        inspectVolume: vi.fn(),
        volumeExists: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
      } as any));

      // Mock createNetwork to throw the specific error
      mockCreateNetwork.mockRejectedValue(
        new Error(`network with name ${networkName} already exists`)
      );

      // Mock inspectNetwork to return the existing network details
      mockInspectNetwork.mockResolvedValue([
        {
          Id: existingNetworkId,
          Name: networkName,
          Created: existingNetworkCreated,
          Driver: "bridge",
        },
      ]);

      const network = await Network("test-network", {
        name: networkName,
      });

      expect(network.name).toBe(networkName);
      expect(network.id).toBe(existingNetworkId);

      expect(mockCreateNetwork).toHaveBeenCalledWith(networkName, "bridge");
      expect(mockInspectNetwork).toHaveBeenCalledWith(networkName);
    } finally {
      await alchemy.destroy(scope);
    }
  });

  test("should throw other errors", async (scope) => {
     try {
        const networkName = "error-network";

        const mockCreateNetwork = vi.fn();
        vi.mocked(DockerApi).mockImplementation(() => ({
            createNetwork: mockCreateNetwork,
            removeNetwork: vi.fn(),
             // ... minimal mock
        } as any));

        mockCreateNetwork.mockRejectedValue(new Error("some other error"));

        await expect(Network("test-network-error", {
            name: networkName
        })).rejects.toThrow("some other error");

     } finally {
         await alchemy.destroy(scope);
     }
  });
});
