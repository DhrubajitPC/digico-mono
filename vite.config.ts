import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    plugins: ["import", "typescript"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // No explicit `any` — type boundaries must be named, not erased
      "no-explicit-any": "error",
      // Destructured (named) imports over full-module imports — helps tree shaking
      "import/no-namespace": "error",
      // Import from package barrels (index) only, never internal paths
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@digico/*/src/**", "../packages/*/src/**"],
              message: "Import from the package barrel (@digico/*) instead of internal paths.",
            },
          ],
        },
      ],
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
