import type mysql from "mysql2/promise";
import { getMariaDbPool } from "./client.ts";

export interface WcProduct {
  id: number;
  sku: string;
  brand: string;
  name: string;
  category: string;
  model: string | null;
  specifications: string | null;
  unitPrice: number;
  stockQuantity: number;
  aliases: string[];
}

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

  return (rows || []).map((r: any) => ({
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

/** RAG Search: Retrieve top candidate products matching user query keywords for compressed LLM prompt */
export async function searchMariaDbProducts(userQuery: string, limit = 10): Promise<WcProduct[]> {
  const all = await fetchMariaDbProducts();
  if (!userQuery || userQuery.trim().length === 0) {
    return all.slice(0, limit);
  }

  const stopWords = new Set([
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

  const terms = userQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  if (terms.length === 0) {
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

  return all.slice(0, limit);
}
