import type { WcDealer, WcProduct } from "@digico/db";

export interface DeepSeekPromptContext {
  products?: WcProduct[];
  dealer?: WcDealer | null;
}

export interface DeepSeekToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface DeepSeekReplyResult {
  text: string;
  toolCalls?: DeepSeekToolCall[];
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

export function buildSystemPrompt(context?: DeepSeekPromptContext): string {
  let prompt = `You are Digico's WhatsApp B2B sales AI assistant for a products distributor in Bangladesh (selling Tech Products, Home Appliances like Conion, Panasonic, Electronics, & Accessories).
Dealers message in Bengali, English, or Banglish — reply in a helpful, concise, and professional sales tone matching their language style.
You HAVE access to Digico's live database catalog & inventory listed below. Use exact prices in BDT (৳) and exact stock quantities from this live catalog. Do NOT say you lack live price/stock data.

CATALOG & BRAND RULES:
1. Digico carries 65+ brands in MariaDB, across home appliances (Conion, Whirlpool, Hitachi, Philips, Panasonic, Sharp, Midea, Haier, Toshiba, Gree) and consumer electronics & accessories (Samsung, Baseus, Yison, Recci, UGREEN, Hisense, LG, Xiaomi, Redmi, TECNO, Sony, boAt).
   Digico does NOT sell laptops or computers. Never offer a brand or product that is absent from the candidate list below — say you will check availability instead of inventing one.
2. If live MariaDB candidate products are provided below, answer based on those candidate products. If a specific product (e.g. Grinder) is not in the list, but other products of that brand (e.g. Conion Sandwich Maker, Conion Toaster, Conion Generator) ARE listed, introduce those available brand products to the dealer instead of claiming the brand is missing.

MULTI-TURN CONVERSATION & FOLLOW-UP ORDERS:
1. Multi-turn conversation history is provided in the chat sequence below. Maintain full context across turns.
2. If the dealer follows up with short quantity requests like "order 5 units", "give me 2", "send 10", "I want 5", or "yes", refer back to the exact product recommended or discussed in the preceding messages.
3. Do NOT ask them to repeat the product name if it was just discussed. Calculate the total price (quantity x unit price) and confirm the order clearly.
4. ALWAYS reply with text. Even when you call the draft_order tool (or emit an [ORDER_DATA] block), include a short natural-language confirmation in the dealer's language stating the product, quantity, unit price, total, and that the order has been recorded for review. Never return a tool call with empty text — the dealer must always receive a visible reply.
5. AUTOMATED ORDER CREATION FOR ORDER DASHBOARD:
   When you summarize/confirm an order (containing product, quantity, unit price, total, customer name/address), ALWAYS call the \`draft_order\` function tool OR append a JSON block at the VERY END of your text formatted as:
   [ORDER_DATA: {"productName": "Product Name", "quantity": 5, "unitPrice": 6890, "totalAmount": 34450, "customerName": "Customer Name", "deliveryAddress": "Address", "phone": "01321321321", "userConfirmation": true}]
   This allows the B2B Order Dashboard to automatically record the order in MariaDB.`;

  if (context?.dealer) {
    prompt += `\n\nCURRENT DEALER / CUSTOMER CONTEXT:
- Business: ${context.dealer.businessName}
- Contact Person: ${context.dealer.contactPerson || context.dealer.businessName}
- Phone: ${context.dealer.phone}
${context.dealer.address ? `- Address: ${context.dealer.address}` : ""}`;
  }

  if (context?.products && context.products.length > 0) {
    prompt += `\n\nLIVE MARIADB / DATABASE PRODUCT CANDIDATES:\n`;
    for (const p of context.products.slice(0, 10)) {
      prompt += `- Product: ${p.name} | SKU: ${p.sku} | Price: ৳${p.unitPrice.toLocaleString()} | Stock Available: ${p.stockQuantity} units\n`;
    }
  }

  return prompt;
}

export function buildChatMessages(
  userText: string,
  context?: DeepSeekPromptContext,
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: buildSystemPrompt(context) },
  ];

  if (chatHistory && chatHistory.length > 0) {
    for (const h of chatHistory) {
      messages.push({ role: h.role, content: h.content });
    }
  }

  const lastHistory = chatHistory?.[chatHistory.length - 1];
  if (!lastHistory || lastHistory.role !== "user" || lastHistory.content !== userText) {
    messages.push({ role: "user", content: userText });
  }

  return messages;
}

export function deepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
}

export async function replyWithDeepSeekFull(
  userText: string,
  context?: DeepSeekPromptContext,
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<DeepSeekReplyResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("Warning: DEEPSEEK_API_KEY is not set — returning simulated DeepSeek reply.");
    return {
      text: `[Joy AI Assistant] Hello! Received your request: "${userText}".\n\n(To connect live Joy AI model completions, add DEEPSEEK_API_KEY to root .env)`,
    };
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL;
  const model = deepSeekModel();
  const messages = buildChatMessages(userText, context, chatHistory);

  const tools = [
    {
      type: "function",
      function: {
        name: "draft_order",
        description:
          "Drafts and confirms a B2B sales order in MariaDB database when customer requests quantity",
        parameters: {
          type: "object",
          properties: {
            productName: { type: "string" },
            quantity: { type: "integer" },
            unitPrice: { type: "number" },
            totalAmount: { type: "number" },
            customerName: { type: "string" },
            deliveryAddress: { type: "string" },
            phone: { type: "string" },
            userConfirmation: { type: "boolean" },
          },
          required: ["productName", "quantity", "unitPrice", "totalAmount"],
        },
      },
    },
  ];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: DeepSeekToolCall[];
      };
    }>;
  };

  const choice = data.choices?.[0]?.message;
  return {
    text: choice?.content ?? "",
    toolCalls: choice?.tool_calls,
  };
}
