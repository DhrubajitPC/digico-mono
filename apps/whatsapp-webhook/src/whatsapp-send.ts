export async function sendWhatsAppText(
  to: string,
  body: string,
  isEmulator = false,
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (
    isEmulator ||
    !token ||
    !phoneNumberId ||
    phoneNumberId === "EMULATOR" ||
    to.includes("EMULATOR")
  ) {
    console.log(`[EMULATOR] Simulated WhatsApp send to ${to}:`, body);
    return;
  }

  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send ${response.status}: ${detail}`);
  }
}
