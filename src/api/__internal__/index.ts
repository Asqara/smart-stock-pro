import "server-only";

import { Elysia } from "elysia";

import { dokuWebhookController } from "./webhooks/doku";
import { duitkuWebhookController } from "./webhooks/duitku";
import { midtransWebhookController } from "./webhooks/midtrans";
import { xenditWebhookController } from "./webhooks/xendit";

/**
 * Internal API. Not version-gated, not published in client docs.
 */
export const internalApi = new Elysia({ prefix: "/__internal__" })
  .get("/health", () => ({ ok: true, ts: new Date().toISOString() }))
  .use(midtransWebhookController)
  .use(xenditWebhookController)
  .use(duitkuWebhookController)
  .use(dokuWebhookController);
