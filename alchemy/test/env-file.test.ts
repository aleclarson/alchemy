import fs from "node:fs";
import path from "pathe";
import { describe, expect } from "vitest";
import { alchemy } from "../src/alchemy.ts";
import { destroy } from "../src/destroy.ts";
import { EnvFile } from "../src/env-file.ts";
import "../src/test/vitest.ts";

const BRANCH_PREFIX = "test-env-file";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("EnvFile Resource", () => {
  const testId = `${BRANCH_PREFIX}-resource`;

  test("create, update, and delete env file resource", async (scope) => {
    const filePath = path.join(process.cwd(), `test-env-${testId}.env`);

    try {
      // Create EnvFile
      let resource = await EnvFile(testId, {
        path: filePath,
        env: {
          foo: "bar",
          baz: 123,
          isTrue: true,
          secretVal: alchemy.secret("my-secret"),
          quoted: "value with spaces",
          special: "value#with#hash",
          ignored: undefined,
        },
      });

      // Verify resource properties
      expect(resource.path).toBe(filePath);
      expect(resource.env.foo).toBe("bar");
      expect(resource.env.ignored).toBeUndefined();

      // Verify file content
      let content = await fs.promises.readFile(filePath, "utf-8");
      expect(content).toContain("foo=bar");
      expect(content).toContain("baz=123");
      expect(content).toContain("isTrue=true");
      expect(content).toContain("secretVal=my-secret");
      expect(content).toContain('quoted="value with spaces"');
      expect(content).toContain('special="value#with#hash"');
      expect(content).not.toContain("ignored");

      // Update resource (change content)
      resource = await EnvFile(testId, {
        path: filePath,
        env: {
          foo: "bar2",
        },
      });

      // Verify update
      content = await fs.promises.readFile(filePath, "utf-8");
      expect(content.trim()).toBe("foo=bar2");

      // Update resource (change path)
      const newFilePath = path.join(process.cwd(), `test-env-${testId}-new.env`);
      resource = await EnvFile(testId, {
        path: newFilePath,
        env: {
          foo: "bar2",
        },
      });

      // Verify old file deleted
      const oldFileExists = await fs.promises
        .access(filePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      expect(oldFileExists).toBe(false);

      // Verify new file created
      const newFileExists = await fs.promises
        .access(newFilePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      expect(newFileExists).toBe(true);

      // Clean up new file manually if needed, but destroy(scope) should handle it if resource deletion logic works.
      // However, destroy(scope) runs resource deletion logic which we are testing.

    } finally {
      await destroy(scope);
      // Clean up files in case destroy failed
      try {
        await fs.promises.unlink(filePath);
      } catch {}
      try {
        const newFilePath = path.join(process.cwd(), `test-env-${testId}-new.env`);
        await fs.promises.unlink(newFilePath);
      } catch {}
    }
  });
});
