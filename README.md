# Digico — Conversational AI B2B Ordering Monorepo

An AI-powered B2B ordering and distribution system for [Digico](https://www.digico.com.bd/), a technology products and home appliances distributor in Bangladesh (65+ brands including **Conion**, **Samsung**, **Baseus**, **Whirlpool**, **Hitachi**, **Philips**, **Panasonic**, **UGREEN**, and **LG**).

Dealers place wholesale orders over **WhatsApp** in **Bengali**, **English**, or **Banglish** ("Conion fridge, 10 ta lagbe"). The AI assistant — branded **Joy AI**, powered by **DeepSeek** — interprets dealer intent, retrieves live MariaDB catalog candidates, and auto-drafts confirmed sales orders into WooCommerce tables for human admin review.

---

## 🏗️ Monorepo Architecture

The repository is structured as a **clean 3-layer architecture** using **Vite+** and **pnpm workspaces**, with a **tRPC** end-to-end typed API layer and **shared contracts** between the frontend, backend, and data layers:

```text
digico-mono/
├── apps/
│   ├── website/                 # Layer 1: React 19 admin dashboard — Orders, Emulator, Message Logs
│   │   └── src/
│   │       ├── components/
│   │       │   ├── OrdersDashboard.tsx      # Sales Admin Order Dashboard (orders list, status filters)
│   │       │   ├── OrderReviewDrawer.tsx    # AI order review: WhatsApp transcript + AI intent extraction
│   │       │   ├── CreateOrderModal.tsx     # Manual sales order creation
│   │       │   ├── MessageLogView.tsx       # WhatsApp message log auditor
│   │       │   ├── WhatsAppEmulator.tsx     # Interactive WhatsApp emulator
│   │       │   └── dashboard/, order-review/, emulator/, shared/   # feature components
│   │       ├── hooks/          # useOrders, useOrderReview
│   │       └── trpc.ts         # tRPC client (@tanstack/react-query wiring, httpBatchLink /trpc)
│   └── whatsapp-webhook/        # Layer 2: Fastify server — Meta webhook ingress, emulator, tRPC mount
│       └── src/
│           ├── routes/
│           │   ├── webhook.ts  # Meta Cloud API verification & ingress (GET/POST /webhook)
│           │   └── emulator.ts # WhatsApp Emulator endpoints (/api/emulator/*)
│           ├── services/       # AI & External Integration Services
│           │   ├── deepseek.ts        # Joy AI / DeepSeek system prompt & completions
│           │   ├── intent-router.ts   # Zero-cost 10ms rule-based intent interceptor
│           │   ├── order-tools.ts     # draft_order tool with catalog price/stock guardrails
│           │   ├── parse-webhook.ts   # Meta Cloud API payload parser
│           │   ├── handle-message.ts  # Multi-turn pipeline orchestrator
│           │   ├── transcribe.ts      # ElevenLabs Scribe voice note transcription
│           │   ├── whatsapp-media.ts  # WhatsApp CDN media downloader
│           │   └── whatsapp-send.ts   # WhatsApp Cloud API message sender
│           └── server.ts       # Fastify bootstrap: /health, /webhook, /api/emulator, /trpc
├── packages/
│   ├── api/                     # Layer 3: @digico/api — tRPC appRouter (orders, products, dealers, messages, health)
│   │   └── src/routers/         # zod schemas + typed procedures consumed by the frontend
│   ├── contracts/               # @digico/contracts — canonical domain types (Order, Dealer, Product, LogMessage…)
│   ├── db/                      # @digico/db — MariaDB (WooCommerce) queries, logs, seed
│   │   └── src/                 # client, orders, products, dealers, logs, seed, errors
│   ├── ui/                      # @digico/design-system — React primitives (Button, Table, Dialog, Drawer, StatusBadge…)
│   └── utils/                   # @digico/utils — shared utilities
├── design-system/               # Brand-token extraction from digico.com.bd (tokens.json/.css; raw, unreviewed evidence)
├── data/                        # Docker MariaDB init scripts (mariadb-init)
├── export.sql                   # 919 MB WooCommerce database seed dump
├── docker-compose.yml           # Container stack (MariaDB, Backend, Frontend)
├── Makefile                     # Unified project task runner (Single Source of Truth CLI)
├── deploy.sh                    # Production deployment script
└── .env                         # Unified environment configuration at project root
```

---

## 🛠️ Technology Stack

| Layer              | Technology                                                      | Purpose                                                                                   |
| :----------------- | :-------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| **Monorepo**       | **Vite+** (`vp`) over **pnpm 11**                               | Single CLI for tasks, workspaces, formatting, and linting; pnpm is the install engine     |
| **Frontend**       | **React 19**, **TypeScript**, **Tailwind CSS**                  | B2B Orders Dashboard, WhatsApp Emulator, & Message Log Auditor                            |
| **Data fetching**  | **tRPC** + **@tanstack/react-query**, **@tanstack/react-table** | End-to-end typed API client, server-state caching, table primitives                       |
| **API layer**      | **tRPC v11** (`@trpc/server`) on **Fastify**                    | Typed procedures for orders/products/dealers/messages/health                              |
| **Backend REST**   | **Node.js ≥ 22**, **Fastify**, **TypeScript**                   | Meta WhatsApp Cloud API webhook, emulator ingress & `/health`                             |
| **Database**       | **MariaDB 11.8** (`mysql2`)                                     | WooCommerce schema (`joy_posts`, `joy_postmeta`) + WhatsApp message & AI call logs        |
| **AI / LLM**       | **DeepSeek** (`deepseek-chat`)                                  | Conversational AI agent (branded **Joy AI**) with native function calling (`draft_order`) |
| **Speech-to-Text** | **ElevenLabs Scribe** (`scribe_v2`)                             | Voice note transcription for incoming WhatsApp audio messages (Optional)                  |
| **Design System**  | **@digico/design-system** (`packages/ui`) + Radix UI            | Shared UI primitives & the "Verification Desk" admin design language                      |

---

## 🔑 Environment Variables Reference

Secrets and configuration are maintained in a **single root `.env` file** at project root (mirrored by [`.env.example`](.env.example)):

```ini
# --- Server ---
PORT=8787
NODE_ENV=production

# --- AI Models ---
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here  # Optional: voice-note transcription only
# ELEVENLABS_STT_MODEL=scribe_v2                   # Optional override
# ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1 # Optional override
# Leave ELEVENLABS_STT_LANGUAGE unset — Scribe auto-detects & preserves code-switching.

# --- Meta WhatsApp Cloud API ---
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id_here
WHATSAPP_VERIFY_TOKEN=digico_secret_verify_token_12345

# --- Database (local host; Docker auto-routes to mariadb:3306) ---
MARIADB_URL=mysql://wp:wp@127.0.0.1:3307/woocommerce_local
# Optional Postgres / PGlite URL (defaults to local file-backed PGlite)
# DATABASE_URL=postgres://user:password@localhost:5432/digico
```

> MariaDB container credentials (`MARIADB_ROOT_PASSWORD`, `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD`) default to `root` / `woocommerce_local` / `wp` / `wp` in [`docker-compose.yml`](docker-compose.yml) and do not need to be set in `.env`.

---

## 💻 Step-by-Step Local Setup Guide

### Step 1: Prerequisites

- **Node.js**: `≥ 22.18.0` (check via `node -v`)
- **Docker Desktop**: Docker engine running locally (required to spin up MariaDB)
- **Vite+**: installed via `npm i -g vite-plus`. pnpm needs no separate install — `vp` downloads the version pinned in `devEngines.packageManager` (11.14.0) on first use.

### Step 2: Clone Repository & Install Dependencies

```bash
git clone git@github.com:DhrubajitPC/digico-mono.git
cd digico-mono

# Install dependencies across all workspace packages
vp install
```

### Step 3: Configure Local Environment Variables (.env)

```bash
# Copy the environment configuration template
cp .env.example .env
```

Open `.env` and insert your **DeepSeek API Key**:

```ini
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

_(Default ports — MariaDB on `3307` and Fastify API on `8787` — are pre-configured.)_

### Step 4: Boot MariaDB Container & Seed Database

```bash
# 4a. Start local MariaDB Docker container
make mariadb-up

# 4b. Populate MariaDB with the 919 MB WooCommerce export.sql dump
make seed
```

> [!TIP]
> `make seed` streams the full WooCommerce database dump (`export.sql`) into MariaDB. Streaming takes ~20–30 seconds.

### Step 5: Start Development Servers

```bash
# Run both Fastify API (:8787) and React Frontend (:5173) concurrently in watch mode
make dev
```

### Step 6: Verify Local Installation

1. **B2B Admin Dashboard**: open `http://localhost:5173` — you'll see live WooCommerce orders and products populated from MariaDB.
2. **Interactive WhatsApp Emulator**:
   - Click the **WhatsApp Emulator** tab.
   - Select a dealer phone number (e.g. `Souhardo Ahmed (+8801711000001)`).
   - Type a test query like `"I want to order 2x Conion Toaster CT 801 for my store"` and click **Send**.
   - Watch **Joy AI** generate real-time completions, verify live catalog prices/stock, and draft orders in MariaDB.
3. **Backend Health Check**: `curl http://localhost:8787/health` (returns `ok`).

---

## 🚀 Development Commands

All developer and operational workflows are driven via the **[`Makefile`](Makefile)**:

```bash
make dev             # Run Fastify API (:8787) and React Frontend (:5173) in watch mode
make backend         # Run Fastify API backend server on :8787
make frontend        # Run Vite React frontend server on :5173
make mariadb-up      # Start local MariaDB Docker container on :3307
make mariadb-logs    # Stream live MariaDB container logs
make seed            # Seed MariaDB with export.sql dump
make check           # Format, lint, and typecheck across all workspaces
make check-fix       # Auto-fix formatting and linting errors
make build           # Build production frontend web bundle
make test-e2e        # Run the Playwright E2E visual test suite
make test-entrypoint # Run the CI deploy entrypoint's bash test suite
make deploy          # Execute the production deployment script
make docker-up       # Build & launch all containers (MariaDB, Backend, Frontend)
make docker-down     # Stop all running containers
make docker-logs     # Stream live logs from all Docker containers
make docker-ps       # List running container status
```

The root `package.json` also exposes `vp` shortcuts: `vp run dev` (website), `vp run whatsapp` (whatsapp-webhook), and `vp run ready` (check + test + build across workspaces).

---

## 🤖 AI Agent Pipeline & Features

1. **Zero-Cost Intent Router (`intent-router.ts`)**:
   - Intercepts deterministic commands (e.g. `status #ORD-123` or `cancel #ORD-123`) in **10ms** with 0 LLM token cost.

2. **Banglish RAG Catalog Search (`packages/db/src/products.ts`)**:
   - Filters Banglish stop-words (`er`, `ki`, `ponno`, `ache`, `koto`, `dam`, `dami`, `dorkar`, `lagbe`, `khujchi`, etc.) to isolate product keywords.
   - Retrieves candidate products from MariaDB to build a compressed, high-context prompt for the model.

3. **Multi-Turn Conversation Memory**:
   - Fetches prior chat history per dealer phone from `joy_whatsapp_messages` and `joy_whatsapp_outbound_replies` to maintain context across messages.

4. **Function Calling & Server Guardrails (`order-tools.ts`)**:
   - When an order is negotiated, the model executes the `draft_order` function tool.
   - Server-side guardrails verify requested prices and stock against MariaDB live inventory before inserting rows into `joy_posts` and `joy_postmeta`.

5. **Guaranteed Dealer Reply**:
   - If the model returns a pure `draft_order` tool call with empty text, the pipeline sends a confirmation for the recorded order (or a neutral follow-up) so a dealer never sees a blank "No response generated." message.

6. **End-to-End Typed API (tRPC)**:
   - The frontend, backend, and data layer share canonical schemas from **@digico/contracts**; the **@digico/api** tRPC router at `/trpc` gives the React client fully typed queries and mutations.

---

## ⚠️ Caveats & Known Limitations

> [!WARNING]
> **ElevenLabs Scribe Voice Note Feature (Optional)**:
> Audio voice note transcription via ElevenLabs Scribe (`scribe_v2`) is **disabled by default** unless `ELEVENLABS_API_KEY` is explicitly set in `.env`.
>
> - **Text-based ordering** (in Bengali, English, and Banglish) uses DeepSeek (`DEEPSEEK_API_KEY`) and is **100% operational** out-of-the-box.
> - If an incoming WhatsApp voice note is received while `ELEVENLABS_API_KEY` is omitted, the pipeline catches the missing key gracefully and sends a polite fallback reply asking the dealer to type their message instead.
> - Requires a **paid ElevenLabs plan**. The free tier grants no commercial licence and covers only ~30 minutes of audio per month; Scribe v2 bills ~$0.22/hour (~$0.26 with keyterms).
> - Deploying it requires `ELEVENLABS_API_KEY` in the repository secrets. The deploy workflow emits it only when non-empty, so an unset secret cannot affect unrelated deploys.
> - `digico-ci-entrypoint` (tracked at `digico-ci-entrypoint` in this repo) validates every deploy payload key against `.env.example`. A new variable needs to be added there too, or the whole deploy payload is rejected — see the comment in `.github/workflows/deploy.yml`.

> [!IMPORTANT]
> **Transcript script affects catalog matching**: `searchMariaDbProducts` scores transcripts against Latin-script catalog rows (`post_title`, `_sku`), so brand names must come back as `HP`, not `এইচপি`. Two things protect this: `ELEVENLABS_STT_LANGUAGE` is left unset so Scribe auto-detects and preserves code-switching, and `transcribe.ts` sends a `keyterms` list of Digico's brands. Pinning the language to Bengali transliterates product names and silently degrades retrieval.

> [!NOTE]
> **Meta WhatsApp Cloud API vs Interactive Web Emulator**:
>
> - The frontend dashboard contains a built-in **Interactive WhatsApp Emulator** (`/api/emulator`) allowing full end-to-end testing of AI completions, order extraction, and message logs with zero external dependencies.
> - Live integration with Meta's production WhatsApp Cloud API requires `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from your Meta Developer Portal.

---

## 🐳 Docker & Production Deployment

The project is containerized for production servers (RHEL, Ubuntu, Cloud VMs) using Docker Compose:

```bash
# Start container stack in background (MariaDB, Backend, Frontend)
make docker-up

# Check container status
docker compose ps

# View container logs
docker compose logs -f

# Stop containers
make docker-down

# Reset database container volume
make clean-db
```

### Production Architecture in Docker

- **`digico-mariadb`** — MariaDB 11.8 engine listening on `3306` inside the Docker bridge network (`3307` mapped to host).
- **`digico-backend`** — Fastify server listening on `8787`. Connects to MariaDB via the internal URI `mysql://wp:wp@mariadb:3306/woocommerce_local`. Serves `/health`, the `/webhook` ingress, `/api/emulator/*`, and the tRPC router at `/trpc`.
- **`digico-frontend`** — Nginx hosting the built React SPA. Exposes host ports `80` (production) and `5173` (no-TLS debugging) → `80`. It reverse-proxies `/api/`, `/trpc`, and `/webhook` to `digico-backend:8787`, and serves `/health` itself.

---

## 📄 License

Proprietary — Internal software developed for **Digico Bangladesh**. All rights reserved.
