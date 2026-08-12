# Digico — Conversational AI B2B Ordering Monorepo

An AI-powered B2B ordering and distribution system for [Digico](https://www.digico.com.bd/), a technology products and home appliances distributor in Bangladesh (selling brands like **Conion**, **Panasonic**, **HP**, **Lenovo**, **Dell**, **Samsung**, and **Logitech**).

Dealers place wholesale orders over **WhatsApp** in **Bengali**, **English**, or **Banglish** ("HP i5 laptop, 10 ta lagbe"). DeepSeek AI interprets dealer intent, retrieves live MariaDB catalog candidates, and auto-drafts confirmed sales orders into WooCommerce tables for human admin review.

---

## 🏗️ Monorepo Architecture

The repository is structured as a **clean 3-layer architecture** using **Vite+** and **pnpm workspaces**:

```text
digico-mono/
├── apps/
│   ├── website/                 # Layer 1: React 19 B2B Orders Dashboard & WhatsApp Emulator
│   └── whatsapp-webhook/        # Layer 2: Fastify REST API & Meta WhatsApp AI Pipeline
│       └── src/
│           ├── routes/          # Fastify HTTP Route Plugins
│           │   ├── webhook.ts   # Meta Cloud API verification & ingress (GET/POST /webhook)
│           │   ├── orders.ts    # Orders API (/api/orders)
│           │   ├── products.ts  # WooCommerce Catalog API (/api/products)
│           │   ├── dealers.ts   # Dealer accounts API (/api/dealers)
│           │   ├── messages.ts  # WhatsApp message logs API (/api/messages)
│           │   └── emulator.ts  # WhatsApp Emulator endpoints (/api/emulator)
│           └── services/        # AI & External Integration Services
│               ├── deepseek.ts        # DeepSeek LLM system prompt & completions
│               ├── intent-router.ts   # Zero-cost 10ms rule-based intent interceptor
│               ├── order-tools.ts     # Function tools with catalog price/stock guardrails
│               ├── parse-webhook.ts   # Meta Cloud API payload parser
│               ├── handle-message.ts  # Multi-turn pipeline orchestrator
│               ├── transcribe.ts      # OpenAI Whisper voice note transcription
│               ├── whatsapp-media.ts  # WhatsApp CDN media downloader
│               └── whatsapp-send.ts   # WhatsApp Cloud API message sender
├── packages/
│   └── db/                      # Layer 3: Central Database Package (@digico/db)
│       └── src/
│           ├── client.ts        # MariaDB pool connection & Docker host resolution
│           ├── orders.ts        # WooCommerce order queries & status mappers
│           ├── products.ts      # WooCommerce catalog & RAG search
│           ├── dealers.ts       # Dealer account queries
│           ├── logs.ts          # WhatsApp message & AI call logging tables
│           └── seed.ts          # WooCommerce export.sql seed runner
├── design-system/               # Design tokens & React UI component library (@digico/design-system)
├── data/                        # Database initialization scripts (mariadb-init)
├── export.sql                   # 919 MB WooCommerce database seed dump
├── docker-compose.yml           # Production & staging container stack (MariaDB, Backend, Frontend)
├── Makefile                     # Unified project task runner (Single Source of Truth CLI)
└── .env                         # Unified environment configuration at project root
```

---

## 🛠️ Technology Stack

| Layer              | Technology                                     | Purpose                                                                            |
| :----------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Monorepo**       | **Vite+** (`vp`), **pnpm 11**                  | Unified CLI for task orchestration, workspace packages, formatting, and linting    |
| **Frontend**       | **React 19**, **TypeScript**, **Tailwind CSS** | B2B Orders Dashboard, Message Log Auditor, & Interactive WhatsApp Emulator         |
| **Backend API**    | **Node.js ≥ 22**, **Fastify**, **TypeScript**  | REST API endpoints & Meta WhatsApp Cloud API webhook handler                       |
| **Database**       | **MariaDB 11.8** (`mysql2`)                    | WooCommerce schema (`joy_posts`, `joy_postmeta`) + WhatsApp message & AI call logs |
| **AI / LLM**       | **DeepSeek V3** (`deepseek-chat`)              | Conversational AI agent with native function calling (`draft_order`)               |
| **Speech-to-Text** | **OpenAI Whisper** (`whisper-1`)               | Voice note transcription for incoming WhatsApp audio messages (Optional)           |

---

## 🔑 Environment Variables Reference

Secrets and configuration are maintained in a **single root `.env` file** at project root:

```ini
# --- Database Configuration ---
# Local host development uses port 3307; Docker containers auto-route to mariadb:3306
MARIADB_URL=mysql://wp:wp@127.0.0.1:3307/woocommerce_local
MARIADB_ROOT_PASSWORD=root
MARIADB_DATABASE=woocommerce_local
MARIADB_USER=wp
MARIADB_PASSWORD=wp

# --- Backend API Server ---
PORT=8787
NODE_ENV=development

# --- AI Models ---
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=your_openai_api_key_here  # Optional: required only for voice note transcription

# --- Meta WhatsApp Cloud API ---
WHATSAPP_VERIFY_TOKEN=digico_secret_verify_token_12345
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id_here
```

---

## 💻 Step-by-Step Local Setup Guide

Follow these step-by-step instructions to get the application running locally from scratch:

### Step 1: Prerequisites

Ensure you have the following installed on your local machine:

- **Node.js**: `≥ 22.18.0` (check via `node -v`)
- **Docker Desktop**: Docker engine running locally (required to spin up MariaDB)
- **Vite+ / pnpm**: Installed via `npm i -g vite-plus` or `npm i -g pnpm@11.14.0`

### Step 2: Clone Repository & Install Dependencies

```bash
git clone git@github.com:DhrubajitPC/digico-mono.git
cd digico-mono

# Install dependencies across all workspace packages (@digico/db, whatsapp-webhook, website)
vp install
```

### Step 3: Configure Local Environment Variables (.env)

```bash
# Copy the environment configuration template
cp .env.example .env
```

Open `.env` in your editor and insert your **DeepSeek API Key**:

```ini
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

_(Note: All default ports — MariaDB on `3307` and Fastify API on `8787` — are pre-configured.)_

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
# Start both Fastify API (:8787) and React Frontend (:5173) concurrently in watch mode
make dev
```

### Step 6: Verify Local Installation

1. **B2B Admin Dashboard**: Open `http://localhost:5173` in your browser. You will see live WooCommerce orders and products populated from MariaDB.
2. **Interactive WhatsApp Emulator**:
   - In the frontend dashboard, click on the **WhatsApp Emulator** tab.
   - Select a dealer phone number (e.g. `Souhardo Ahmed (+8801711000001)`).
   - Type a test query: `"Hi, I want to order 3x HP 15s laptops for my store"` and click **Send**.
   - Watch DeepSeek AI generate real-time completions, verify live catalog prices/stock, and draft orders in MariaDB.
3. **Backend Health Check**: Run `curl http://localhost:8787/health` in terminal (returns `ok`).

---

## 🚀 Development Commands (`Makefile`)

All developer and operational workflows are driven via the **[`Makefile`](Makefile)**:

```bash
make dev         # Run Fastify API (:8787) and React Frontend (:5173) in watch mode
make backend     # Run Fastify API backend server on :8787
make frontend    # Run Vite React frontend server on :5173
make mariadb-up  # Start local MariaDB Docker container on :3307
make seed        # Seed MariaDB with export.sql dump
make check       # Format, lint, and typecheck across all workspaces
make check-fix   # Auto-fix formatting and linting errors
make build       # Build production frontend web bundle
```

---

## 🤖 AI Agent Pipeline & Features

1. **Zero-Cost Intent Router (`intent-router.ts`)**:
   - Intercepts deterministic commands (e.g. `status #ORD-123` or `cancel #ORD-123`) in **10ms** with 0 LLM token cost.

2. **Banglish RAG Catalog Search (`products.ts`)**:
   - Filters Banglish stop-words (`er`, `ki`, `ponno`, `ache`, `koto`, `dam`, `dami`, `dorkar`, `lagbe`, `khujchi`, etc.) to isolate product keywords.
   - Retrieves candidate products from MariaDB to construct a compressed, high-context prompt for DeepSeek.

3. **Multi-Turn Conversation Memory**:
   - Fetches prior chat history per dealer phone number from `joy_whatsapp_messages` and `joy_whatsapp_outbound_replies` to maintain context across messages.

4. **Function Calling & Server Guardrails (`order-tools.ts`)**:
   - When an order is negotiated, DeepSeek executes the `draft_order` function tool.
   - Server-side guardrails verify requested prices and stock against MariaDB live inventory before inserting rows into `joy_posts` and `joy_postmeta`.

---

## ⚠️ Caveats & Known Limitations

> [!WARNING]
> **OpenAI Whisper Voice Note Feature (Currently Disabled / Optional)**:
> Audio voice note transcription via OpenAI Whisper (`whisper-1`) is **currently disabled by default** unless `OPENAI_API_KEY` is explicitly set in `.env`.
>
> - **Text-based ordering** (in Bengali, English, and Banglish) uses DeepSeek V3 (`DEEPSEEK_API_KEY`) and is **100% operational** out-of-the-box.
> - If an incoming WhatsApp voice note is received while `OPENAI_API_KEY` is omitted, the pipeline catches the missing key gracefully and sends a polite fallback reply asking the dealer to type their message instead.

> [!NOTE]
> **Meta WhatsApp Cloud API vs Interactive Web Emulator**:
>
> - The frontend web dashboard contains a built-in **Interactive WhatsApp Emulator** (`/api/emulator`) allowing full end-to-end testing of AI completions, order extraction, and message logs with zero external dependencies.
> - Live integration with Meta's production WhatsApp Cloud API requires specifying `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` from your Meta Developer Portal.

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

### Production Architecture in Docker:

- **`digico-mariadb`**: MariaDB 11.8 engine listening on port `3306` inside Docker bridge network (`3307` mapped to host).
- **`digico-backend`**: Fastify REST API server listening on port `8787`. Connects to MariaDB via internal network URI `mysql://wp:wp@mariadb:3306/woocommerce_local`.
- **`digico-frontend`**: Nginx web server hosting built React SPA listening on ports `80` and `5173`. Proxies `/api/*` requests to `digico-backend:8787`.

---

## 📄 License

Proprietary — Internal software developed for **Digico Bangladesh**. All rights reserved.
