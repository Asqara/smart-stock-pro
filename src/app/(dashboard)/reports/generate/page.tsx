"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Helmet } from "react-helmet-async";

import { Button, SelectInput } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { ROUTES } from "@/constants/routes";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";

const REPORT_TYPE_OPTIONS = [
  { label: "Ringkasan Inventaris", value: "INVENTORY_SUMMARY" },
  { label: "Pergerakan Stok", value: "STOCK_MOVEMENT" },
  { label: "Laporan Transfer", value: "TRANSFER_REPORT" },
  { label: "Laporan Stok Rendah", value: "LOW_STOCK_REPORT" },
];

const FORMAT_OPTIONS = [
  { label: "PDF", value: "PDF" },
  { label: "CSV", value: "CSV" },
];

// 🔥 konstanta biar ga magic string
const ALL_WAREHOUSE = "ALL";

function useWarehouseOptions() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.warehouses.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) throw response.error;

      return (response.data.data as { id: string; name: string }[]).map(
        (w) => ({
          label: w.name,
          value: w.id,
        })
      );
    },
    queryKey: ["warehouses", "options"],
  });
}

export default function ReportGeneratePage() {
  const router = useRouter();
  const warehousesQuery = useWarehouseOptions();

  // ✅ Tambahin ALL di paling atas
  const warehouseOptions = [
    { label: "Semua Gudang", value: ALL_WAREHOUSE },
    ...(warehousesQuery.data ?? []),
  ];

  const mutation = useMutation({
    mutationFn: async (value: {
      filters: { warehouseId: string };
      outputFormat: string;
      reportType: string;
    }) => {
      const warehouseId =
        value.filters.warehouseId === ALL_WAREHOUSE
          ? null
          : value.filters.warehouseId || null;

      const response = await eden.api.v1.reports.generate.post({
        filters: { warehouseId },
        outputFormat: value.outputFormat as "PDF" | "CSV",
        reportType: value.reportType as any,
      });

      if (response.error) throw response.error;

      return response.data;
    },

    onError: (error) => {
      toast.error(getErrorMessage(error, "Laporan gagal dibuat."));
    },

    onSuccess: () => {
      toast.success(
        "Laporan sedang dibuat. Anda dapat memantau progresnya di halaman laporan."
      );
      router.push(ROUTES.REPORTS.INDEX);
    },
  });

  const form = useForm({
    defaultValues: {
      filters: {
        // ✅ default langsung ALL
        warehouseId: ALL_WAREHOUSE,
      },
      outputFormat: "PDF",
      reportType: "INVENTORY_SUMMARY",
    },

    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <section className="grid max-w-3xl gap-6">
      <Helmet>
        <title>Generate Laporan | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>

      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Generate Laporan</h1>
        <p className="ts-sm text-text-muted">
          Laporan akan dibuat di background. Anda dapat mengunduhnya setelah selesai.
        </p>
      </header>

      <form
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <h2 className="ts-lg mb-4 font-semibold text-text-strong">
            Konfigurasi Laporan
          </h2>

          <section className="grid gap-4 md:grid-cols-2">
            {/* REPORT TYPE */}
            <form.Field name="reportType">
              {(field) => (
                <SelectInput
                  id="report-type"
                  label="Tipe Laporan"
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  options={REPORT_TYPE_OPTIONS}
                  required
                  value={field.state.value}
                />
              )}
            </form.Field>

            {/* FORMAT */}
            <form.Field name="outputFormat">
              {(field) => (
                <SelectInput
                  id="report-format"
                  label="Format Output"
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  options={FORMAT_OPTIONS}
                  required
                  value={field.state.value}
                />
              )}
            </form.Field>

            {/* WAREHOUSE */}
            <form.Field name="filters.warehouseId">
              {(field) => (
                <SelectInput
                  id="report-warehouse"
                  label="Gudang"
                  onBlur={field.handleBlur}
                  onValueChange={field.handleChange}
                  options={warehouseOptions}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </section>
        </article>

        <section className="rounded-lg border border-border-default bg-muted-surface px-4 py-3">
          <p className="ts-sm text-text-muted">
            Laporan besar akan diproses di background dan tidak akan memblokir UI.
            Anda akan mendapat notifikasi saat laporan siap.
          </p>
        </section>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              disabled={!canSubmit || isSubmitting}
              leftIcon={<FileText />}
              type="submit"
            >
              {isSubmitting ? "Memproses..." : "Generate Laporan"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </section>
  );
}