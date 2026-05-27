"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import { Button, Dialog, SelectInput, TextareaInput, TextInput } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { ROUTES } from "@/constants/routes";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatStockQuantity } from "@/utils/inventoryDisplay";
import { mc } from "@/utils/mc";

type OptionRecord = { id: string; name: string };
type ProductOption = { id: string; name: string; sku: string; unit: string };
type StockRecord = { currentStock: number; warehouseId: string; warehouseName: string };

type TransferItem = { productId: string; quantity: number };

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

function useProductOptions() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.products.search.get({
        query: { isActive: "true", limit: "200", page: "1", sortBy: "name" },
      });
      if (response.error) throw response.error;

      return response.data.data as ProductOption[];
    },
    queryKey: ["products", "options-with-unit"],
  });
}

function useProductStock(productId: string, warehouseId: string) {
  return useQuery({
    enabled: Boolean(productId) && Boolean(warehouseId),
    queryFn: async () => {
      const response = await eden.api.v1.stock.products({ productId }).get();
      if (response.error) throw response.error;

      return response.data as StockRecord[];
    },
    queryKey: ["product-stock", productId, warehouseId],
  });
}

function ItemRow({
  index,
  item,
  onQuantityChange,
  onProductChange,
  onRemove,
  productOptions,
  sourceWarehouseId,
}: {
  index: number;
  item: TransferItem;
  onQuantityChange: (quantity: number) => void;
  onProductChange: (productId: string) => void;
  onRemove: () => void;
  productOptions: ProductOption[];
  sourceWarehouseId: string;
}) {
  const stockQuery = useProductStock(item.productId, sourceWarehouseId);
  const available = stockQuery.data?.find((s) => s.warehouseId === sourceWarehouseId)?.currentStock ?? 0;
  const selectedProduct = productOptions.find((p) => p.id === item.productId);
  const isOverStock = item.quantity > available && available > 0;

  const options = productOptions.map((p) => ({
    label: `${p.sku} - ${p.name}`,
    value: p.id,
  }));

  return (
    <article className="grid gap-3 rounded-lg border border-border-default p-4 md:grid-cols-[1fr_160px_160px_auto]">
      <SelectInput
        id={`item-product-${index}`}
        label="Produk"
        onValueChange={onProductChange}
        options={options}
        required
        searchable
        value={item.productId}
      />
      <TextInput
        disabled
        id={`item-available-${index}`}
        label="Stok Tersedia"
        value={item.productId ? formatStockQuantity(available, selectedProduct?.unit ?? "unit") : "-"}
      />
      <section>
        <TextInput
          errorMessage={isOverStock ? "Melebihi stok tersedia." : undefined}
          id={`item-quantity-${index}`}
          label="Jumlah"
          min={1}
          onChange={(e) => onQuantityChange(Number(e.target.value))}
          required
          type="number"
          value={item.quantity}
        />
      </section>
      <section className="flex items-end pb-0.5">
        <Button
          aria-label="Hapus item"
          onClick={onRemove}
          size="icon"
          type="button"
          variant="secondary"
        >
          <Minus className="size-4" />
        </Button>
      </section>
    </article>
  );
}

/**
 * Create transfer page.
 */
export default function TransferCreatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const warehousesQuery = useWarehouseOptions();
  const productsQuery = useProductOptions();
  const warehouses = warehousesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const [items, setItems] = useState<TransferItem[]>([{ productId: "", quantity: 1 }]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<{
    destinationWarehouseId: string;
    notes: string;
    sourceWarehouseId: string;
  } | null>(null);

  const warehouseOptions = warehouses.map((w) => ({ label: w.name, value: w.id }));

  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destWarehouseId, setDestWarehouseId] = useState("");

  const mutation = useMutation({
    mutationFn: async (value: {
      destinationWarehouseId: string;
      items: TransferItem[];
      notes: string;
      sourceWarehouseId: string;
    }) => {
      const response = await eden.api.v1.transfers.post({
        destinationWarehouseId: value.destinationWarehouseId,
        items: value.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        notes: value.notes || null,
        sourceWarehouseId: value.sourceWarehouseId,
      });
      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["product-stock"] });
      toast.success("Transfer berhasil dibuat.");
      router.push(`${ROUTES.TRANSFERS}/${(data as { id: string }).id}`);
    },
  });

  const form = useForm({
    defaultValues: {
      destinationWarehouseId: "",
      notes: "",
      sourceWarehouseId: "",
    },
    onSubmit: async ({ value }) => {
      const validItems = items.filter((i) => i.productId && i.quantity > 0);
      if (validItems.length === 0) {
        toast.error("Minimal satu item transfer harus dipilih.");
        return;
      }
      setPendingValues({ ...value, notes: value.notes });
      setConfirmOpen(true);
    },
  });

  const isSameWarehouse = sourceWarehouseId && destWarehouseId && sourceWarehouseId === destWarehouseId;

  const addItem = () => setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const sourceWarehouse = warehouses.find((w) => w.id === sourceWarehouseId);
  const destWarehouse = warehouses.find((w) => w.id === destWarehouseId);

  const errorMessage = mutation.error
    ? getErrorMessage(mutation.error, "Transfer gagal dibuat.")
    : null;

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Buat Transfer | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Buat Transfer</h1>
        <p className="ts-sm text-text-muted">
          Pindahkan stok dari satu gudang ke gudang lain.
        </p>
      </header>

      <form
        className="grid max-w-3xl gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        {errorMessage ? (
          <section className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-danger">
            <p className="ts-sm font-medium">{errorMessage}</p>
          </section>
        ) : null}

        <section className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <h2 className="ts-lg mb-4 font-semibold text-text-strong">Gudang</h2>
          <section className="grid gap-4 md:grid-cols-2">
            <form.Field
              name="sourceWarehouseId"
              validators={{ onChange: ({ value }) => (!value ? "Gudang asal wajib dipilih." : undefined) }}
            >
              {(field) => (
                <SelectInput
                  errorMessage={getFieldError(field.state.meta.errors)}
                  id="transfer-source-warehouse"
                  label="Gudang Asal"
                  onBlur={field.handleBlur}
                  onValueChange={(v) => { field.handleChange(v); setSourceWarehouseId(v); }}
                  options={warehouseOptions}
                  required
                  searchable
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field
              name="destinationWarehouseId"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Gudang tujuan wajib dipilih.";
                  if (value === sourceWarehouseId) return "Gudang tujuan tidak boleh sama dengan gudang asal.";

                  return undefined;
                },
              }}
            >
              {(field) => (
                <SelectInput
                  errorMessage={getFieldError(field.state.meta.errors)}
                  id="transfer-dest-warehouse"
                  label="Gudang Tujuan"
                  onBlur={field.handleBlur}
                  onValueChange={(v) => { field.handleChange(v); setDestWarehouseId(v); }}
                  options={warehouseOptions}
                  required
                  searchable
                  value={field.state.value}
                />
              )}
            </form.Field>
          </section>
          {isSameWarehouse ? (
            <p className="ts-sm mt-3 text-danger">Gudang asal dan tujuan tidak boleh sama.</p>
          ) : null}
          {sourceWarehouse && destWarehouse && !isSameWarehouse ? (
            <section className="mt-4 flex items-center gap-3 rounded-lg bg-muted-surface px-4 py-3">
              <span className="ts-sm font-medium text-text-strong">{sourceWarehouse.name}</span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
              <span className="ts-sm font-medium text-text-strong">{destWarehouse.name}</span>
            </section>
          ) : null}
        </section>

        <section className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 className="ts-lg font-semibold text-text-strong">Item Transfer</h2>
            <Button
              leftIcon={<Plus />}
              onClick={addItem}
              size="sm"
              type="button"
              variant="secondary"
            >
              Tambah Item
            </Button>
          </header>
          <section className="grid gap-3">
            {items.map((item, index) => (
              <ItemRow
                index={index}
                item={item}
                key={index}
                onProductChange={(productId) => {
                  setItems((prev) => prev.map((it, i) => (i === index ? { ...it, productId } : it)));
                }}
                onQuantityChange={(quantity) => {
                  setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity } : it)));
                }}
                onRemove={() => removeItem(index)}
                productOptions={products}
                sourceWarehouseId={sourceWarehouseId}
              />
            ))}
          </section>
        </section>

        <form.Field name="notes">
          {(field) => (
            <TextareaInput
              id="transfer-notes"
              label="Catatan"
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              disabled={!canSubmit || isSubmitting || Boolean(isSameWarehouse)}
              leftIcon={<Send />}
              type="submit"
            >
              {isSubmitting ? "Memproses..." : "Buat Transfer"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <Dialog
        description="Transfer ini akan mengurangi stok gudang asal dan menambah stok gudang tujuan secara permanen."
        id="confirm-transfer-dialog"
        onClose={() => setConfirmOpen(false)}
        open={confirmOpen}
        title="Konfirmasi Transfer"
      >
        <section className="grid gap-4">
          <section className="rounded-lg bg-muted-surface px-4 py-3">
            <p className="ts-sm text-text-muted">
              Dari: <span className="font-medium text-text-strong">{sourceWarehouse?.name}</span>
            </p>
            <p className="ts-sm text-text-muted">
              Ke: <span className="font-medium text-text-strong">{destWarehouse?.name}</span>
            </p>
            <p className="ts-sm text-text-muted">
              Jumlah item: <span className="font-medium text-text-strong">{items.filter((i) => i.productId).length}</span>
            </p>
          </section>
          <section className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                if (!pendingValues) return;
                const validItems = items.filter((i) => i.productId && i.quantity > 0);
                mutation.mutate({ ...pendingValues, items: validItems });
                setConfirmOpen(false);
              }}
              type="button"
            >
              {mutation.isPending ? "Memproses..." : "Ya, Buat Transfer"}
            </Button>
            <Button
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="secondary"
            >
              Batal
            </Button>
          </section>
        </section>
      </Dialog>
    </section>
  );
}
