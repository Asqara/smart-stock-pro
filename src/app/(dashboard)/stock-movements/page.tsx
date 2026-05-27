"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Filter, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  DataTable,
  DataTableShell,
  DateInput,
  Dialog,
  Pagination,
  SelectInput,
  StatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
  TextareaInput,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDateTime, formatStockQuantity } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";

type MovementRecord = {
  createdAt: Date | string;
  createdBy: string | null;
  id: string;
  notes: string | null;
  productName: string;
  productSku: string;
  quantity: number;
  type: "IN" | "OUT" | "TRANSFER_OUT" | "TRANSFER_IN" | "IMPORT" | "ADJUSTMENT";
  warehouseName: string;
};

type MovementFilters = {
  dateFrom: string;
  dateTo: string;
  type: string;
};

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

function useMovements(page: number, filters: MovementFilters) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.stock.movements.get({
        query: {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          limit: "10",
          page: String(page),
          sortBy: "createdAt",
          sortDir: "desc",
          type: filters.type,
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["stock-movements", page, filters],
  });
}

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

function MovementFilterForm({
  filters,
  onApply,
  onReset,
}: {
  filters: MovementFilters;
  onApply: (filters: MovementFilters) => void;
  onReset: () => void;
}) {
  const form = useForm({
    defaultValues: {
      dateRange: { from: filters.dateFrom, to: filters.dateTo },
      type: filters.type,
    },
    onSubmit: ({ value }) =>
      onApply({
        dateFrom: value.dateRange.from,
        dateTo: value.dateRange.to,
        type: value.type,
      }),
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[180px_280px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="type">
        {(field) => (
          <SelectInput
            id="movement-type-filter"
            label="Tipe"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={[
              { label: "Semua", value: "" },
              { label: "IN", value: "IN" },
              { label: "OUT", value: "OUT" },
              { label: "TRANSFER IN", value: "TRANSFER_IN" },
              { label: "TRANSFER OUT", value: "TRANSFER_OUT" },
              { label: "IMPORT", value: "IMPORT" },
              { label: "ADJUSTMENT", value: "ADJUSTMENT" },
            ]}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="dateRange">
        {(field) => (
          <DateInput
            id="movement-date-filter"
            label="Rentang Tanggal"
            mode="range"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>
      <section className="flex items-end gap-2">
        <Button leftIcon={<Filter />} type="submit">
          Terapkan
        </Button>
        <Button leftIcon={<RotateCcw />} onClick={onReset} type="button" variant="secondary" />
      </section>
    </form>
  );
}

function StockInDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
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
      onOpenChange(false);
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
    <Dialog
      className="max-w-2xl"
      description="Stock in membuat movement IN dan batch stok baru."
      id="stock-in-dialog"
      onClose={() => onOpenChange(false)}
      open={open}
      title="Buat Stock In"
    >
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
                id="movement-stock-in-product"
                label="Produk"
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                options={productOptions}
                required
                searchable
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="warehouseId" validators={{ onChange: ({ value }) => (!value ? "Gudang wajib dipilih." : undefined) }}>
            {(field) => (
              <SelectInput
                errorMessage={getFieldError(field.state.meta.errors)}
                id="movement-stock-in-warehouse"
                label="Gudang"
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                options={warehouseOptions}
                required
                searchable
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="quantity" validators={{ onChange: ({ value }) => (value <= 0 ? "Jumlah harus lebih dari 0." : undefined) }}>
            {(field) => (
              <TextInput
                errorMessage={getFieldError(field.state.meta.errors)}
                id="movement-stock-in-quantity"
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
                id="movement-stock-in-unit-cost"
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
                id="movement-stock-in-received-at"
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
              id="movement-stock-in-notes"
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
    </Dialog>
  );
}

function StockOutDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const productsQuery = useProductOptions();
  const warehousesQuery = useWarehouseOptions();
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const productStockQuery = useProductStock(selectedProductId);
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
      onOpenChange(false);
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
    <Dialog
      className="max-w-2xl"
      description="Stock out selalu memakai FIFO dan menolak transaksi jika stok tidak cukup."
      id="stock-out-dialog"
      onClose={() => onOpenChange(false)}
      open={open}
      title="Buat Stock Out"
    >
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
                id="movement-stock-out-product"
                label="Produk"
                onBlur={field.handleBlur}
                onValueChange={(value) => {
                  field.handleChange(value);
                  setSelectedProductId(value);
                }}
                options={productOptions}
                required
                searchable
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="warehouseId" validators={{ onChange: ({ value }) => (!value ? "Gudang wajib dipilih." : undefined) }}>
            {(field) => (
              <SelectInput
                errorMessage={getFieldError(field.state.meta.errors)}
                id="movement-stock-out-warehouse"
                label="Gudang"
                onBlur={field.handleBlur}
                onValueChange={(value) => {
                  field.handleChange(value);
                  setSelectedWarehouseId(value);
                }}
                options={warehouseOptions}
                required
                searchable
                value={field.state.value}
              />
            )}
          </form.Field>
          <TextInput
            disabled
            id="movement-stock-out-available"
            label="Available Stock"
            value={formatStockQuantity(selectedWarehouseStock, "unit")}
          />
          <form.Field name="quantity" validators={{ onChange: ({ value }) => (value <= 0 ? "Jumlah harus lebih dari 0." : undefined) }}>
            {(field) => (
              <TextInput
                errorMessage={getFieldError(field.state.meta.errors)}
                id="movement-stock-out-quantity"
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
              id="movement-stock-out-notes"
              label="Catatan"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        <section className="rounded-lg border border-border-default bg-muted-surface p-4">
          <p className="ts-sm text-text-muted">
            FIFO memakai batch tertua terlebih dahulu. Detail batch tetap bisa dicek di detail produk.
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
    </Dialog>
  );
}

/**
 * Stock movement history page.
 */
export default function StockMovementsPage() {
  const [page, setPage] = useState(1);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [filters, setFilters] = useState<MovementFilters>({
    dateFrom: "",
    dateTo: "",
    type: "",
  });
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreateStockIn = user ? hasPermission(user.role, "stock.in") : false;
  const canCreateStockOut = user ? hasPermission(user.role, "stock.out") : false;
  const movementsQuery = useMovements(page, filters);
  const movements = (movementsQuery.data?.data ?? []) as MovementRecord[];
  const pagination = movementsQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = movements.map((movement) => (
    <TableRow key={movement.id}>
      <TableCell className="ts-mono-xs">{formatDateTime(movement.createdAt)}</TableCell>
      <TableCell>
        <section className="grid gap-1">
          <span className="font-medium text-text-strong">{movement.productName}</span>
          <span className="ts-mono-xs text-text-muted">{movement.productSku}</span>
        </section>
      </TableCell>
      <TableCell>{movement.warehouseName}</TableCell>
      <TableCell>
        <StatusBadge
          label={movement.type}
          tone={
            movement.type === "IN" || movement.type === "TRANSFER_IN" || movement.type === "IMPORT"
              ? "success"
              : movement.type === "OUT" || movement.type === "TRANSFER_OUT"
                ? "warning"
                : "neutral"
          }
        />
      </TableCell>
      <TableCell>{formatStockQuantity(movement.quantity, "unit")}</TableCell>
      <TableCell>{movement.createdBy ?? "-"}</TableCell>
      <TableCell>{movement.notes ?? "-"}</TableCell>
    </TableRow>
  ));
  let tableBody = rows;

  if (rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={7}>
          Belum ada stock movement yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  let actionButtons = null;

  if (canCreateStockIn || canCreateStockOut) {
    actionButtons = (
      <section className="flex flex-wrap items-end gap-2">
        {canCreateStockIn ? (
          <Button
            leftIcon={<ArrowDownToLine />}
            onClick={() => setStockInOpen(true)}
            type="button"
          >
            Stock In
          </Button>
        ) : null}
        {canCreateStockOut ? (
          <Button
            leftIcon={<ArrowUpFromLine />}
            onClick={() => setStockOutOpen(true)}
            type="button"
            variant="secondary"
          >
            Stock Out
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Stock Movements | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Stock Movements</h1>
        <p className="ts-sm text-text-muted">
          Riwayat perubahan stok dari stock in dan stock out.
        </p>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} movement tercatat.`}
        footer={<Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />}
        title="Riwayat Movement"
        toolbar={
          <section className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <MovementFilterForm
              filters={filters}
              onApply={(nextFilters) => {
                setPage(1);
                setFilters(nextFilters);
              }}
              onReset={() => {
                setPage(1);
                setFilters({ dateFrom: "", dateTo: "", type: "" });
              }}
            />
            {actionButtons}
          </section>
        }
      >
        <DataTable dense>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Gudang</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Dibuat Oleh</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <StockInDialog onOpenChange={setStockInOpen} open={stockInOpen} />
      <StockOutDialog onOpenChange={setStockOutOpen} open={stockOutOpen} />
    </section>
  );
}
