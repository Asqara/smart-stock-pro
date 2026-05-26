"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Power } from "lucide-react";
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
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { hasPermission } from "@/utils/permissions";
import { useAuth } from "@/hooks/useAuth";

type SupplierRecord = {
  address: string | null;
  contactName: string | null;
  email: string | null;
  id: string;
  isActive: boolean;
  name: string;
  phone: string | null;
  productCount: number;
};

type SupplierFormValue = {
  address: string;
  contactName: string;
  email: string;
  name: string;
  phone: string;
};

function useSuppliers(page: number, search: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.suppliers.get({
        query: { limit: "10", page: String(page), search, sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["suppliers", page, search],
  });
}

function SupplierForm({
  onDone,
  supplier,
}: {
  onDone: () => void;
  supplier?: SupplierRecord | null;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (value: SupplierFormValue) => {
      const payload = {
        address: value.address || null,
        contactName: value.contactName || null,
        email: value.email || null,
        name: value.name,
        phone: value.phone || null,
      };
      const response = supplier
        ? await eden.api.v1.suppliers({ id: supplier.id }).patch(payload)
        : await eden.api.v1.suppliers.post(payload);

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(supplier ? "Supplier diperbarui." : "Supplier dibuat.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      address: supplier?.address ?? "",
      contactName: supplier?.contactName ?? "",
      email: supplier?.email ?? "",
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
    },
    onSubmit: async ({ value }) => mutation.mutateAsync(value),
  });
  const errorMessage = mutation.error
    ? getErrorMessage(mutation.error, "Supplier gagal disimpan.")
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
          name="name"
          validators={{
            onChange: ({ value }) => (!value.trim() ? "Nama wajib diisi." : undefined),
          }}
        >
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="supplier-name"
              label="Nama Supplier"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="contactName">
          {(field) => (
            <TextInput
              id="supplier-contact"
              label="Kontak"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <TextInput
              id="supplier-phone"
              label="Telepon"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="supplier-email"
              label="Email"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              type="email"
              value={field.state.value}
            />
          )}
        </form.Field>
      </section>
      <form.Field name="address">
        {(field) => (
          <TextareaInput
            id="supplier-address"
            label="Alamat"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} type="submit">
            {isSubmitting ? "Menyimpan..." : "Simpan Supplier"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/**
 * Supplier management page.
 */
export default function SuppliersPage() {
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreate = user ? hasPermission(user.role, "supplier.create") : false;
  const canUpdate = user ? hasPermission(user.role, "supplier.update") : false;
  const canDelete = user ? hasPermission(user.role, "supplier.delete") : false;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null);
  const suppliersQuery = useSuppliers(page, search);
  const queryClient = useQueryClient();
  const deactivate = useMutation({
    mutationFn: async (supplier: SupplierRecord) => {
      const response = await eden.api.v1.suppliers({ id: supplier.id }).delete();

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier dinonaktifkan.");
    },
  });
  const suppliers = (suppliersQuery.data?.data ?? []) as SupplierRecord[];
  const pagination = suppliersQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = suppliers.map((supplier) => {
    const items = [];

    if (canUpdate) {
      items.push({
        icon: <Edit3 />,
        label: "Edit",
        onSelect: () => setSelectedSupplier(supplier),
      });
    }

    if (canDelete) {
      items.push({
        icon: <Power />,
        label: "Nonaktifkan",
        onSelect: () => deactivate.mutate(supplier),
      });
    }

    return (
      <TableRow key={supplier.id}>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">{supplier.name}</span>
            <span className="ts-xs text-text-muted">{supplier.contactName ?? "-"}</span>
          </section>
        </TableCell>
        <TableCell>{supplier.phone ?? "-"}</TableCell>
        <TableCell>{supplier.email ?? "-"}</TableCell>
        <TableCell>{supplier.productCount}</TableCell>
        <TableCell>
          <StatusBadge label={supplier.isActive ? "Aktif" : "Nonaktif"} tone={supplier.isActive ? "success" : "neutral"} />
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
        <TableCell className="text-text-muted" colSpan={6}>
          Belum ada supplier yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Supplier | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Supplier</h1>
          <p className="ts-sm text-text-muted">
            Kelola pemasok produk elektronik dan kontak operasional.
          </p>
        </section>
        <Button disabled={!canCreate} leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
          Tambah Supplier
        </Button>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} supplier tercatat.`}
        footer={<Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />}
        title="Daftar Supplier"
        toolbar={
          <section className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextInput
              id="supplier-search"
              label="Cari"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama, email, atau telepon"
              value={search}
            />
          </section>
        }
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <Dialog id="create-supplier-dialog" onClose={() => setCreateOpen(false)} open={createOpen} title="Tambah Supplier">
        <SupplierForm onDone={() => setCreateOpen(false)} />
      </Dialog>
      <Dialog id="edit-supplier-dialog" onClose={() => setSelectedSupplier(null)} open={Boolean(selectedSupplier)} title="Edit Supplier">
        <SupplierForm onDone={() => setSelectedSupplier(null)} supplier={selectedSupplier} />
      </Dialog>
    </section>
  );
}
