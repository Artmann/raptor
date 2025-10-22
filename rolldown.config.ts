import { defineConfig } from "rolldown";

export default defineConfig({
  input: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  output: [
    {
      dir: "dist",
      format: "esm",
      entryFileNames: "[name].mjs",
    },
    {
      dir: "dist",
      format: "cjs",
      entryFileNames: "[name].js",
    },
  ],
  external: ["node:fs/promises", "node:path", "node:fs", "cleye"],
});
