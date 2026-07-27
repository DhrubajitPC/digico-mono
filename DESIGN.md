---
name: Digico Sales Admin & Order Dashboard
description: The Verification Desk — a dense, quietly confident console for approving AI-drafted dealer orders
colors:
  primary: "#ec2839"
  destructive: "#dc2626"
  success: "#059669"
  warning: "#f59e0b"
  info: "#3b82f6"
  neutral-bg: "#f9fafb"
  neutral-surface: "#ffffff"
  neutral-border: "#e5e7eb"
  neutral-text: "#111827"
  neutral-text-muted: "#6b7280"
  status-draft: "#9ca3af"
  status-pending-review: "#f59e0b"
  status-confirmed: "#10b981"
  status-on-hold: "#f97316"
  status-processing: "#3b82f6"
  status-completed: "#0d9488"
  status-cancelled: "#f43f5e"
typography:
  title:
    fontFamily: "Albert Sans, system-ui, -apple-system, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Albert Sans, system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  label:
    fontFamily: "Albert Sans, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  body:
    fontFamily: "Albert Sans, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "Albert Sans, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: "Albert Sans, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#d41f30"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "36px"
  button-success:
    backgroundColor: "{colors.success}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "36px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "24px"
  input:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "4px 12px"
  badge-status-confirmed:
    backgroundColor: "#ecfdf5"
    textColor: "#065f46"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Digico Sales Admin & Order Dashboard

## Overview

**Creative North Star: "The Verification Desk"**

Every screen exists so one person can confirm what an AI already drafted — quickly, and with enough evidence on screen to trust the confirmation. The system reads as efficient, precise, and quietly confident: dense information, compact but readable type, almost no ornament, and exactly one accent color spent on the things that matter (identity, the active tab, the number that's about to be approved). Nothing here is trying to persuade or delight a first-time visitor; it's built for the same small ops team using it dozens of times a day — on real screens, for hours at a time, so type sizes err toward legible over merely dense.

The system borrows exactly two things from Digico's public storefront (digico.com.bd) — the brand red and the Albert Sans typeface — and rebuilds everything else (radius, shadow, spacing, layout) as its own compact, utilitarian internal language. It does not import the storefront's shadow vocabulary or its rounder corner scale; those belong to a persuade-mode marketing site, not this operate-mode console. This is a deliberate fork, not an oversight — do not "restore" the storefront's fuller radius/shadow scale here.

**Key Characteristics:**

- One brand accent (Digico Red), spent sparingly, never as a large fill
- A precise, business-meaning-driven color vocabulary — every non-neutral color maps to one specific status or action, never decoration
- Flat surfaces everywhere except overlays, which get real shadow and a blurred scrim
- A single typeface carrying the entire hierarchy through size, weight, and case alone
- Tables and dense grids are the default content type, not the exception

## Colors

Mostly neutral gray, with one confident brand-red signal color and a precise seven-color semantic vocabulary tied to the order lifecycle.

### Primary

- **Digico Red** (`#ec2839`): the identity mark, the active nav/status-tab state, the default/primary button, links, focus rings on inputs, and the single most important number on a screen (order totals, order numbers). It appears once or twice per screen region — its rarity is what makes it read as "this matters."

### Neutral

- **Page background** (`#f9fafb` / gray-50): the canvas every panel sits on.
- **Surface** (`#ffffff`): cards, panels, tables, overlays.
- **Border** (`#e5e7eb` / gray-200): the default hairline for cards, table rows, dividers.
- **Text** (`#111827` / gray-900): headings and primary content.
- **Text muted** (`#6b7280` / gray-500): secondary text, meta info, captions.

### Semantic — Order Status Palette

Each state is a soft-tinted pill (a `50`-tier background, a `700`–`800`-tier text color, a matching hairline border) with a small solid dot in the same hue. This is the system's richest and most distinctive color decision:

- **Draft** (`#9ca3af`, gray) — not yet submitted.
- **Pending Review** (`#f59e0b`, amber) — awaiting a human.
- **Confirmed** (`#10b981`, emerald) — approved and sent.
- **On-Hold** (`#f97316`, orange) — paused, needs a decision.
- **Processing** (`#3b82f6`, blue) — moving through fulfillment.
- **Completed** (`#0d9488`, teal) — done.
- **Cancelled** (`#f43f5e`, rose) — rejected or withdrawn.

### Action colors

- **Success** (`#059669`, emerald-600): the Approve & Confirm action only.
- **Warning** (`#f59e0b`, amber-500): the Hold action only.
- **Destructive** (`#dc2626`, red-600): the Reject/Cancel action only.
- **Info** (`#3b82f6`, blue): informational badges (e.g. "processing", generic info tags).

### Named Rules

**The Two Reds Rule.** Digico Red (`#ec2839`) marks identity and primary action. A separate red — `#dc2626` (Tailwind red-600) — marks destructive/danger actions. They never swap roles; a screen with both stays legible because only one red means "this is the brand," and the other means "this is dangerous."

**The One Signal Rule.** Non-neutral color always maps to one specific status or business action (draft/pending/confirmed/hold/processing/completed/cancelled; approve/hold/reject). No color exists purely for visual variety.

## Typography

**Font:** Albert Sans (Google Fonts, variable), with a `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` fallback stack. One typeface for the entire system — hierarchy comes from size, weight, and case, never from a second font.

**Character:** Narrow and utilitarian in spirit, but not cramped: the whole scale still stays well below the storefront's 38px hero size, while every working tier was widened one full step from the console's first pass so a reviewer can read a dense table for hours without strain.

### Hierarchy

- **Title** (700, 30px, 1.2 line-height): page-level H1 only — "Orders", "WhatsApp Message Log". One per view.
- **Heading** (700, 20–24px, 1.3): drawer titles sit at 20px; dialog titles at 24px — a dialog interrupts more assertively than a drawer, so it earns one step more weight.
- **Label** (700, 14px, 0.05em tracking, uppercase): the recurring "eyebrow" — section headers like "WhatsApp Context," "AI Intent Extraction," and every table column head.
- **Body** (400, 16px, 1.5): form labels, descriptions, standalone prose, dialog copy.
- **Data** (400, 14px, 1.4): the dominant size across the system — table cells, toolbars, meta text (phone numbers, dates, SKUs). Dense, but never below comfortable reading size.
- **Micro** (400/600, 12px, 1.2–1.3): one step below Data, for annotation that sits _under_ a primary line rather than standing on its own — a dealer's phone number under their name, a SKU under a product name, a chat-bubble sender label, a compact count or origin pill. Never used for a screen's only copy of information; always paired with a Data-or-larger line it clarifies.

### Named Rules

**The Eyebrow Rule.** Every distinct content region gets a bold, uppercase, letter-spaced 14px label before its content — never a plain unstyled heading. This is the system's signature typographic device and the fastest way a new screen will read as "on-brand" for this console.

## Layout

**Container:** `max-w-7xl`, centered, with a consistent `24px` (`px-6`) horizontal gutter at every breakpoint.

**Header:** sticky, 64px tall, white, hairline bottom border, minimal shadow — always visible, never competing with page content.

**Vertical rhythm:** `24px` (`space-y-6`) between major blocks within a view; `24px` view padding.

**Two-pane detail pattern:** a 12-column grid split 5/7 (read-only context on the left, editable detail on the right), collapsing to a single stacked column below the `lg` breakpoint (1024px). This is how the Order Review Drawer is built and the template for any future detail surface.

**The repeating surface unit:** `rounded-lg` (8px) + `1px` gray-200 border + white background — used identically for toolbars, table wrappers, side panels, and callout boxes. Everything that isn't the page background or an overlay is this one shape.

**Tables are the primary content type**, not a secondary pattern: compact rows, uppercase tracked-out column headers, `divide-y` row separators (no zebra striping), a hover highlight, and click-anywhere-on-the-row to open detail.

**Two tab idioms coexist, deliberately scoped differently:** an underline-style status filter bar (Digico Red active border + text) is used for page-level status filtering on the Orders view; a separate pill-style `Tabs` primitive exists in `packages/ui` (gray-100 track, white active pill) but isn't used on any current screen. Don't merge these two idioms — the underline style is for filtering a list, the pill style is available for switching between unrelated views.

## Elevation & Depth

Flat by default. Nearly every surface — cards, toolbars, table wrappers — sits at `shadow-xs` or no shadow at all; depth is barely perceptible at rest. Real elevation is reserved for content that must interrupt the page: the Dialog and Drawer use `shadow-2xl` plus a `black/40`–`50` scrim with a light backdrop blur, and the DropdownMenu uses `shadow-lg` with a hairline ring. Nothing uses colored shadows, glow effects, or a hover-lift on static cards.

### Named Rules

**The Overlay-Only Elevation Rule.** Shadow escalates only for content that must visually separate from the page (modals, drawers, menus). Every other surface stays flat.

## Shapes

Radius scale (the system's own scale — not the digico.com.bd storefront's 12/20/35px extraction):

- **sm** (6px): buttons, inputs, small controls, table-wrapper corners.
- **md** (8px): cards, panels, the pill-tab track.
- **lg** (12px): the Dialog only — the one place a slightly softer, more prominent corner is used.
- **full** (pill): badges, status pills, avatars, status dots.

Borders are hairline (1px) gray-200/300 almost everywhere. Semantic containers (the AI Intent Extraction callout, the WhatsApp confirmation-message box) borrow a tinted border — emerald-200/300 — to mark themselves as special content without changing shape or radius.

No sharp/square corners anywhere; no heavy or double borders.

## Components

### Buttons

- **Shape:** `rounded-md` (6px). Sizes: `h-8` (sm) / `h-9` (default) / `h-11` (lg) / `h-9 w-9` (icon-only).
- **Primary** (Digico Red `#ec2839` → hover `#d41f30`): the default/identity action.
- **Destructive** (red-600 → red-700): Reject/Cancel only.
- **Success** (emerald-600 → emerald-700): Approve & Confirm only.
- **Warning** (amber-500 → amber-600): Hold only.
- **Secondary / Outline / Ghost / Link:** low-emphasis and utility actions (Refresh, Cancel, in-row Review). Color on every variant is tied to one specific meaning — never picked for visual variety.

### Badges

- **Badge** (generic): 6 variants (default/secondary/destructive/outline/success/info), `rounded-full`, `px-2.5 py-0.5`, 12px semibold.
- **StatusBadge** (signature component): the 7-state order-lifecycle badge — soft-tinted pill + solid dot, see Colors › Semantic. This is the system's most distinctive, most-reused custom primitive.

### Cards / Panels

- **Corner:** `rounded-lg` (8px).
- **Background:** white, on a gray-50 page.
- **Shadow:** `shadow-xs` or none (see Elevation).
- **Border:** 1px gray-200.
- **Internal padding:** 24px for the generic `Card` primitive; 16px for dense toolbar/panel usage inside a view.

### Inputs / Selects

- **Style:** 1px gray-300 border, white background, `rounded-md`, `h-9`, `shadow-xs`.
- **Focus:** a 1px Digico Red ring — the border color itself doesn't change, only the ring appears.
- **Disabled:** 50% opacity, `cursor-not-allowed`.

### Tables

- **Header:** gray-50 background, uppercase tracked-out gray-500/600 labels, bottom border.
- **Rows:** `divide-y` gray-200, `hover:bg-gray-50`, click-to-open-detail.
- **Cells:** dense (12px), right-aligned currency, centered quantity/status, left-aligned everything else.

### Overlays

- **Dialog:** centered, `rounded-xl` (12px), `shadow-2xl`, `black/50` blurred scrim, 6 width steps (`sm`→`4xl`), Esc-to-close, top-right icon close button.
- **Drawer:** right-side slide-over, full height, `shadow-2xl`, `black/40` blurred scrim, 6 width steps (`md`→`4xl`), header carries title + subtitle + close, Esc-to-close.
- **DropdownMenu:** click-outside-to-close, `rounded-md`, `shadow-lg` + hairline ring, per-item semantic color (default/destructive/success/warning).

### Signature: WhatsApp Transcript Replica

Inside the Order Review Drawer, the original conversation is rendered as an actual chat replica, not a plain quote block: dealer messages are emerald-tinted bubbles with a `rounded-tl-none` tail and a small circular avatar (a User icon), left-aligned; AI replies are gray bubbles with a `rounded-tr-none` tail and a Bot-icon avatar, right-aligned. This is a deliberate visual quotation of WhatsApp itself — it keeps the reviewer anchored in "this came from a real conversation."

### Signature: AI Intent Extraction Callout

An emerald-bordered, emerald-tinted card with a Sparkles icon and a bold "AI Intent Extraction" eyebrow, stating the detected intent, a confidence percentage, and the matched SKU count in plain prose. This is the system's mechanism for making the AI's reasoning legible before a human approves it — the single most important design idea in the whole console, and the one every new AI-facing surface should imitate.

## Do's and Don'ts

### Do:

- **Do** reserve Digico Red (`#ec2839`) for identity, active state, primary action, and the one most important number on a screen — never a large fill.
- **Do** give every distinct content region a bold, uppercase, 12px tracked-out eyebrow label before its content (The Eyebrow Rule).
- **Do** tie button and badge color strictly to business meaning — emerald = approve, amber = hold, red-600 = reject — never swapped for visual variety (The One Signal Rule).
- **Do** keep tables and dense views at the 14px data size; reserve 16px+ for standalone prose, form labels, and page titles only.
- **Do** escalate shadow only for overlay content (dialogs, drawers, menus); keep every other surface flat.

### Don't:

- **Don't** introduce a second accent hue. The system has exactly one brand accent (Digico Red) plus the fixed semantic set (emerald/amber/blue/orange/teal/rose/gray) — no new decorative colors.
- **Don't** use Digico Red for destructive actions; destructive stays on red-600/700 so the two reds never compete for meaning (The Two Reds Rule).
- **Don't** add imagery, illustration, or the storefront's larger display type — the 38px/26px marketing scale in `design-system/tokens.*` belongs to the public digico.com.bd site, not this admin console.
- **Don't** reach for the raw `design-system/tokens.*` radius or shadow values (12/20/35px radii; ambient shadow scale). The implemented system already committed to its own, tighter radius (6/8/12px) and shadow (flat-by-default) scales instead.
