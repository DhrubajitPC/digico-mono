# WhatsApp webhook (local)

Minimal receive-only webhook for Meta WhatsApp Cloud API.

## Setup

```bash
# from repo root
vp install
cp apps/whatsapp-webhook/.env.example apps/whatsapp-webhook/.env
```

Fill in `.env`:

| Variable                   | Where                                             |
| -------------------------- | ------------------------------------------------- |
| `WHATSAPP_VERIFY_TOKEN`    | Any secret you invent (same in Meta webhook)      |
| `WHATSAPP_ACCESS_TOKEN`    | Meta → WhatsApp → API Setup                       |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta → WhatsApp → API Setup                       |
| `DEEPSEEK_API_KEY`         | https://platform.deepseek.com/api_keys            |
| `DEEPSEEK_MODEL`           | optional, default `deepseek-chat`                 |
| `ELEVENLABS_API_KEY`       | https://elevenlabs.io/app/settings/api-keys (STT) |
| `ELEVENLABS_STT_MODEL`     | optional, default `scribe_v2`                     |
| `ELEVENLABS_STT_LANGUAGE`  | optional, leave unset for auto-detect             |

Install ngrok if needed:

```bash
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken <your-ngrok-token>
```

## Run

Terminal 1 — webhook server:

```bash
vp run whatsapp-webhook#dev
# or from repo root: pnpm whatsapp
```

Terminal 2 — public HTTPS tunnel:

```bash
ngrok http 8787
```

Copy the `https://....ngrok-free.app` URL.

## Meta Developer Console

1. App → **WhatsApp** → **Configuration** → Webhook
2. Callback URL: `https://<ngrok-host>/webhook`
3. Verify token: same value as `WHATSAPP_VERIFY_TOKEN` in `.env`
4. Verify and save
5. Subscribe to the **messages** field

## Test

Send a text to your WhatsApp Business number. The server should log:

```json
{
  "messageId": "wamid....",
  "from": "8801........",
  "text": "whatever the dealer typed",
  "timestamp": "....",
  "contactName": "...",
  "phoneNumberId": "...."
}
```

Local health check: `curl http://localhost:8787/health`
