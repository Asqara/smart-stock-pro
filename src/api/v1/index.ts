import { Elysia } from "elysia";

import { auditLogsController } from "./audit-logs";
import { authController } from "./auth";
import { categoriesController } from "./categories";
import { productsController } from "./products";
import { stockController } from "./stock";
import { suppliersController } from "./suppliers";
import { usersController } from "./users";
import { warehousesController } from "./warehouses";

/**
 * Versioned public API controller.
 */
export const v1Controller = new Elysia()
  .use(authController)
  .use(usersController)
  .use(auditLogsController)
  .use(categoriesController)
  .use(productsController)
  .use(stockController)
  .use(suppliersController)
  .use(warehousesController);
