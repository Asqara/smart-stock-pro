"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine } from "lucide-react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DateInput,
  SelectInput,
  TextInput,
  TextareaInput,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";

type OptionRecord = {
  id: string;
  name: string;
  sku?: string;
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

/**
 * Stock in transaction form.
 */
export default function StockInPage() {
  const productsQuery = useProductOptions();
  const warehousesQuery = useWarehouseOptions();
  const queryClient = useQueryClient();
  const products = productsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const mutation = useMutation({
    mutationFn: async (value: {
      notes: string;
      productId: string;
      quantity: number;
      receivedAt: string;
      unitCost: number;
      warehouseId: string;
    }) => {
      const response = await eden.api.v1.stock.in.post({
        ...value,
        notes: value.notes || null,
        quantity: Number(value.quantity),
        receivedAt: new Date(value.receivedAt),
        unitCost: Number(value.unitCost),
      });

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      toast.success("Stock in berhasil dibuat.");
    },
  });
  const form = useForm({
    defaultValues: {
      notes: "",
      productId: "",
      quantity: 1,
      receivedAt: new Date().toISOString().slice(0, 10),
      unitCost: 0,
      warehouseId: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
      form.reset();
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
    ? getErrorMessage(mutation.error, "Stock in gagal dibuat.")
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
        <title>Stock In | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Stock In</h1>
        <p className="ts-sm text-text-muted">
          Stock in membuat movement IN dan batch stok baru.
        </p>
      </header>
      <Card className="ssp-form-panel">
        <CardHeader>
          <CardTitle>Form Stock In</CardTitle>
          <CardDescription>
            Gunakan saat barang masuk ke gudang dari supplier.
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
                    id="stock-in-product"
                    label="Produk"
                    onBlur={field.handleBlur}
                    onValueChange={field.handleChange}
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
                    id="stock-in-warehouse"
                    label="Gudang"
                    onBlur={field.handleBlur}
                    onValueChange={field.handleChange}
                    options={warehouseOptions}
                    required
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <form.Field name="quantity" validators={{ onChange: ({ value }) => (value <= 0 ? "Jumlah harus lebih dari 0." : undefined) }}>
                {(field) => (
                  <TextInput
                    errorMessage={getFieldError(field.state.meta.errors)}
                    id="stock-in-quantity"
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
              <form.Field name="unitCost">
                {(field) => (
                  <TextInput
                    id="stock-in-unit-cost"
                    label="Harga Satuan"
                    min={0}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                    required
                    type="number"
                    value={field.state.value}
                  />
                )}
              </form.Field>
              <form.Field name="receivedAt">
                {(field) => (
                  <DateInput
                    id="stock-in-received-at"
                    label="Tanggal Diterima"
                    onBlur={field.handleBlur}
                    onValueChange={field.handleChange}
                    required
                    value={field.state.value}
                  />
                )}
              </form.Field>
            </section>
            <form.Field name="notes">
              {(field) => (
                <TextareaInput
                  id="stock-in-notes"
                  label="Catatan"
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button disabled={!canSubmit || isSubmitting} leftIcon={<ArrowDownToLine />} type="submit">
                  {isSubmitting ? "Menyimpan..." : "Buat Stock In"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
