"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit3,
  FileDown,
  FileSpreadsheet,
  KeyRound,
  Power,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  ActionMenu,
  Button,
  ButtonExternalLink,
  DataTable,
  DataTableShell,
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
} from "@/components/ui";
import {
  USER_ROLE_LABELS,
  USER_ROLE_VALUES,
  type UserRole,
} from "@/constants/auth";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {toast} from "@/components/ui/toast";

type UserRecord = {
  createdAt: Date | string;
  email: string;
  id: string;
  isActive: boolean;
  name: string;
  role: UserRole;
};

type DialogMode = "update" | "role" | "password" | "status";

type UserActionDialogProps = {
  mode: DialogMode | null;
  onClose: () => void;
  user: UserRecord | null;
};

const ROLE_OPTIONS = USER_ROLE_VALUES.map((role) => ({
  label: USER_ROLE_LABELS[role],
  value: role,
}));
const DEFAULT_ROLE: UserRole = "VIEWER";

function toUserRole(value: string): UserRole {
  return USER_ROLE_VALUES.find((role) => role === value) ?? DEFAULT_ROLE;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function useUsers(page: number) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.users.get({
        query: {
          limit: "10",
          page: String(page),
          sortBy: "createdAt",
          sortDir: "desc",
        },
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    queryKey: ["users", page],
  });
}

type CreateUserFormProps = {
  onDone: () => void;
};

function CreateUserForm({ onDone }: CreateUserFormProps) {
  const queryClient = useQueryClient();
  const createUser = useMutation({
    mutationFn: async (value: {
      email: string;
      name: string;
      password: string;
      role: UserRole;
    }) => {
      const response = await eden.api.v1.users.post(value);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User berhasil dibuat.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      password: "",
      role: DEFAULT_ROLE,
    },
    onSubmit: async ({ value }) => {
      await createUser.mutateAsync(value);
      form.reset();
    },
  });
  const errorMessage = createUser.error
    ? getErrorMessage(createUser.error, "User gagal dibuat.")
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
          onChange: ({ value }) => {
            if (value.trim().length < 2) {
              return "Nama minimal 2 karakter.";
            }

            return undefined;
          },
        }}
      >
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="create-name"
            label="Nama"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            if (!value.includes("@")) {
              return "Email tidak valid.";
            }

            return undefined;
          },
        }}
      >
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="create-email"
            label="Email"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            type="email"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="role">
        {(field) => (
          <SelectInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="create-role"
            label="Role"
            onBlur={field.handleBlur}
            onValueChange={(value) => field.handleChange(toUserRole(value))}
            options={ROLE_OPTIONS}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) => {
            if (value.length < 8) {
              return "Password minimal 8 karakter.";
            }

            return undefined;
          },
        }}
      >
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            helperText="Wajib huruf besar, huruf kecil, angka, dan simbol."
            id="create-password"
            label="Password"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            type="password"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <Button
            disabled={!canSubmit || isSubmitting}
            leftIcon={<UserPlus />}
            type="submit"
          >
            {isSubmitting ? "Menyimpan..." : "Buat User"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

type ImportXlsxDialogProps = {
  onClose: () => void;
  open: boolean;
};

type ImportResult = {
  created: number;
  errors: Array<{ message: string; row: number }>;
  failed: number;
};

function ImportXlsxDialog({ onClose, open }: ImportXlsxDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
      const base64 = btoa(binary);

      const response = await eden.api.v1.users.bulk.post({ file: base64 });

      if (response.error) {
        throw response.error;
        toast.error("Import gagal diproses.");
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setResult(data as ImportResult);
    },
  });

  const errorMessage = importMutation.error
    ? getErrorMessage(importMutation.error, "Import gagal.")
    : null;

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    importMutation.reset();
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResult(null);
    importMutation.reset();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setResult(null);
    importMutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  let bodyNode = null;

  if (result) {
    const errorRows = result.errors.map((err) => (
      <li className="ts-xs text-text-muted" key={err.row}>
        Baris {err.row}: {err.message}
      </li>
    ));

    bodyNode = (
      <section className="grid gap-4">
        <section className="grid grid-cols-2 gap-3">
          <section className="rounded-lg border border-success-border bg-success-bg p-4 text-center">
            <p className="ts-2xl font-bold text-success">{result.created}</p>
            <p className="ts-xs text-text-muted">Berhasil dibuat</p>
          </section>
          <section className="rounded-lg border border-danger-border bg-danger-bg p-4 text-center">
            <p className="ts-2xl font-bold text-danger">{result.failed}</p>
            <p className="ts-xs text-text-muted">Gagal</p>
          </section>
        </section>
        {result.errors.length > 0 && (
          <section className="rounded-lg border border-border-default bg-muted-surface p-3">
            <p className="ts-xs mb-2 font-medium text-text-strong">Detail Gagal</p>
            <ul className="grid gap-1">{errorRows}</ul>
          </section>
        )}
        <Button onClick={handleClose} variant="secondary">
          Tutup
        </Button>
      </section>
    );
  } else {
    let fileInfoNode = null;

    if (selectedFile) {
      fileInfoNode = (
        <section className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-muted-surface px-3 py-2">
          <section className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-success" />
            <span className="ts-sm truncate text-text-strong">{selectedFile.name}</span>
          </section>
          <button
            aria-label="Hapus file"
            className="size-6 shrink-0 rounded text-text-muted transition-colors hover:text-danger"
            onClick={handleRemoveFile}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </section>
      );
    }

    let errorNode = null;

    if (errorMessage) {
      errorNode = (
        <section className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3">
          <p className="ts-sm font-medium text-danger">{errorMessage}</p>
        </section>
      );
    }

    bodyNode = (
      <section className="grid gap-4">
        <p className="ts-sm text-text-muted">
          Upload file XLSX sesuai template. Gunakan tombol{" "}
          <strong>Unduh Template</strong> untuk mendapatkan format yang benar.
        </p>
        <section className="grid gap-2">
          <input
            accept=".xlsx"
            className="sr-only"
            id="import-file-input"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <label
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong px-4 py-6 text-text-muted transition-colors hover:border-primary-blue hover:text-primary-blue"
            htmlFor="import-file-input"
          >
            <FileSpreadsheet aria-hidden="true" className="size-5" />
            <span className="ts-sm font-medium">Pilih file XLSX</span>
          </label>
          {fileInfoNode}
        </section>
        {errorNode}
        <Button
          disabled={!selectedFile || importMutation.isPending}
          leftIcon={<FileSpreadsheet />}
          onClick={() => {
            if (selectedFile) importMutation.mutate(selectedFile);
          }}
          type="button"
        >
          {importMutation.isPending ? "Memproses..." : "Import User"}
        </Button>
      </section>
    );
  }

  return (
    <Dialog
      description="Buat banyak user sekaligus dari file XLSX."
      id="import-xlsx-dialog"
      onClose={handleClose}
      open={open}
      title="Import User dari XLSX"
    >
      {bodyNode}
    </Dialog>
  );
}

function UserActionDialog({ mode, onClose, user }: UserActionDialogProps) {
  let content = null;
  let title = "Aksi User";

  if (user && mode === "update") {
    title = "Update User";
    content = <UpdateUserForm onDone={onClose} user={user} />;
  }

  if (user && mode === "role") {
    title = "Ubah Role";
    content = <RoleForm onDone={onClose} user={user} />;
  }

  if (user && mode === "password") {
    title = "Reset Password";
    content = <PasswordForm onDone={onClose} user={user} />;
  }

  if (user && mode === "status") {
    title = user.isActive ? "Nonaktifkan User" : "Aktifkan User";
    content = <StatusForm onDone={onClose} user={user} />;
  }

  const isOpen = Boolean(user) && Boolean(mode);

  return (
    <Dialog id="user-action-dialog" onClose={onClose} open={isOpen} title={title}>
      {content}
    </Dialog>
  );
}

type UserFormProps = {
  onDone: () => void;
  user: UserRecord;
};

function UpdateUserForm({ onDone, user }: UserFormProps) {
  const queryClient = useQueryClient();
  const updateUser = useMutation({
    mutationFn: async (value: { email: string; name: string }) => {
      const response = await eden.api.v1.users({ id: user.id }).patch(value);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User berhasil diperbarui.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      email: user.email,
      name: user.name,
    },
    onSubmit: async ({ value }) => {
      await updateUser.mutateAsync(value);
    },
  });
  const errorMessage = updateUser.error
    ? getErrorMessage(updateUser.error, "User gagal diperbarui.")
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
      <form.Field name="name">
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="update-name"
            label="Nama"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="email">
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="update-email"
            label="Email"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            type="email"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} leftIcon={<Edit3 />} type="submit">
            {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function RoleForm({ onDone, user }: UserFormProps) {
  const queryClient = useQueryClient();
  const changeRole = useMutation({
    mutationFn: async (value: { role: UserRole }) => {
      const response = await eden.api.v1.users({ id: user.id }).role.patch(value);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role user berhasil diubah.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      role: user.role,
    },
    onSubmit: async ({ value }) => {
      await changeRole.mutateAsync(value);
    },
  });
  const errorMessage = changeRole.error
    ? getErrorMessage(changeRole.error, "Role gagal diubah.")
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
      <form.Field name="role">
        {(field) => (
          <SelectInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="change-role"
            label="Role"
            onBlur={field.handleBlur}
            onValueChange={(value) => field.handleChange(toUserRole(value))}
            options={ROLE_OPTIONS}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} leftIcon={<Shield />} type="submit">
            {isSubmitting ? "Menyimpan..." : "Ubah Role"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function PasswordForm({ onDone, user }: UserFormProps) {
  const queryClient = useQueryClient();
  const resetPassword = useMutation({
    mutationFn: async (value: { password: string }) => {
      const response = await eden.api.v1.users({ id: user.id }).password.patch(value);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Password user berhasil direset.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      password: "",
    },
    onSubmit: async ({ value }) => {
      await resetPassword.mutateAsync(value);
    },
  });
  const errorMessage = resetPassword.error
    ? getErrorMessage(resetPassword.error, "Password gagal direset.")
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
      <p className="ts-sm text-text-muted">
        Password baru untuk {user.email}. Session aktif user akan dicabut.
      </p>
      <form.Field name="password">
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            helperText="Wajib huruf besar, huruf kecil, angka, dan simbol."
            id="reset-password"
            label="Password Baru"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            type="password"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} leftIcon={<KeyRound />} type="submit">
            {isSubmitting ? "Menyimpan..." : "Reset Password"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function StatusForm({ onDone, user }: UserFormProps) {
  const queryClient = useQueryClient();
  const changeStatus = useMutation({
    mutationFn: async (value: { isActive: boolean }) => {
      const response = await eden.api.v1.users({ id: user.id }).status.patch(value);

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Status user berhasil diubah.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      isActive: !user.isActive,
    },
    onSubmit: async ({ value }) => {
      await changeStatus.mutateAsync(value);
    },
  });
  const errorMessage = changeStatus.error
    ? getErrorMessage(changeStatus.error, "Status gagal diubah.")
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
      <p className="ts-sm text-text-muted">
        Status akun {user.email} akan diubah.
      </p>
      <form.Field name="isActive">
        {(field) => (
          <SelectInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="change-status"
            label="Status"
            onBlur={field.handleBlur}
            onValueChange={(value) => field.handleChange(value === "true")}
            options={[
              { label: "Aktif", value: "true" },
              { label: "Nonaktif", value: "false" },
            ]}
            required
            value={String(field.state.value)}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} leftIcon={<Power />} type="submit">
            {isSubmitting ? "Menyimpan..." : "Ubah Status"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/**
 * Admin user management page.
 */
export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const usersQuery = useUsers(page);
  const users = usersQuery.data?.data ?? [];
  const pagination = usersQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = users.map((user) => {
    const statusTone = user.isActive ? "success" : "neutral";
    const statusLabel = user.isActive ? "Aktif" : "Nonaktif";

    return (
      <TableRow key={user.id}>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">{user.name}</span>
            <span className="ts-xs text-text-muted">{user.email}</span>
          </section>
        </TableCell>
        <TableCell>{USER_ROLE_LABELS[user.role]}</TableCell>
        <TableCell>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </TableCell>
        <TableCell>{formatDate(user.createdAt)}</TableCell>
        <TableCell>
          <ActionMenu
            items={[
              {
                icon: <Edit3 />,
                label: "Update User",
                onSelect: () => {
                  setSelectedUser(user);
                  setDialogMode("update");
                },
              },
              {
                icon: <Shield />,
                label: "Ubah Role",
                onSelect: () => {
                  setSelectedUser(user);
                  setDialogMode("role");
                },
              },
              {
                icon: <KeyRound />,
                label: "Reset Password",
                onSelect: () => {
                  setSelectedUser(user);
                  setDialogMode("password");
                },
              },
              {
                icon: <Power />,
                label: user.isActive ? "Nonaktifkan" : "Aktifkan",
                onSelect: () => {
                  setSelectedUser(user);
                  setDialogMode("status");
                },
              },
            ]}
          />
        </TableCell>
      </TableRow>
    );
  });
  let tableBody = rows;

  if (rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={5}>
          Belum ada user yang sesuai.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Users | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Manajemen User</h1>
          <p className="ts-sm text-text-muted">
            Admin dapat membuat, mengubah role, reset password, dan mengatur
            status user.
          </p>
        </section>
        <section className="flex flex-wrap items-center gap-2">
          <ButtonExternalLink
            href="/api/__internal__/users/template"
            leftIcon={<FileDown />}
            rel=""
            target="_self"
            variant="secondary"
          >
            Unduh Template
          </ButtonExternalLink>
          <Button
            leftIcon={<FileSpreadsheet />}
            onClick={() => setImportOpen(true)}
            variant="secondary"
          >
            Import XLSX
          </Button>
          <Button
            leftIcon={<UserPlus />}
            onClick={() => setCreateOpen(true)}
          >
            Tambah User
          </Button>
        </section>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} user terdaftar.`}
        footer={
          <Pagination
            currentPage={pagination.page}
            onPageChange={setPage}
            pageCount={pagination.pageCount}
          />
        }
        title="Daftar User"
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <Dialog
        description="Password wajib mengikuti aturan kekuatan password."
        id="create-user-dialog"
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="Tambah User"
      >
        <CreateUserForm onDone={() => setCreateOpen(false)} />
      </Dialog>
      <ImportXlsxDialog
        onClose={() => setImportOpen(false)}
        open={importOpen}
      />
      <UserActionDialog
        mode={dialogMode}
        onClose={() => {
          setDialogMode(null);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </section>
  );
}
