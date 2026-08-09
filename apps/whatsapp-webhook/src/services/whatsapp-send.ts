export async function sendWhatsAppText(
  to: string,
  body: string,
  isEmulator = false,
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (isEmulator || !token || !phoneId) {
    console.log(`[EMULATOR] Simulated WhatsApp send to ${to}: ${body}`);
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const res = await fetch(url, {
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
      text: { body },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp send API error (${res.status}): ${text}`);
  }
}
