"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Filter, Plus, Power, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  ActionMenu,
  Button,
  DataTable,
  DataTableShell,
  Dialog,
  Pagination,
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
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { getFieldError } from "@/utils/formErrors";
import { hasPermission } from "@/utils/permissions";
import { useAuth } from "@/hooks/useAuth";

type CategoryRecord = {
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  productCount: number;
  slug: string;
};

type CategoryFormValue = {
  description: string;
  name: string;
  slug: string;
};

function useCategories(page: number, search: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.categories.get({
        query: { limit: "10", page: String(page), search, sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["categories", page, search],
  });
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: CategoryRecord | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (value: CategoryFormValue) => {
      const payload = {
        description: value.description || null,
        name: value.name,
        slug: value.slug,
      };
      const response = category
        ? await eden.api.v1.categories({ id: category.id }).patch(payload)
        : await eden.api.v1.categories.post(payload);

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(category ? "Kategori diperbarui." : "Kategori dibuat.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      description: category?.description ?? "",
      name: category?.name ?? "",
      slug: category?.slug ?? "",
    },
    onSubmit: async ({ value }) => mutation.mutateAsync(value),
  });
  const errorMessage = mutation.error
    ? getErrorMessage(mutation.error, "Kategori gagal disimpan.")
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
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => (!value.trim() ? "Nama wajib diisi." : undefined),
        }}
      >
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="category-name"
            label="Nama Kategori"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field
        name="slug"
        validators={{
          onChange: ({ value }) => (!value.trim() ? "Kode wajib diisi." : undefined),
        }}
      >
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="category-slug"
            label="Kode"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <TextareaInput
            id="category-description"
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
            {isSubmitting ? "Menyimpan..." : "Simpan Kategori"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/**
 * Category management page.
 */
export default function CategoriesPage() {
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreate = user ? hasPermission(user.role, "category.create") : false;
  const canUpdate = user ? hasPermission(user.role, "category.update") : false;
  const canDelete = user ? hasPermission(user.role, "category.delete") : false;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryRecord | null>(null);
  const queryClient = useQueryClient();
  const categoriesQuery = useCategories(page, search);
  const deactivate = useMutation({
    mutationFn: async (category: CategoryRecord) => {
      const response = await eden.api.v1.categories({ id: category.id }).delete();

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Kategori dinonaktifkan.");
    },
  });
  const categories = (categoriesQuery.data?.data ?? []) as CategoryRecord[];
  const pagination = categoriesQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = categories.map((category) => {
    const items = [];

    if (canUpdate) {
      items.push({
        icon: <Edit3 />,
        label: "Edit",
        onSelect: () => setSelectedCategory(category),
      });
    }

    if (canDelete) {
      items.push({
        icon: <Power />,
        label: "Nonaktifkan",
        onSelect: () => deactivate.mutate(category),
      });
    }

    return (
      <TableRow key={category.id}>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">{category.name}</span>
            <span className="ts-mono-xs text-text-muted">{category.slug}</span>
          </section>
        </TableCell>
        <TableCell>{category.description ?? "-"}</TableCell>
        <TableCell>{category.productCount}</TableCell>
        <TableCell>
          <StatusBadge
            label={category.isActive ? "Aktif" : "Nonaktif"}
            tone={category.isActive ? "success" : "neutral"}
          />
        </TableCell>
        <TableCell>
          {items.length > 0 ? (
            <ActionMenu items={items} />
          ) : (
            <span className="ts-sm text-text-muted">Tidak ada aksi</span>
          )}
        </TableCell>
      </TableRow>
    );
  });
  let tableBody = rows;

  if (rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={5}>
          Belum ada kategori yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Kategori | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Kategori</h1>
          <p className="ts-sm text-text-muted">
            Kelola pengelompokan produk elektronik untuk filter dan laporan.
          </p>
        </section>
        <Button disabled={!canCreate} leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
          Tambah Kategori
        </Button>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} kategori tercatat.`}
        footer={
          <Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />
        }
        title="Daftar Kategori"
        toolbar={
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(draftSearch);
            }}
          >
            <TextInput
              id="category-search"
              label="Cari"
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Nama atau kode"
              value={draftSearch}
            />
            <section className="flex gap-2">
              <Button leftIcon={<Filter />} type="submit">Cari</Button>
              <Button
                leftIcon={<RotateCcw />}
                onClick={() => {
                  setDraftSearch("");
                  setSearch("");
                }}
                type="button"
                variant="secondary"
              />
            </section>
          </form>
        }
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <Dialog id="create-category-dialog" onClose={() => setCreateOpen(false)} open={createOpen} title="Tambah Kategori">
        <CategoryForm onDone={() => setCreateOpen(false)} />
      </Dialog>
      <Dialog id="edit-category-dialog" onClose={() => setSelectedCategory(null)} open={Boolean(selectedCategory)} title="Edit Kategori">
        <CategoryForm category={selectedCategory} onDone={() => setSelectedCategory(null)} />
      </Dialog>
    </section>
  );
}
