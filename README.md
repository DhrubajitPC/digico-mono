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
│   └── website/          # Admin dashboard (Vite + Tailwind)
├── packages/
│   └── utils/            # Shared TypeScript utilities
├── design-system/        # Design tokens extracted from digico.com.bd
├── docs/
│   └── prd/prd.md        # Product requirements document (v1.0 MVP)
└── vite.config.ts        # Root Vite+ configuration
```

## Tech Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Monorepo | Vite+ (pnpm workspaces)                           |
| Frontend | Vite, TypeScript, Tailwind CSS                    |
| Backend  | Node.js + TypeScript (Fastify), PostgreSQL        |
| Channel  | WhatsApp Business Cloud API (text only)           |
| AI       | Provider-agnostic orchestration with tool calling |

## Getting Started

**Prerequisites:** Node.js ≥ 22.18.0, pnpm 11.14.0

```bash
# Install dependencies
vp install

# Run checks (format, lint, typecheck) and tests
vp check && vp test

# Start the admin dashboard dev server
vp run dev

# Build everything
vp run -r build

# Run the full ready pipeline
vp run ready
```

## MVP Scope (Phase 1)

- **Text-only** WhatsApp ordering (Bengali, English, Banglish)
- **Product discovery**, price/stock inquiry, order creation, order status
- **Human-in-the-loop**: every draft order reviewed before confirmation
- **Lean admin**: draft review queue + CSV import for catalog, prices, inventory, dealers
- **Single price list** for all dealers

See [docs/prd/prd.md](docs/prd/prd.md) for the full product requirements, phased roadmap (Phases 1–3), success metrics, risks, and open questions.

## License

Proprietary — internal tool for Digico's technology distribution business.
