import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDoppler, getDopplerToken } from "../../src/doppler/client.ts";

describe("Doppler Client", () => {
  beforeEach(() => {
    vi.stubEnv("DOPPLER_TOKEN", "test-token");
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("getDopplerToken should return token from env", () => {
    expect(getDopplerToken()).toBe("test-token");
  });

  it("getDopplerToken should throw if no token", () => {
    vi.stubEnv("DOPPLER_TOKEN", "");
    expect(() => getDopplerToken()).toThrow();
  });

  it("fetchDoppler should make correct request", async () => {
    const mockResponse = { success: true };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    });

    const result = await fetchDoppler("/test");
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.doppler.com/v3/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("fetchDoppler should handle errors", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ message: "Something went wrong" }),
      text: async () => JSON.stringify({ message: "Something went wrong" }),
    });

    await expect(fetchDoppler("/test")).rejects.toThrow(
      "Doppler API Error (400): Something went wrong",
    );
  });
});
