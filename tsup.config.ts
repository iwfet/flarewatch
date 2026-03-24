import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/entry.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom"],
  esbuildOptions(options) {
    options.banner = {
      js: `/* flarewatch v0.1.0 — https://github.com/seu-usuario/flarewatch */`,
    };
  },
});
