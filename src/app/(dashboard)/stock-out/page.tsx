"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpFromLine } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SelectInput,
  TextInput,
  TextareaInput,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatStockQuantity } from "@/utils/inventoryDisplay";

type OptionRecord = {
  id: string;
  name: string;
  sku?: string;
};

type ProductWarehouseStock = {
  currentStock: number;
  warehouseId: string;
  warehouseName: string;
};

function useProductOptions() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.products.search.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data.data as OptionRecord[];
    },
    queryKey: ["products", "options"],
  });
}

function useWarehouseOptions() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.warehouses.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data.data as OptionRecord[];
    },
    queryKey: ["warehouses", "options"],
  });
}

function useProductStock(productId: string) {
  return useQuery({
    enabled: Boolean(productId),
    queryFn: async () => {
      const response = await eden.api.v1.stock.products({ productId }).get();

      if (response.error) throw response.error;

      return response.data as ProductWarehouseStock[];
    },
    queryKey: ["product-stock", productId],
  });
}

/**
 * Stock out transaction form.
 */
export default function StockOutPage() {
  const productsQuery = useProductOptions();
  const warehousesQuery = useWarehouseOptions();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const productStockQuery = useProductStock(selectedProductId);
  const queryClient = useQueryClient();
  const products = productsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const selectedWarehouseStock =
    productStockQuery.data?.find(
      (row) => row.warehouseId === selectedWarehouseId,
    )?.currentStock ?? 0;
  const mutation = useMutation({
    mutationFn: async (value: {
      notes: string;
      productId: string;
      quantity: number;
      warehouseId: string;
    }) => {
      const response = await eden.api.v1.stock.out.post({
        ...value,
        notes: value.notes || null,
        quantity: Number(value.quantity),
        valuationMethod: "FIFO",
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock"] });
      toast.success("Stock out FIFO berhasil dibuat.");
    },
  });
  const form = useForm({
    defaultValues: {
      notes: "",
      productId: "",
      quantity: 1,
      warehouseId: "",
    },
    onSubmit: async ({ value }) => {
      if (value.quantity > selectedWarehouseStock) {
        toast.error("Jumlah keluar melebihi stok tersedia.");
        return;
      }

      await mutation.mutateAsync(value);
      form.reset();
      setSelectedProductId("");
      setSelectedWarehouseId("");
    },
  });
  const productOptions = products.map((product) => ({
    label: product.sku ? `${product.sku} - ${product.name}` : product.name,
    value: product.id,
  }));
  const warehouseOptions = warehouses.map((warehouse) => ({
    label: warehouse.name,
    value: warehouse.id,
  }));
  const errorMessage = mutation.error
    ? getErrorMessage(mutation.error, "Stock out gagal dibuat.")
    : null;
  let errorNode = null;

  if (errorMessage) {
    errorNode = (
      <section className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-danger">
        <p className="ts-sm font-medium">{errorMessage}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Stock Out | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Stock Out</h1>
        <p className="ts-sm text-text-muted">
          Stock out mengurangi batch berdasarkan FIFO secara default.
        </p>
      </header>
      <Card className="ssp-form-panel">
        <CardHeader>
          <CardTitle>Form Stock Out</CardTitle>
          <CardDescription>
            Sistem menolak transaksi jika stok gudang tidak cukup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            {errorNode}
            <section className="grid gap-4 md:grid-cols-2">
              <form.Field name="productId" validators={{ onChange: ({ value }) => (!value ? "Produk wajib dipilih." : undefined) }}>
                {(field) => (
                  <SelectInput
                    errorMessage={getFieldError(field.state.meta.errors)}
                    id="stock-out-product"
                    label="Produk"
                    onBlur={field.handleBlur}
                    onValueChange={(value) => {
                      field.handleChange(value);
                      setSelectedProductId(value);
                    }}
                    options={productOptions}
                    required
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <form.Field name="warehouseId" validators={{ onChange: ({ value }) => (!value ? "Gudang wajib dipilih." : undefined) }}>
                {(field) => (
                  <SelectInput
                    errorMessage={getFieldError(field.state.meta.errors)}
                    id="stock-out-warehouse"
                    label="Gudang"
                    onBlur={field.handleBlur}
                    onValueChange={(value) => {
                      field.handleChange(value);
                      setSelectedWarehouseId(value);
                    }}
                    options={warehouseOptions}
                    required
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <TextInput
                disabled
                id="stock-out-available"
                label="Available Stock"
                value={formatStockQuantity(selectedWarehouseStock, "unit")}
              />
              <form.Field name="quantity" validators={{ onChange: ({ value }) => (value <= 0 ? "Jumlah harus lebih dari 0." : undefined) }}>
                {(field) => (
                  <TextInput
                    errorMessage={getFieldError(field.state.meta.errors)}
                    id="stock-out-quantity"
                    label="Jumlah"
                    min={1}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                    required
                    type="number"
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </section>
            <form.Field name="notes">
              {(field) => (
                <TextareaInput
                  id="stock-out-notes"
                  label="Catatan"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <section className="rounded-lg border border-border-default bg-muted-surface p-4">
              <p className="ts-sm text-text-muted">
                Preview FIFO memakai batch tertua terlebih dahulu. Detail batch dapat dilihat di halaman detail produk.
              </p>
            </section>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button disabled={!canSubmit || isSubmitting} leftIcon={<ArrowUpFromLine />} type="submit">
                  {isSubmitting ? "Menyimpan..." : "Buat Stock Out"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
