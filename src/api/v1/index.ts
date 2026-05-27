import { Elysia } from "elysia";

import { auditLogsController } from "./audit-logs";
import { authController } from "./auth";
import { categoriesController } from "./categories";
import { dashboardController } from "./dashboard";
import { importsController } from "./imports";
import { jobsController } from "./jobs";
import { monitoringController } from "./monitoring";
import { profileController } from "./profile";
import { productsController } from "./products";
import { reportsController } from "./reports";
import { stockController } from "./stock";
import { suppliersController } from "./suppliers";
import { syncController } from "./sync";
import { transfersController } from "./transfers";
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
  .use(dashboardController)
  .use(importsController)
  .use(jobsController)
  .use(monitoringController)
  .use(profileController)
  .use(productsController)
  .use(reportsController)
  .use(stockController)
  .use(suppliersController)
  .use(syncController)
  .use(transfersController)
  .use(warehousesController);
