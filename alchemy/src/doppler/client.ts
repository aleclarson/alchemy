import { withExponentialBackoff } from "../util/retry.ts";

export interface DopplerClientOptions {
  token?: string;
}

export const DOPPLER_API_BASE = "https://api.doppler.com/v3";

export function getDopplerToken(token?: string): string {
  const resolvedToken = token || process.env.DOPPLER_TOKEN;
  if (!resolvedToken) {
    throw new Error(
      "Doppler token is required. Please set DOPPLER_TOKEN environment variable or pass it explicitly.",
    );
  }
  return resolvedToken;
}

export async function fetchDoppler<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const token = getDopplerToken(init?.token);
  const url = `${DOPPLER_API_BASE}${path.startsWith("/") ? path : "/" + path}`;

  return withExponentialBackoff(
    async () => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");
      headers.set("Accept", "application/json");

      const response = await fetch(url, {
        ...init,
        headers,
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const data = (await response.json()) as any;
          if (data.messages) {
            errorMessage = data.messages.join(", ");
          } else if (data.message) {
            errorMessage = data.message;
          }
        } catch {
          // ignore
        }
        const error: any = new Error(
          `Doppler API Error (${response.status}): ${errorMessage}`,
        );
        error.status = response.status;
        throw error;
      }

      // Check for 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      try {
        return (await response.json()) as T;
      } catch {
        return {} as T;
      }
    },
    (error: any) => {
      // Retry on network errors (no status)
      if (!error.status) {
        return true;
      }
      // Retry on 429 (Rate Limit) and 5xx (Server Error)
      return (
        error.status === 429 || (error.status >= 500 && error.status < 600)
      );
    },
  );
}
