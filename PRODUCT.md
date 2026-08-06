# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — Ops / Admin staff (internal).** A small internal operations team at Digico who review, edit, approve, reject, or request clarification on AI-drafted orders in the Sales Admin Order Dashboard. They also maintain catalog, price, inventory, and dealer data via CSV import. This design system exists to serve them.

**Indirect — Dealers / resellers (external), not a UI audience.** 200–500 active dealers who order via WhatsApp text (Bengali, English, or Banglish). Dealers never see any interface built from this design system; their entire experience is a WhatsApp conversation with an AI sales assistant.

## Product Purpose

Digico (digico.com.bd) is a technology products distributor in Bangladesh (~$1M/year across 600+ SKUs). This monorepo builds a conversational AI ordering tool: dealers describe what they want over WhatsApp in their own words, an AI interprets intent and resolves the product, and a human always approves the resulting draft order before it is confirmed.

The design system in `packages/ui` and the app in `apps/website` exist specifically to give ops staff a fast, trustworthy way to verify AI-generated orders. Success for this surface is not discovery or conversion — it's verification speed and confidence: the PRD targets ≥50% reduction in human minutes per order and ≥80% of drafts approved without edits.

## Positioning

Traditional distributor tooling forces dealers into catalog browsing, variant pickers, and forms that don't match how they already communicate. Digico meets dealers in the channel and language they already use, while keeping a deterministic, human-verified backend of record. The operating principle — **AI interprets, backend decides, human approves** — is what a neighboring "AI chatbot for sales" competitor could not casually copy without also rebuilding the human-in-the-loop guarantee dealers and ops trust.

## Operating Context

Order workflow: dealer WhatsApp message → AI intent/entity extraction → backend validation (product, stock, price) → draft order → ops review queue → approve / edit / reject / request clarification → dealer WhatsApp confirmation → fulfillment.

Per `docs/user-journey/user-journey.md`, the admin dashboard optimizes for one question: **"How quickly can a human verify an AI-generated order with confidence?"** A reviewer should never need to reread a long raw WhatsApp conversation. The target review surface shows, per draft: dealer identity, the AI's interpretation, matched SKU with confidence/ambiguity indicators, quantity, price, current stock, whether the dealer explicitly confirmed, and any AI self-corrections (e.g. "AI corrected quantity from 10 → 15") — then approve / edit / reject actions.

Beyond the review queue: CSV import for catalog/prices/inventory/dealers with a validation/diff report (import freshness must be visible in admin), light edit screens, and a conversation browser for QA. The MVP admin is **deliberately lean** — full CRUD management UIs are explicitly Phase 2, not now.

This is an internal tool for an existing business, not a product being sold externally.

## Capabilities and Constraints

- Single price list for all dealers — no dealer-specific or tiered pricing in the current MVP (tiered pricing is Phase 2).
- Single stock pool assumed; multi-warehouse inventory is an open PRD question (§16) that would change the inventory model if answered otherwise.
- No payments, invoicing, promotions, discounts, or credit limits in current scope.
- The AI layer is provider-agnostic; it is exposed only to a fixed set of deterministic backend tools (`search_products`, `get_product_details`, `get_price`, `check_inventory`, `create_draft_order`, `modify_draft_order`, `get_order_status`) and never has direct data access or authority — the admin UI must always reflect verified backend state, never AI-only claims.
- Terminology: **dealer** (not "customer"), **draft order** vs **confirmed order**, **SKU**, **ops / admin** (not "agent" or "rep").
- Open / undecided, not to be resolved by invented UI facts: WhatsApp Business Platform account readiness; baseline daily conversation/order volumes (not yet collected); who on ops owns import freshness.

## Brand Commitments

Product name: **Digico**, parent business at digico.com.bd (existing public storefront brand).

`design-system/tokens.json` and `tokens.css` already hold a brand-token extraction from digico.com.bd (primary red `#ec2839`, Albert Sans typeface) — this is raw evidence only; the extraction's own note flags it as unreviewed and in need of correction before adoption. Whether the internal ops tool should inherit the consumer storefront's visual identity or diverge with its own operate-mode identity is an open visual-world decision left to DESIGN.md / new-work, not decided here.

## Evidence on Hand

- `docs/prd/prd.md` — approved PRD v1.0 (2026-07-20), authoritative for scope, roles, and workflow.
- `docs/user-journey/user-journey.md` — dealer and ops journey maps, including an ASCII wireframe of the target order-review screen.
- `design-system/tokens.json`, `design-system/tokens.css` — extracted brand tokens from digico.com.bd; unreviewed raw evidence, not a confirmed design system.
- `apps/website/src` — existing implementation (OrdersDashboard, OrderReviewDrawer, CreateOrderModal, MessageLogView), referred to in commit history as the "Sales Admin Order Dashboard."
- No user research, testimonials, or pilot data exist yet. The pilot (10–30 dealers, 4–6 weeks) has not launched — do not fabricate metrics, quotes, or dealer feedback.

## Product Principles

1. **AI interprets, backend decides.** The admin UI must never present AI-authored price, stock, or status as authoritative — only verified backend data.
2. **Clarify over guessing, and show your work.** Surface AI ambiguity, confidence, and self-corrections explicitly rather than hiding them behind a clean summary.
3. **Optimize for verification speed and confidence.** Every admin screen exists so a human can approve, edit, or reject an AI-drafted order quickly and correctly — this outranks visual expression.
4. **Lean over complete.** The MVP admin is deliberately narrow; resist building full CRUD or management surfaces the roadmap defers to Phase 2.
5. **Internal tool, not a storefront.** The audience is a small, trusted, repeat-use ops team — design for expert efficiency, not first-time discovery or persuasion.

## Accessibility & Inclusion

No accessibility standard is established yet. Treat as an open requirement rather than inventing a compliance target.
