# design-system/

The `tokens.json` and `tokens.css` files in this directory are a **storefront
extraction kept for reference only**. They are not the source of truth for the
implemented design system and are not imported anywhere in the codebase.

The authoritative sources for the implemented system are:

- [`DESIGN.md`](../DESIGN.md) — the design contract (typography ramp, color
  palette, component behavior).
- [`apps/website/src/theme.css`](../apps/website/src/theme.css) — the compiled
  Tailwind theme tokens (brand colors, fonts).

Do not add new consumers of these token files; migrate any future need to
`theme.css` tokens instead.
