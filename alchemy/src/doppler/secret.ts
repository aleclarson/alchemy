import type { Context } from "../context.ts";
import { Resource } from "../resource.ts";
import { secret, type Secret } from "../secret.ts";
import { fetchDoppler } from "./client.ts";

export interface DopplerSecretProps {
  project: string;
  config: string;
  name: string;
}

export interface DopplerSecretOutput {
  name: string;
  value: Secret<string>;
  computed: string;
  note?: string;
}

export const DopplerSecret = Resource(
  "doppler::Secret",
  async function (
    this: Context<DopplerSecretOutput>,
    _id: string,
    props: DopplerSecretProps,
  ): Promise<DopplerSecretOutput> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    const { name, value } = await fetchDoppler<{
      name: string;
      value: { raw: string; computed: string; note?: string };
    }>(
      `/configs/config/secret?project=${encodeURIComponent(
        props.project,
      )}&config=${encodeURIComponent(props.config)}&name=${encodeURIComponent(
        props.name,
      )}`,
    );

    return {
      name,
      value: secret(value.computed),
      computed: value.computed,
      note: value.note,
    };
  },
);
