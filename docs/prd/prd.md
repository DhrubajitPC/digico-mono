# PRD: Conversational WhatsApp Ordering for Digico — v1.0

**Status:** Approved for implementation planning
**Last updated:** 2026-07-20
**Supersedes:** Draft Product Brief (see git history of this file)

---

## 1. Overview

Build a conversational AI ordering tool for Digico's technology distribution business. Dealers interact with the business over **WhatsApp** — in Bengali, English, or Banglish — to discover products, check prices and stock, and place orders. The AI interprets the conversation; the backend holds the business truth; a human approves every order before it is confirmed.

This is an **internal tool for the existing business**. It will not be sold to other distributors. Dealers are its external users; operations staff are its internal users.

Example of the target experience:

> **Dealer:** Bhai, Lenovo i5 laptop ta koto?
>
> **AI:** Which model do you mean? We currently have these three Lenovo i5 models available…
>
> **Dealer:** Second one. 10 piece lagbe.
>
> **AI:** We currently have 8 units available. Would you like 8 now, or should I create a request for 10?

The system converts an unstructured conversation into structured, human-reviewable business operations.

---

## 2. Business Context

- Technology products distributor operating in Bangladesh (digico.com.bd)
- Approximately **$1M in business over the past year**
- **200–500 active dealers/resellers**
- **600+ SKUs** across multiple product categories
- Dealer communication today is heavily manual (calls, chat messages handled by staff)

**Baseline data to collect before pilot launch:** daily WhatsApp message volume, daily/monthly order counts, average human minutes per order today. These become the denominators for the success metrics in section 13.

---

## 3. Problem

Dealer ordering is inherently conversational. A dealer typically does not know the exact SKU, official product naming, current price, available stock, or variants. Reaching a confirmed order takes several messages of back-and-forth with a human staff member today.

Traditional e-commerce flows (catalog browsing, variant pickers, forms) don't match how dealers already communicate. The hypothesis: dealers prefer simply saying what they want, in the channel they already use.

---

## 4. Users

### Dealer / Reseller (external)

- Interface: **WhatsApp only** — no app to install, no portal to learn
- Communicates in natural-language **text**: Bengali, English, or Banglish (mixed)
- Refers to products by official names, abbreviations, partial model numbers, brand + spec ("HP i5 8/512"), nicknames, or misspellings
- The experience should feel like messaging a knowledgeable sales representative

### Operations / Admin (internal)

- Interface: web admin dashboard
- Reviews and approves every draft order before the dealer receives confirmation
- Maintains catalog, price, inventory, and dealer data via CSV import

---

## 5. MVP Scope (Phase 1)

### In scope

| Area             | Included                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Channel          | WhatsApp Business Cloud API, **text messages only**                                                                                                    |
| Languages        | Bengali, English, Banglish                                                                                                                             |
| Intents          | Product discovery, price inquiry, inventory inquiry, order creation, order modification (pre-confirmation), order status, conversational clarification |
| Pricing          | **Single price list** — every dealer sees the same price                                                                                               |
| Ordering         | AI creates **draft orders**; a human approves, edits, or rejects every one; dealer receives final confirmation                                         |
| Admin            | **Lean admin**: draft-order review queue + CSV import for catalog, prices, inventory, and dealers; light edit screens only                             |
| Data             | The platform is the **source of truth** for catalog, prices, inventory, dealers, and orders. Data enters via CSV/spreadsheet import                    |
| Product matching | First-class capability: aliases, fuzzy/semantic search, confidence thresholds, clarification questions                                                 |

### Out of scope (deferred)

| Deferred item                                       | Target   |
| --------------------------------------------------- | -------- |
| Voice messages (Bengali/Banglish speech-to-text)    | Phase 2  |
| Tiered / dealer-specific pricing                    | Phase 2  |
| Inventory & price edit UIs (beyond CSV re-import)   | Phase 2  |
| Credit limits and balance tracking                  | Phase 3  |
| Auto-approval of high-confidence orders             | Phase 3  |
| Website (WooCommerce) or ERP/accounting integration | Phase 3+ |
| Payments, invoicing                                 | Future   |
| Images / document understanding                     | Future   |
| Promotions and discounts                            | Future   |

---

## 6. Dealer Use Cases (MVP intents)

**Product discovery** — "Gaming laptop ase?" → system returns relevant available options.

**Price inquiry** — "HP 15s er price koto?" → system resolves the product and returns the current price from the backend.

**Inventory inquiry** — "20 piece available?" → system checks current stock for the product in conversational context.

**Order creation** — "10 ta diye den." → system uses conversational context to create a draft order.

**Order modification** — "10 na, 15 ta koren." → system modifies the draft before it is confirmed.

**Order status** — "Amar order ta kothay?" → system retrieves the dealer's recent order and its status.

**Conversational clarification** — "Samsung monitor 10 ta lagbe" where multiple Samsung monitors exist → the AI asks which one, rather than guessing.

---

## 7. Order Workflow

```
Dealer sends WhatsApp text message
        ↓
WhatsApp integration receives message
        ↓
AI determines intent and extracts entities
(dealer, product reference, quantity, order reference)
        ↓
Backend validates against authoritative data
(product exists, stock, price)
        ↓
If an order is intended → create DRAFT ORDER
        ↓
Ops reviews draft in admin queue
(conversation, AI interpretation, matched SKU, qty, price, stock)
        ↓
Ops approves / edits / rejects / requests clarification
        ↓
Dealer receives final confirmation on WhatsApp
        ↓
Order moves into the existing fulfillment process
```

Non-order intents (discovery, price, stock, status) are answered directly from backend data without human review.

---

## 8. Product Principles

### AI interprets. Backend decides.

The LLM is never the source of truth for price, inventory, product availability, order status, or transaction confirmation. The AI's role is to understand language and context, identify intent, resolve products (or ask), extract structured data, choose which approved backend capability to invoke, and phrase responses based on verified backend data.

### Clarify over guessing.

When product-match confidence is insufficient, the AI asks a clarification question. A few confidently-wrong answers would damage dealer trust more than an extra question ever will.

### Human approval before commitment.

No order is confirmed to a dealer without human approval in the MVP. Automation of high-confidence approvals is a Phase 3 decision, driven by pilot accuracy data.

---

## 9. Product Matching

With 600+ SKUs, product resolution is the hardest problem in the system and is treated as a first-class capability:

- Curated catalog metadata: aliases, search terms, transliterations, common misspellings per product
- A search/retrieval layer over the catalog (not raw LLM recall)
- Confidence thresholds: high → proceed; medium → confirm with dealer; low → present options or ask
- Every mismatch found during ops review feeds back into the alias data

---

## 10. Human-in-the-Loop & Admin

The MVP admin is deliberately lean and centers on the **draft-order review queue**. For each draft, the reviewer sees:

- Dealer identity
- The original conversation
- AI interpretation and matched SKU(s), with confidence/ambiguity indicators
- Quantity, price, current stock
- Actions: **approve / edit / reject / request clarification**

Beyond the queue: CSV import (with validation report) for products, prices, inventory, and dealers; read views and light edit screens; a conversation browser for QA. Full CRUD management UIs are Phase 2.

---

## 11. Data Model (MVP)

**Dealer** — ID, business name, contact person, phone/WhatsApp identity, status (active/suspended). _No pricing tier or credit fields in MVP._

**Product** — ID, SKU, brand, category, name, model, specifications, aliases/search terms.

**Inventory** — SKU, available quantity, reserved quantity. _Single stock pool assumed; multi-warehouse is an open question (section 16)._

**Price** — SKU, current price, validity period. _One price list for all dealers._

**Order** — ID, dealer, line items (SKU, quantity, unit price), status (draft → pending review → approved/rejected → confirmed → fulfilled/cancelled), reviewer, timestamps.

**Conversation** — dealer, messages (inbound/outbound), AI interpretations, tool calls made, linked orders, human interventions.

---

## 12. Technical Direction

To be validated during implementation planning, not final:

- **Monorepo:** this Vite+ TypeScript monorepo hosts the backend service and the admin web app
- **Backend:** Node.js + TypeScript (Fastify or comparable), PostgreSQL
- **Channel:** WhatsApp Business Cloud API
- **AI layer:** provider-agnostic orchestration with tool calling; models chosen by benchmark (candidates: Gemini, OpenAI, DeepSeek, Qwen), replaceable without rewriting the business system
- **Infra:** simplest production-grade setup (Docker + managed cloud compute); no Kubernetes/microservices in MVP; Redis/queues only where a concrete need is demonstrated

### AI tool interface

The AI is exposed a controlled set of backend tools — never database access:

`search_products()` · `get_product_details()` · `get_price()` · `check_inventory()` · `create_draft_order()` · `modify_draft_order()` · `get_order_status()`

The backend executes each call with deterministic validation and authorization.

---

## 13. Metrics & Pilot Targets

Targets are initial hypotheses to be revisited after the first pilot cycle.

| Metric                                                             | Pilot target                                    |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| SKU-match accuracy (of orders reaching review)                     | ≥ 90%                                           |
| Draft orders approved without edits                                | ≥ 80%                                           |
| Conversations resolved without human messaging (non-order intents) | ≥ 70%                                           |
| Median response latency (dealer message → AI reply)                | < 10 seconds                                    |
| Human minutes per order vs. current process                        | ≥ 50% reduction                                 |
| AI + infra cost per successfully completed order                   | Tracked from day one; target set after baseline |

Adoption metrics (weekly active pilot dealers, orders per dealer) are tracked but not gated during the pilot. The guiding economic principle: **lowest reliable cost per successful business transaction**, not cheapest tokens.

---

## 14. Risks & Mitigations

| Risk                                              | Mitigation                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Product matching errors (600+ SKUs)               | Alias-rich catalog, retrieval layer, confidence thresholds, clarification flow, ops feedback loop (section 9)                      |
| Hallucinated prices/stock                         | All business facts come from backend tools; AI never answers these from its own knowledge                                          |
| Incorrect orders                                  | Human approval of every order in MVP                                                                                               |
| Dealer trust loss                                 | Clarify over guessing; human review; pilot with a small group first                                                                |
| Stale data (platform owns data, ops maintains it) | CSV import designed for frequent re-import with a validation/diff report; import freshness visible in admin                        |
| AI cost growth                                    | Model routing, small models for simple intents, conversation summarization, caching; cost per completed order tracked from day one |
| Vendor lock-in                                    | Provider-agnostic AI layer                                                                                                         |

---

## 15. Pilot Plan

- **Participants:** 10–30 active dealers (of the 200–500), selected across representative product categories
- **Data:** real catalog, real prices, real inventory
- **Duration:** 4–6 weeks of live dealer conversations
- **Measure:** everything in section 13, plus clarification frequency, human correction rate, and dealer satisfaction
- **Exit criteria:** metrics reviewed against targets → decide what to automate or expand next (Phase 2 scope)

---

## 16. Open Questions

1. **Volumes:** How many WhatsApp conversations and orders occur daily/monthly today? _(Collect before pilot — needed for cost projection and baseline.)_
2. **Warehouses:** Is stock held in one location or several? _(MVP assumes a single pool; multi-warehouse would change the inventory model.)_
3. **WhatsApp readiness:** Is a WhatsApp Business Platform account with a verified business number available, and does dealer messaging comply with its policies?
4. **Data freshness:** How often do prices and stock change, and who on the ops team owns keeping imports current?
5. **Phase 2 STT:** Which speech-to-text provider handles Bengali/Banglish voice notes acceptably? _(Benchmark before committing to voice scope.)_

---

## 17. Phased Roadmap

**Phase 1 — MVP (this PRD):** text-only WhatsApp ordering with human approval, lean admin, CSV-managed data.

**Phase 2:** voice notes (Bengali STT), tiered/dealer-specific pricing, inventory & price edit UIs, expanded dealer rollout.

**Phase 3:** credit limits and balances, auto-approval of high-confidence orders, website/ERP integration.

**Future directions (not commitments):** payments and collection reminders, promotions and recommendations, returns/warranty workflows, demand forecasting from conversation signals.
