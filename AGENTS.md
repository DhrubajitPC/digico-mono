<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Coding Rules (enforced by lint)

- **No explicit `any`** — type boundaries must be named, not erased. Use `unknown` + narrowing or a structural interface (lint: `no-explicit-any`).
- **Destructured imports over full-module imports** — use named imports (`import { useState } from "react"`), never `import * as React from "react"` (lint: `import/no-namespace`). Type-only members go in the same statement as `type X`.
- **Barrel imports only** — import from package roots (`@digico/contracts`, `@digico/db`), never internal paths like `@digico/db/src/...` (lint: `no-restricted-imports`).
