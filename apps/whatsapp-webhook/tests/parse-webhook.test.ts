import { expect, test } from "vite-plus/test";
import { parseIncomingMessages } from "../src/parse-webhook.ts";

const sampleTextPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA_ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550001111",
              phone_number_id: "PHONE_NUMBER_ID",
            },
            contacts: [
              {
                profile: { name: "Rahim" },
                wa_id: "8801700000001",
              },
            ],
            messages: [
              {
                from: "8801700000001",
                id: "wamid.TEST123",
                timestamp: "1721650000",
                type: "text",
                text: { body: "Bhai HP i5 laptop ase?" },
              },
            ],
          },
        },
      ],
    },
  ],
};

test("parses inbound text messages into a clean object", () => {
  const messages = parseIncomingMessages(sampleTextPayload);
  expect(messages).toEqual([
    {
      messageId: "wamid.TEST123",
      from: "8801700000001",
      timestamp: "1721650000",
      contactName: "Rahim",
      phoneNumberId: "PHONE_NUMBER_ID",
      kind: "text",
      text: "Bhai HP i5 laptop ase?",
      audio: null,
    },
  ]);
});

test("parses inbound audio / voice notes", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "PHONE_NUMBER_ID" },
              contacts: [{ profile: { name: "Rahim" }, wa_id: "8801700000001" }],
              messages: [
                {
                  from: "8801700000001",
                  id: "wamid.AUDIO1",
                  timestamp: "1721650002",
                  type: "audio",
                  audio: {
                    id: "MEDIA123",
                    mime_type: "audio/ogg; codecs=opus",
                    voice: true,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  expect(parseIncomingMessages(payload)).toEqual([
    {
      messageId: "wamid.AUDIO1",
      from: "8801700000001",
      timestamp: "1721650002",
      contactName: "Rahim",
      phoneNumberId: "PHONE_NUMBER_ID",
      kind: "audio",
      text: null,
      audio: {
        mediaId: "MEDIA123",
        mimeType: "audio/ogg; codecs=opus",
        voice: true,
      },
    },
  ]);
});

test("ignores delivery status updates", () => {
  const statusOnly = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "PHONE_NUMBER_ID" },
              statuses: [
                {
                  id: "wamid.STATUS",
                  status: "delivered",
                  timestamp: "1721650001",
                  recipient_id: "8801700000001",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  expect(parseIncomingMessages(statusOnly)).toEqual([]);
});

test("returns empty for unrelated payloads", () => {
  expect(parseIncomingMessages(null)).toEqual([]);
  expect(parseIncomingMessages({ object: "something_else" })).toEqual([]);
});
