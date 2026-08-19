import { expect, test } from "vite-plus/test";
import { extractSearchTerms } from "../src/products.ts";

test("keeps Latin brand and model tokens from a Banglish order", () => {
  const terms = extractSearchTerms("Conion i5 refrigerator 10 ta lagbe");
  expect(terms).toContain("conion");
  expect(terms).toContain("i5");
  expect(terms).toContain("refrigerator");
});

test("drops filler words in English and romanized Bengali", () => {
  const terms = extractSearchTerms("bhai Conion blender er dam koto");
  expect(terms).toContain("conion");
  expect(terms).toContain("blender");
  expect(terms).not.toContain("bhai");
  expect(terms).not.toContain("dam");
  expect(terms).not.toContain("koto");
});

// Scoring is an unanchored substring test, so a surviving "ta" or "10" matches
// "Table Fan" and "Conion Fan 1050" and pads the candidate list with noise.
test("drops quantity numerals and Bangla counters", () => {
  const terms = extractSearchTerms("Conion refrigerator 10 ta lagbe");
  expect(terms).not.toContain("10");
  expect(terms).not.toContain("ta");
  expect(terms).toEqual(["conion", "refrigerator"]);
});

test("drops Bengali-script numerals too", () => {
  expect(extractSearchTerms("১০ টা")).toEqual([]);
});

test("strips punctuation without swallowing adjacent words", () => {
  const terms = extractSearchTerms("Conion, i5 — refrigerator! (10x)");
  expect(terms).toContain("conion");
  expect(terms).toContain("refrigerator");
  expect(terms.some((t) => /[,—!()]/.test(t))).toBe(false);
});

/*
 * The regression this guards, in two layers:
 *
 * 1. ASCII-only `\w` erased every Bengali codepoint, yielding zero terms.
 * 2. `\p{L}\p{N}` alone dropped combining marks (category M), which Bengali
 *    orthography requires — "আমার একটা ল্যাপটপ লাগবে" was shattered into
 *    ["আম","একট","পটপ","গব"].
 *
 * Asserting concrete tokens, not `length > 0`: the length check passed on the
 * shattered output and is exactly why layer 2 shipped.
 */
test("keeps Bengali grapheme clusters intact", () => {
  const terms = extractSearchTerms("আমার একটা ল্যাপটপ লাগবে");
  expect(terms).toContain("আমার");
  expect(terms).toContain("একটা");
  expect(terms).toContain("ল্যাপটপ");
  expect(terms).toContain("লাগবে");
});

test("does not emit fragments for Bengali input", () => {
  const terms = extractSearchTerms("আমার একটা ল্যাপটপ লাগবে");
  // "আম" is the mojibake fragment the combining-mark bug produced from "আমার".
  expect(terms).not.toContain("আম");
  expect(terms).not.toContain("পটপ");
});

test("preserves Latin product names embedded in Bengali script", () => {
  const terms = extractSearchTerms("আমার ১০টা Conion refrigerator লাগবে");
  expect(terms).toContain("conion");
  expect(terms).toContain("refrigerator");
});

test("returns no terms for punctuation-only input", () => {
  expect(extractSearchTerms("!!! ??? ...")).toEqual([]);
});
