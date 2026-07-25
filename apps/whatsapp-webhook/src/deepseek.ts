export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

const SYSTEM_PROMPT = `You are Digico's WhatsApp sales assistant for a technology products distributor in Bangladesh.
Dealers message in Bengali, English, or Banglish — reply in the same mixed style they use.
Be concise (WhatsApp-length). Help them discover products and ask clarifying questions when the model/specs are ambiguous.
You do NOT have live catalog, price, or stock data yet — never invent exact prices or stock counts.
If they ask for price/stock, say you'll check once the catalog is connected, and ask which exact model they mean.`;

/** The exact request messages DeepSeek receives — also used for pipeline logging. */
export function buildChatMessages(userText: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userText },
  ];
}

export function deepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
}

export async function replyWithDeepSeek(userText: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = deepSeekModel();
  const messages = buildChatMessages(userText);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
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
