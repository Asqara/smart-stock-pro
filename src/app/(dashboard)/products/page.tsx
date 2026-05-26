"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Filter, PackagePlus, Power, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  ActionMenu,
  Button,
  DataTable,
  DataTableShell,
  Dialog,
  Pagination,
  SelectInput,
  StockStatusBadge,
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
import type { ProductStockStatus } from "@/constants/inventory";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  formatStockQuantity,
  toStockBadgeStatus,
} from "@/utils/inventoryDisplay";
import { getFieldError } from "@/utils/formErrors";
import { hasPermission } from "@/utils/permissions";
import { useAuth } from "@/hooks/useAuth";

type ProductRecord = {
  category: { id: string; name: string };
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  minimumStock: number;
  name: string;
  price: number;
  sku: string;
  stockStatus: ProductStockStatus;
  supplier: { id: string; name: string };
  totalStock: number;
  unit: string;
};

type OptionRecord = {
  id: string;
  name: string;
  slug?: string;
};

type ProductFilters = {
  categoryId: string;
  search: string;
  stockStatus: string;
  supplierId: string;
};

type ProductFormValue = {
  categoryId: string;
  description: string;
  imageUrl: string;
  minimumStock: number;
  name: string;
  price: number;
  sku: string;
  supplierId: string;
  unit: string;
};

type ProductFormProps = {
  categories: OptionRecord[];
  onDone: () => void;
  product?: ProductRecord | null;
  suppliers: OptionRecord[];
};

function useProducts(page: number, filters: ProductFilters) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.products.get({
        query: {
          categoryId: filters.categoryId,
          limit: "10",
          page: String(page),
          search: filters.search,
          sortBy: "createdAt",
          sortDir: "desc",
          stockStatus: filters.stockStatus,
          supplierId: filters.supplierId,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    queryKey: ["products", page, filters],
  });
}

function useCategories() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.categories.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data.data as OptionRecord[];
    },
    queryKey: ["categories", "options"],
  });
}

function useSuppliers() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.suppliers.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data.data as OptionRecord[];
    },
    queryKey: ["suppliers", "options"],
  });
}

function ProductFilterForm({
  categories,
  filters,
  onApply,
  onReset,
  suppliers,
}: {
  categories: OptionRecord[];
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  onReset: () => void;
  suppliers: OptionRecord[];
}) {
  const form = useForm({
    defaultValues: filters,
    onSubmit: ({ value }) => onApply(value),
  });
  const categoryOptions = [
    { label: "Semua Kategori", value: "" },
    ...categories.map((category) => ({
      label: category.name,
      value: category.id,
    })),
  ];
  const supplierOptions = [
    { label: "Semua Supplier", value: "" },
    ...suppliers.map((supplier) => ({
      label: supplier.name,
      value: supplier.id,
    })),
  ];
  const stockOptions = [
    { label: "Semua Status", value: "" },
    { label: "Tersedia", value: "available" },
    { label: "Stok Rendah", value: "low_stock" },
    { label: "Kritis", value: "critical" },
    { label: "Habis", value: "out_of_stock" },
  ];

  return (
    <form
      className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="search">
        {(field) => (
          <TextInput
            id="product-search"
            label="Cari Produk"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder="SKU atau nama produk"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="categoryId">
        {(field) => (
          <SelectInput
            id="product-category-filter"
            label="Kategori"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={categoryOptions}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="supplierId">
        {(field) => (
          <SelectInput
            id="product-supplier-filter"
            label="Supplier"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={supplierOptions}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="stockStatus">
        {(field) => (
          <SelectInput
            id="product-stock-filter"
            label="Status Stok"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={stockOptions}
            value={field.state.value}
          />
        )}
      </form.Field>
      <section className="flex items-end gap-2">
        <Button leftIcon={<Filter />} type="submit">
          Terapkan
        </Button>
        <Button
          leftIcon={<RotateCcw />}
          onClick={() => {
            form.reset();
            onReset();
          }}
          type="button"
          variant="secondary"
        />
      </section>
    </form>
  );
}

function ProductForm({
  categories,
  onDone,
  product,
  suppliers,
}: ProductFormProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (value: ProductFormValue) => {
      const payload = {
        ...value,
        description: value.description || null,
        imageUrl: value.imageUrl || null,
        minimumStock: Number(value.minimumStock),
        price: Number(value.price),
      };
      const response = product
        ? await eden.api.v1.products({ id: product.id }).patch(payload)
        : await eden.api.v1.products.post(payload);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(product ? "Produk diperbarui." : "Produk dibuat.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      categoryId: product?.category.id ?? categories[0]?.id ?? "",
      description: product?.description ?? "",
      imageUrl: product?.imageUrl ?? "",
      minimumStock: product?.minimumStock ?? 0,
      name: product?.name ?? "",
      price: product?.price ?? 0,
      sku: product?.sku ?? "",
      supplierId: product?.supplier.id ?? suppliers[0]?.id ?? "",
      unit: product?.unit ?? "unit",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });
  const categoryOptions = categories.map((category) => ({
    label: category.name,
    value: category.id,
  }));
  const supplierOptions = suppliers.map((supplier) => ({
    label: supplier.name,
    value: supplier.id,
  }));
  const errorMessage = mutation.error
    ? getErrorMessage(mutation.error, "Produk gagal disimpan.")
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
        <form.Field
          name="sku"
          validators={{
            onChange: ({ value }) => {
              if (!value.trim()) return "SKU wajib diisi.";
              return undefined;
            },
          }}
        >
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="product-sku"
              label="SKU"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => {
              if (!value.trim()) return "Nama produk wajib diisi.";
              return undefined;
            },
          }}
        >
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="product-name"
              label="Nama Produk"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="categoryId">
          {(field) => (
            <SelectInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="product-category"
              label="Kategori"
              onBlur={field.handleBlur}
              onValueChange={field.handleChange}
              options={categoryOptions}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="supplierId">
          {(field) => (
            <SelectInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="product-supplier"
              label="Supplier"
              onBlur={field.handleBlur}
              onValueChange={field.handleChange}
              options={supplierOptions}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="unit">
          {(field) => (
            <TextInput
              id="product-unit"
              label="Unit"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="price">
          {(field) => (
            <TextInput
              id="product-price"
              label="Harga"
              min={0}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(Number(event.target.value))}
              required
              type="number"
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="minimumStock">
          {(field) => (
            <TextInput
              id="product-minimum-stock"
              label="Stok Minimum"
              min={0}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(Number(event.target.value))}
              required
              type="number"
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="imageUrl">
          {(field) => (
            <TextInput
              id="product-image-url"
              label="URL Gambar"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Opsional"
              value={field.state.value}
            />
          )}
        </form.Field>
      </section>
      <form.Field name="description">
        {(field) => (
          <TextareaInput
            id="product-description"
            label="Deskripsi"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} type="submit">
            {isSubmitting ? "Menyimpan..." : "Simpan Produk"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/**
 * Product inventory page.
 */
export default function ProductsPage() {
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreate = user ? hasPermission(user.role, "product.create") : false;
  const canUpdate = user ? hasPermission(user.role, "product.update") : false;
  const canDelete = user ? hasPermission(user.role, "product.delete") : false;
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ProductFilters>({
    categoryId: "",
    search: "",
    stockStatus: "",
    supplierId: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(
    null,
  );
  const productsQuery = useProducts(page, filters);
  const categoriesQuery = useCategories();
  const suppliersQuery = useSuppliers();
  const queryClient = useQueryClient();
  const deactivateProduct = useMutation({
    mutationFn: async (product: ProductRecord) => {
      const response = await eden.api.v1.products({ id: product.id }).delete();

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk dinonaktifkan.");
    },
  });
  const products = (productsQuery.data?.data ?? []) as ProductRecord[];
  const categories = categoriesQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const pagination = productsQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = products.map((product) => {
    let thumbnailNode = (
      <span className="grid size-10 place-items-center rounded-md bg-muted-surface text-text-muted">
        {product.sku.slice(0, 2)}
      </span>
    );

    if (product.imageUrl) {
      thumbnailNode = (
        <img
          alt={product.name}
          className="size-10 rounded-md object-cover"
          loading="lazy"
          src={product.imageUrl}
        />
      );
    }

    const actionItems = [];

    if (canUpdate) {
      actionItems.push({
        icon: <Edit3 />,
        label: "Edit Produk",
        onSelect: () => setSelectedProduct(product),
      });
    }

    if (canDelete) {
      actionItems.push({
        icon: <Power />,
        label: "Nonaktifkan",
        onSelect: () => deactivateProduct.mutate(product),
      });
    }

    let actionNode = <span className="ts-sm text-text-muted">Tidak ada aksi</span>;

    if (actionItems.length > 0) {
      actionNode = <ActionMenu items={actionItems} />;
    }

    return (
      <TableRow key={product.id}>
        <TableCell>
          <section className="flex items-center gap-3">
            {thumbnailNode}
            <section className="grid gap-1">
              <span className="ts-mono-xs text-text-muted">{product.sku}</span>
              <span className="font-medium text-text-strong">{product.name}</span>
            </section>
          </section>
        </TableCell>
        <TableCell>{product.category.name}</TableCell>
        <TableCell>{product.supplier.name}</TableCell>
        <TableCell>{formatStockQuantity(product.totalStock, product.unit)}</TableCell>
        <TableCell>
          {formatStockQuantity(product.minimumStock, product.unit)}
        </TableCell>
        <TableCell>
          <StockStatusBadge status={toStockBadgeStatus(product.stockStatus)} />
        </TableCell>
        <TableCell>{product.isActive ? "Aktif" : "Nonaktif"}</TableCell>
        <TableCell>{actionNode}</TableCell>
      </TableRow>
    );
  });
  let tableBody = rows;

  if (productsQuery.isError) {
    tableBody = [
      <TableRow key="error">
        <TableCell className="text-danger" colSpan={8}>
          Data produk gagal dimuat.
        </TableCell>
      </TableRow>,
    ];
  }

  if (!productsQuery.isError && rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={8}>
          Belum ada produk yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Produk | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Produk</h1>
          <p className="ts-sm text-text-muted">
            Master produk memakai ledger stok. Jumlah stok tidak diedit langsung.
          </p>
        </section>
        <Button
          disabled={!canCreate}
          leftIcon={<PackagePlus />}
          onClick={() => setCreateOpen(true)}
        >
          Tambah Produk
        </Button>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} produk tercatat.`}
        footer={
          <Pagination
            currentPage={pagination.page}
            onPageChange={setPage}
            pageCount={pagination.pageCount}
          />
        }
        title="Daftar Produk"
        toolbar={
          <ProductFilterForm
            categories={categories}
            filters={filters}
            onApply={(nextFilters) => {
              setPage(1);
              setFilters(nextFilters);
            }}
            onReset={() => {
              setPage(1);
              setFilters({
                categoryId: "",
                search: "",
                stockStatus: "",
                supplierId: "",
              });
            }}
            suppliers={suppliers}
          />
        }
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>SKU dan Nama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Total Stok</TableHead>
              <TableHead>Minimum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aktif</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <Dialog
        id="create-product-dialog"
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="Tambah Produk"
      >
        <ProductForm
          categories={categories}
          onDone={() => setCreateOpen(false)}
          suppliers={suppliers}
        />
      </Dialog>
      <Dialog
        id="edit-product-dialog"
        onClose={() => setSelectedProduct(null)}
        open={Boolean(selectedProduct)}
        title="Edit Produk"
      >
        <ProductForm
          categories={categories}
          onDone={() => setSelectedProduct(null)}
          product={selectedProduct}
          suppliers={suppliers}
        />
      </Dialog>
    </section>
  );
}
