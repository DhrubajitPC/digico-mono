# Design: PRD Update — MVP Scope for Conversational WhatsApp Ordering

**Date:** 2026-07-20
**Outcome:** `docs/prd/prd.md` rewritten from a draft product brief into an actionable MVP PRD (v1.0). This record captures the decisions made during brainstorming and their rationale.

## Decisions

| #   | Question                  | Decision                                                                         | Rationale                                                                                                 |
| --- | ------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Purpose of the update     | Turn the draft brief into an actionable MVP PRD                                  | Prior doc had 17 open questions, no targets, and unbounded scope                                          |
| 2   | First dealer problem      | Full loop: inquiry (discovery/price/stock) **and** draft orders                  | Demonstrates core business value (orders) from day one                                                    |
| 3   | Voice messages            | Deferred to Phase 2                                                              | Cuts Bengali STT cost/risk from the pilot; text proves intent detection and product matching first        |
| 4   | Authoritative data source | The new platform owns catalog/price/inventory/dealer data, loaded via CSV import | Simplest to build and control; WooCommerce/ERP integration deferred to Phase 3+                           |
| 5   | Pricing model             | Single price list for all dealers; credit deferred                               | Per user: dealer prices do not differ in a way that blocks MVP; tiered pricing is Phase 2, credit Phase 3 |
| 6   | Scale                     | 200–500 active dealers                                                           | Sizable network; 10–30 dealer pilot is a meaningful sample                                                |
| 7   | End goal                  | Internal tool for the current business only — never sold to other distributors   | "Distribution OS" platform framing removed from the PRD                                                   |
| 8   | Admin scope               | Lean admin: draft-order review queue + CSV import; full CRUD UIs are Phase 2     | Fastest path to a real pilot; ops keeps spreadsheets as the editing surface initially                     |

## Key structural changes to the PRD

- Retitled and versioned; platform/DOS vision reduced to a short "future directions" list
- Explicit in/out scope tables with a phase tag on every deferred item
- Data model simplified: no dealer pricing tier or credit fields; single price list; single stock pool
- Metrics given concrete pilot targets (≥90% SKU match, ≥80% no-edit approvals, <10s median latency, ≥50% human-time reduction)
- Open questions reduced from 17 to 5 genuinely unknown items
- Phased roadmap added (Phase 1 MVP → Phase 2 voice/tiered pricing/edit UIs → Phase 3 credit/auto-approval/integrations)

## Next step

Invoke the **writing-plans** skill against `docs/prd/prd.md` to produce the Phase 1 implementation plan.
