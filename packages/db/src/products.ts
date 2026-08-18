import type mysql from "mysql2/promise";
import type { Product } from "@digico/contracts";
import { getMariaDbPool } from "./client.ts";

/** Canonical product shape lives in @digico/contracts; kept as an alias for existing call sites. */
export type WcProduct = Product;

/** Fetch Products list from MariaDB */
export async function fetchMariaDbProducts(): Promise<WcProduct[]> {
  const p = getMariaDbPool();
  const [rows] = await p.query<mysql.RowDataPacket[]>(`
    SELECT 
      p.ID as id,
      p.post_title as name,
      m1.meta_value as sku,
      m2.meta_value as price,
      m3.meta_value as stock
    FROM joy_posts p
    LEFT JOIN joy_postmeta m1 ON p.ID = m1.post_id AND m1.meta_key = '_sku'
    LEFT JOIN joy_postmeta m2 ON p.ID = m2.post_id AND m2.meta_key = '_price'
    LEFT JOIN joy_postmeta m3 ON p.ID = m3.post_id AND m3.meta_key = '_stock'
    WHERE p.post_type = 'product' AND p.post_status = 'publish'
    LIMIT 200
  `);

  return (rows || []).map((r) => ({
    id: r.id,
    sku: r.sku || `SKU-${r.id}`,
    brand: "WooCommerce",
    name: r.name,
    category: "Products",
    model: null,
    specifications: null,
    unitPrice: Math.round(parseFloat(r.price || "0")),
    stockQuantity: parseInt(r.stock || "10", 10),
    aliases: [r.name],
  }));
}

/**
 * Filler words dropped before scoring, in English and romanized Bengali.
 * Bengali-script equivalents are absent on purpose: they cost nothing to leave
 * in, since they will not match any Latin-script catalog row anyway.
 */
const STOP_WORDS = new Set([
  "what",
  "is",
  "the",
  "current",
  "stock",
  "price",
  "and",
  "for",
  "with",
  "want",
  "need",
  "order",
  "units",
  "please",
  "have",
  "has",
  "you",
  "your",
  "are",
  "any",
  "some",
  "can",
  "er",
  "ki",
  "ponno",
  "ache",
  "koto",
  "dam",
  "dami",
  "dorkar",
  "lagbe",
  "nibo",
  "khujchi",
  "chaichilam",
  "apnader",
  "kache",
  "bhai",
  "sir",
  "kono",
  "somoy",
]);

/**
 * Splits a dealer message into scoreable search terms.
 *
 * `\w` is ASCII-only, so the original `[^\w\s]` strip erased every Bengali
 * codepoint and returned an empty list for any Bengali-script voice-note
 * transcript. `\p{L}\p{N}` keeps letters and digits in any script while still
 * dropping punctuation.
 *
 * Note this does not make Bengali script *match* the English catalog — that is
 * what the transcription keyterms are for. It only stops a Bengali transcript
 * from silently degrading into "no terms at all".
 */
export function extractSearchTerms(userQuery: string): string[] {
  return userQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/** RAG Search: Retrieve top candidate products matching user query keywords for compressed LLM prompt */
export async function searchMariaDbProducts(userQuery: string, limit = 10): Promise<WcProduct[]> {
  const all = await fetchMariaDbProducts();
  if (!userQuery || userQuery.trim().length === 0) {
    return all.slice(0, limit);
  }

  const terms = extractSearchTerms(userQuery);

  if (terms.length === 0) {
    console.warn("Product search found no usable terms; returning unranked catalog slice", {
      userQuery,
    });
    return all.slice(0, limit);
  }

  const scored = all.map((p) => {
    const text = `${p.name} ${p.sku} ${p.brand}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score += 1;
    }
    return { product: p, score };
  });

  const matches = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (matches.length > 0) {
    return matches.slice(0, limit).map((m) => m.product);
  }

  // Returning arbitrary products silently is how a mis-scripted transcript turns
  // into a confidently wrong draft order. Make it visible.
  console.warn("Product search matched nothing; returning unranked catalog slice", {
    userQuery,
    terms,
  });
  return all.slice(0, limit);
}
