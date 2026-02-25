import fs from "node:fs";
import path from "pathe";
import { Context } from "./context.ts";
import { Resource } from "./resource.ts";
import { Secret } from "./secret.ts";
import { ignore } from "./util/ignore.ts";
import { logger } from "./util/logger.ts";

export interface EnvFile {
  path: string;
  env: Record<string, string | number | boolean | Secret<string>>;
}

export const EnvFile = Resource(
  "env-file",
  async function (
    this: Context<EnvFile>,
    id: string,
    props: {
      path?: string;
      env: Record<string, string | number | boolean | Secret<string> | undefined | null>;
    }
  ): Promise<EnvFile> {
    const filePath = props.path ?? ".env";

    if (this.phase === "delete") {
      await ignore("ENOENT", async () => fs.promises.unlink(filePath));
      return this.destroy();
    }

    if (
      this.phase === "update" &&
      this.output &&
      this.output.path !== filePath
    ) {
      // If path has changed, delete the old file
      logger.log(
        `EnvFile: Path changed from ${this.output.path} to ${filePath}, removing old file`,
      );
      await ignore("ENOENT", async () => fs.promises.unlink(this.output.path));
    }

    const content = Object.entries(props.env)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        let val = Secret.unwrap(value);
        if (val === undefined || val === null) return null; // Redundant check for safety

        let stringVal = String(val);

        // Quote if necessary
        if (
          stringVal.includes(" ") ||
          stringVal.includes("#") ||
          stringVal.includes("\n") ||
          stringVal.includes("'") ||
          stringVal.includes('"')
        ) {
          // Wrap in double quotes and escape double quotes
          stringVal = `"${stringVal.replace(/"/g, '\\"')}"`;
        }

        return `${key}=${stringVal}`;
      })
      .filter((line) => line !== null)
      .join("\n");

    // Create directory and write file
    const dirName = path.dirname(filePath);
    if (dirName !== ".") {
      await fs.promises.mkdir(dirName, {
        recursive: true,
      });
    }

    await fs.promises.writeFile(filePath, content);

    // Filter out undefined values from props.env to match the EnvFile interface
    const filteredEnv = Object.fromEntries(
      Object.entries(props.env).filter(
        ([_, value]) => value !== undefined && value !== null
      )
    ) as Record<string, string | number | boolean | Secret<string>>;

    return {
      path: filePath,
      env: filteredEnv,
    };
  }
);
