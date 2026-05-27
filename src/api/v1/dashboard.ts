import { Elysia } from "elysia";

import { Client } from "@/client";
import { Schema } from "@/zod-schemas";

import {
  requireMutationPermission,
  requireReadPermission,
} from "../middlewares/session";

/**
 * Versioned dashboard controller.
 */
export const dashboardController = new Elysia({
  detail: { tags: ["Dashboard"] },
  prefix: "/v1/dashboard",
})
  .get("/summary", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.read_summary");

    return Client.Dashboard.getDashboardSummary(query);
  })
  .get("/stock-trend", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.read_stock_chart");

    return Client.Dashboard.getStockMovementTrend(query);
  })
  .get("/inventory-value", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.read_inventory_value");

    return Client.Dashboard.getInventoryValueSummary(query);
  })
  .get("/stock-by-warehouse", async ({ query, request }) => {
    await requireReadPermission(request, "warehouse.read_stock");

    return Client.Dashboard.getStockByWarehouse(query);
  })
  .get("/low-stock", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.read_alerts");

    return Client.Dashboard.getLowStockProducts(query);
  })
  .get("/critical-stock", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.read_alerts");

    return Client.Dashboard.getCriticalStockProducts(query);
  })
  .get("/recent-movements", async ({ query, request }) => {
    await requireReadPermission(request, "stock.read_movements");

    return Client.Dashboard.getRecentStockMovements(query);
  })
  .get("/recent-transfers", async ({ query, request }) => {
    await requireReadPermission(request, "transfer.read");

    return Client.Dashboard.getRecentTransfers(query);
  })
  .get("/alerts", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.read_alerts");

    return Client.Dashboard.getDashboardAlerts(query);
  })
  .get("/export-data", async ({ query, request }) => {
    await requireReadPermission(request, "dashboard.export_pdf");

    return Client.Dashboard.getDashboardExportData(query);
  })
  .post(
    "/export-pdf",
    async ({ body, request }) => {
      const { session } = await requireMutationPermission(
        request,
        "dashboard.export_pdf",
      );
      const buffer = await Client.Dashboard.generateDashboardPdf(
        body,
        session.user.name,
      );
      const fileName = Client.Dashboard.getDashboardPdfFileName();

      // Return base64 JSON — Eden reads binary streams once and can't re-read them.
      // Decode on client with atob() instead.
      return {
        data: Buffer.from(buffer).toString("base64"),
        fileName,
      };
    },
    {
      body: Schema.Dashboard.ExportPdf,
    },
  );
