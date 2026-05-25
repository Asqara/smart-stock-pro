import "server-only";

import { Elysia } from "elysia";

import { adminApi } from "./admin";
import { apiKeysController } from "./api-keys";
import { authController } from "./auth";
import { merchantsController } from "./merchants";
import { ordersController } from "./orders";
import { paymentsController } from "./payments";
import { productsController } from "./products";
import { publicOrdersController } from "./public-orders";
import { transactionsController } from "./transactions";
import { uploadsController } from "./uploads";
import { webhooksController } from "./webhooks";

/**
 * Public versioned API. Mount controllers here as they get built.
 */
export const v1Api = new Elysia({ prefix: "/v1" })
  .get("/ping", () => ({ ok: true }))
  .use(apiKeysController)
  .use(authController)
  .use(merchantsController)
  .use(productsController)
  .use(paymentsController)
  .use(publicOrdersController)
  .use(ordersController)
  .use(transactionsController)
  .use(uploadsController)
  .use(webhooksController)
  .use(adminApi);
