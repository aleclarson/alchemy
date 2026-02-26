import { defineConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

const externalRegex = /\b(node:|bun:|node_modules|private)\b/;

export default [
  defineConfig({
    entry: ["bin/alchemy.ts"],
    format: ["esm"],
    clean: false,
    shims: true,
    outDir: "bin",
    outputOptions: {
      banner: "#!/usr/bin/env node",
    },
    external(id) {
      return externalRegex.test(id);
    },
  }),
  defineConfig({
    entry: "workers/**/*.ts",
    format: ["esm"],
    clean: false,
    outDir: "workers",
    nodeProtocol: true,
    external: [/cloudflare:(.*)/],
    noExternal: () => true, // bundle all dependencies for workers
    loader: { ".sql": "text" },
    define: {
      ALCHEMY_VERSION: JSON.stringify(pkg.version),
    },
  }),
];
