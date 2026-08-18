import { expect, test } from "vite-plus/test";
import { extractSearchTerms } from "../src/products.ts";

test("keeps Latin brand and model tokens from a Banglish order", () => {
  const terms = extractSearchTerms("HP i5 laptop 10 ta lagbe");
  expect(terms).toContain("hp");
  expect(terms).toContain("i5");
  expect(terms).toContain("laptop");
});

test("drops filler words in English and romanized Bengali", () => {
  const terms = extractSearchTerms("bhai Conion blender er dam koto");
  expect(terms).toContain("conion");
  expect(terms).toContain("blender");
  expect(terms).not.toContain("bhai");
  expect(terms).not.toContain("dam");
  expect(terms).not.toContain("koto");
});

test("strips punctuation without swallowing adjacent words", () => {
  const terms = extractSearchTerms("HP, i5 — laptop! (10x)");
  expect(terms).toContain("hp");
  expect(terms).toContain("laptop");
  expect(terms.some((t) => /[,—!()]/.test(t))).toBe(false);
});

// The regression this guards: ASCII-only \w erased every Bengali codepoint, so a
// transcribed voice note produced zero terms and searchMariaDbProducts silently
// returned an arbitrary unranked catalog slice.
test("returns usable terms for a Bengali-script transcript", () => {
  const terms = extractSearchTerms("আমার একটা ল্যাপটপ লাগবে");
  expect(terms.length).toBeGreaterThan(0);
});

test("preserves Latin product names embedded in Bengali script", () => {
  const terms = extractSearchTerms("আমার ১০টা HP laptop লাগবে");
  expect(terms).toContain("hp");
  expect(terms).toContain("laptop");
});

test("returns no terms for punctuation-only input", () => {
  expect(extractSearchTerms("!!! ??? ...")).toEqual([]);
});
