export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface CatalogProductContext {
  id?: number;
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  unitPrice: number;
  stockQuantity: number;
}

export interface DealerContext {
  businessName: string;
  contactPerson?: string | null;
  phone: string;
  address?: string | null;
}

export interface DeepSeekPromptContext {
  products?: CatalogProductContext[];
  dealer?: DealerContext | null;
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

export function buildSystemPrompt(context?: DeepSeekPromptContext): string {
  let prompt = `You are Digico's WhatsApp B2B sales AI assistant for a technology products distributor in Bangladesh.
Dealers message in Bengali, English, or Banglish — reply in a helpful, concise, and professional sales tone matching their language style.
You HAVE access to Digico's live database catalog & inventory listed below. Use exact prices in BDT (৳) and exact stock quantities from this live catalog. Do NOT say you lack live price/stock data.

MULTI-TURN CONVERSATION & FOLLOW-UP ORDERS:
1. Multi-turn conversation history is provided in the chat sequence below. Maintain full context across turns.
2. If the dealer follows up with short quantity requests like "order 5 units", "give me 2", "send 10", "I want 5", or "yes", refer back to the exact product recommended or discussed in the preceding messages (e.g., Panasonic Hair Straightener EH HS70 or Philips BHS397/40).
3. Do NOT ask them to repeat the product name if it was just discussed. Calculate the total price (quantity x unit price) and confirm the order clearly.`;

  if (context?.dealer) {
    prompt += `\n\nCURRENT DEALER / CUSTOMER CONTEXT:
- Business: ${context.dealer.businessName}
- Contact Person: ${context.dealer.contactPerson || context.dealer.businessName}
- Phone: ${context.dealer.phone}
${context.dealer.address ? `- Address: ${context.dealer.address}` : ""}`;
  }

  if (context?.products && context.products.length > 0) {
    prompt += `\n\nLIVE MARIADB / DATABASE PRODUCT CATALOG & INVENTORY:\n`;
    for (const p of context.products.slice(0, 100)) {
      prompt += `- Product: ${p.name} | SKU: ${p.sku} | Price: ৳${p.unitPrice.toLocaleString()} | Stock Available: ${p.stockQuantity} units\n`;
    }
  }

  return prompt;
}

/** The exact request messages DeepSeek receives — also used for pipeline logging. */
export function buildChatMessages(
  userText: string,
  context?: DeepSeekPromptContext,
  history: ChatMessage[] = [],
): ChatMessage[] {
  const systemMsg: ChatMessage = { role: "system", content: buildSystemPrompt(context) };

  // Filter out any empty messages or duplicate current user message at end of history
  const cleanHistory = history.filter(
    (h) => h.content && h.content.trim().length > 0 && h.content !== userText,
  );

  return [systemMsg, ...cleanHistory, { role: "user", content: userText }];
}

export function deepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
}

export async function replyWithDeepSeek(
  userText: string,
  context?: DeepSeekPromptContext,
  history: ChatMessage[] = [],
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn(
      "[DeepSeek] DEEPSEEK_API_KEY is not set in .env. Returning simulated DeepSeek reply.",
    );
    return `[DeepSeek AI Assistant] Hello! Received your request: "${userText}".\n\n(To connect live DeepSeek AI model completions, add DEEPSEEK_API_KEY to apps/whatsapp-webhook/.env)`;
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = deepSeekModel();
  const messages = buildChatMessages(userText, context, history);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DeepSeek ${response.status}: ${detail}`);
  }

  const data: unknown = await response.json();
  const content = extractAssistantContent(data);
  if (!content) {
    throw new Error("DeepSeek returned empty content");
  }
  return content;
}

export function extractAssistantContent(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const choices = "choices" in data ? data.choices : null;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = "message" in first ? first.message : null;
  if (typeof message !== "object" || message === null) return null;
  const content = "content" in message ? message.content : null;
  return typeof content === "string" && content.trim().length > 0 ? content.trim() : null;
}
