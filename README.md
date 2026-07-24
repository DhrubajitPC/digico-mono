# Digico — Conversational WhatsApp Ordering

A conversational AI ordering tool for [Digico](https://www.digico.com.bd/), a technology products distributor in Bangladesh. Dealers order over **WhatsApp** in Bengali, English, or Banglish. The AI interprets the conversation; the backend holds the business truth; a human approves every order before it is confirmed.

## What it does

Dealers message Digico's WhatsApp number the same way they'd message a sales rep — describing what they want in their own words ("HP i5 laptop, 10 ta lagbe"). The system:

1. **Understands** the dealer's intent (discovery, price inquiry, order, status check)
2. **Resolves** the right product from 600+ SKUs using curated aliases and semantic search
3. **Answers** with verified backend data — never hallucinated prices or stock
4. **Creates draft orders** for human review before any commitment
5. **Gives ops staff** a lean admin dashboard to approve, edit, or reject drafts

This is an **internal tool for the existing business**, built for ~200–500 active dealers handling ~$1M/year in transactions.

## Project Structure

```
digico/
├── apps/
│   ├── website/             # Admin dashboard (Vite + Tailwind)
│   └── whatsapp-webhook/    # WhatsApp Cloud API webhook + LLM replies
├── packages/
│   └── utils/               # Shared TypeScript utilities
├── design-system/           # Design tokens extracted from digico.com.bd
├── docs/
│   ├── prd/prd.md           # Product requirements (v1.0 MVP)
│   └── user-journey/        # Dealer / ops journey maps
├── package.json             # Workspace root scripts
├── pnpm-workspace.yaml      # Workspace package globs + dependency catalog
└── vite.config.ts           # Root Vite+ configuration
```

## Tech Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Monorepo | Vite+ (`vp`) + pnpm workspaces                   |
| Frontend | Vite, TypeScript, Tailwind CSS                   |
| Backend  | Node.js + TypeScript, PostgreSQL (planned)       |
| Channel  | WhatsApp Business Cloud API (text + voice notes) |
| AI       | DeepSeek chat; OpenAI Whisper for voice STT      |

## Using the monorepo with Vite+ (`vp`)

This repo uses **[Vite+](https://viteplus.dev/guide/)** as the single CLI for install, scripts, check, test, and build. Prefer `vp` over calling `pnpm` / `vite` / `vitest` directly.

**Prerequisites:** Node.js ≥ 22.18.0, and the global `vp` CLI installed.

```bash
# Install or upgrade the Vite+ CLI (once per machine)
curl -fsSL https://vite.plus | bash
# or: npm install -g vite-plus
```

### Install dependencies

Always run from the **repo root** after clone or pull:

```bash
vp install
```

Add a dependency to a specific workspace package:

```bash
vp add lodash --filter whatsapp-webhook
vp add -D @types/node --filter whatsapp-webhook
```

### Common commands

| Goal                         | Command                           |
| ---------------------------- | --------------------------------- |
| Format + lint + typecheck    | `vp check`                        |
| Auto-fix format issues       | `vp check --fix`                  |
| Run all workspace tests      | `vp test` / `vp run -r test`      |
| Build all packages           | `vp run -r build`                 |
| Full gate (check/test/build) | `vp run ready`                    |
| List runnable tasks          | `vp run`                          |
| Help for any command         | `vp help` / `vp <command> --help` |

### Run a package script

Vite+ uses `packageName#scriptName`:

```bash
# Admin website
vp run website#dev
vp run website#build

# WhatsApp webhook (needs apps/whatsapp-webhook/.env — see that app's README)
vp run whatsapp-webhook#dev
vp run whatsapp-webhook#test

# Shared utils package
vp run utils#test
vp run utils#build
```

Root shortcuts (same as above for the common apps):

```bash
vp run dev        # → website#dev
vp run whatsapp   # → whatsapp-webhook#dev
```

Filter by package directory or name when needed:

```bash
vp run test --filter whatsapp-webhook
vp run check --filter ./apps/whatsapp-webhook
vp run -r test --filter './apps/*'
```

### Workspace layout tips

- **`apps/*`** — deployable apps (website, webhook, …)
- **`packages/*`** — shared libraries consumed by apps
- **`tools/*`** — optional internal tooling packages
- Shared version pins live in `pnpm-workspace.yaml` under `catalog:` — prefer `"catalog:"` in package `dependencies` / `devDependencies`

### WhatsApp webhook (local)

```bash
cp apps/whatsapp-webhook/.env.example apps/whatsapp-webhook/.env
# fill WHATSAPP_*, DEEPSEEK_API_KEY, OPENAI_API_KEY

vp run whatsapp          # or: vp run whatsapp-webhook#dev
ngrok http 8787          # separate terminal — public HTTPS for Meta webhooks
```

Details: [apps/whatsapp-webhook/README.md](apps/whatsapp-webhook/README.md).

### Troubleshooting

```bash
vp env doctor            # Node / toolchain diagnosis
vp cache                 # Inspect task cache
```

More Vite+ docs: local `node_modules/vite-plus/docs` or https://viteplus.dev/guide/.

## MVP Scope (Phase 1)

- WhatsApp ordering (Bengali, English, Banglish) — text + voice notes (Whisper STT)
- **Product discovery**, price/stock inquiry, order creation, order status
- **Human-in-the-loop**: every draft order reviewed before confirmation
- **Lean admin**: draft review queue + CSV import for catalog, prices, inventory, dealers
- **Single price list** for all dealers

See [docs/prd/prd.md](docs/prd/prd.md) for the full product requirements, phased roadmap (Phases 1–3), success metrics, risks, and open questions.

## License

Proprietary — internal tool for Digico's technology distribution business.
