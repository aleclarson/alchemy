import type { Context } from "../context.ts";
import { Resource } from "../resource.ts";
import { fetchDoppler } from "./client.ts";

export interface DopplerProjectProps {
  name: string;
}

export interface DopplerProjectOutput {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  description: string;
}

export const DopplerProject = Resource(
  "doppler::Project",
  async function (
    this: Context<DopplerProjectOutput>,
    _id: string,
    props: DopplerProjectProps,
  ): Promise<DopplerProjectOutput> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    const { project } = await fetchDoppler<{ project: any }>(
      `/projects/${encodeURIComponent(props.name)}`,
    );

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      created_at: project.created_at,
      description: project.description,
    };
  },
);
