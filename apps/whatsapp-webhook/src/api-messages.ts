import type { Db } from "./db/client.ts";
import { getMessageDetail, listMessages } from "./log/message-log.ts";

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

const MAX_LIMIT = 200;

/** GET /api/messages — paginated log, newest first. */
export async function listMessagesForApi(db: Db, params: URLSearchParams) {
  const limit = parsePositiveInt(params.get("limit"));
  return listMessages(db, {
    phone: params.get("phone") ?? undefined,
    status: params.get("status") ?? undefined,
    limit: limit === undefined ? undefined : Math.min(limit, MAX_LIMIT),
    offset: parsePositiveInt(params.get("offset")),
  });
}

/** GET /api/messages/:id — one message plus its AI calls and outbound replies. */
export async function getMessageForApi(db: Db, idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id)) return undefined;
  return getMessageDetail(db, id);
}
