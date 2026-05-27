"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RefreshCw, Save, UserCircle } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  Pagination,
  PasswordInput,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { USER_ROLE_LABELS, type UserRole } from "@/constants/auth";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatDateTime } from "@/utils/inventoryDisplay";

type ProfileRecord = {
  createdAt: Date | string;
  email: string;
  id: string;
  lastLoginAt: Date | string | null;
  name: string;
  role: UserRole;
};

type ActivityRecord = {
  action: string;
  createdAt: Date | string;
  description: string;
  entityId: string | null;
  entityType: string;
  id: string;
};

type ActivityFilters = {
  action: string;
  dateRange: {
    from: string;
    to: string;
  };
};

function useProfile() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.profile.get();

      if (response.error) throw response.error;

      return response.data as ProfileRecord;
    },
    queryKey: ["profile"],
  });
}

function useActivity(page: number, filters: ActivityFilters) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.profile.activity.get({
        query: {
          action: filters.action,
          dateFrom: filters.dateRange.from,
          dateTo: filters.dateRange.to,
          limit: "10",
          page: String(page),
          sortBy: "createdAt",
          sortDir: "desc",
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["profile", "activity", page, filters],
  });
}

function ProfileForm({ profile }: { profile: ProfileRecord }) {
  const queryClient = useQueryClient();
  const updateProfile = useMutation({
    mutationFn: async (value: { name: string }) => {
      const response = await eden.api.v1.profile.patch(value);

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      toast.success("Profil berhasil diperbarui.");
    },
  });
  const form = useForm({
    defaultValues: {
      name: profile.name,
    },
    onSubmit: async ({ value }) => {
      await updateProfile.mutateAsync(value);
    },
  });
  const errorMessage = updateProfile.error
    ? getErrorMessage(updateProfile.error, "Profil gagal diperbarui.")
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
            if (value.trim().length < 2) return "Nama minimal 2 karakter.";

            return undefined;
          },
        }}
      >
        {(field) => (
          <TextInput
            errorMessage={getFieldError(field.state.meta.errors)}
            id="profile-name"
            label="Nama"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <TextInput id="profile-email" label="Email" readOnly value={profile.email} />
      <TextInput
        id="profile-role"
        label="Role"
        readOnly
        value={USER_ROLE_LABELS[profile.role]}
      />
      <TextInput
        id="profile-created-at"
        label="Dibuat"
        readOnly
        value={formatDateTime(profile.createdAt)}
      />
      <TextInput
        id="profile-last-login"
        label="Login Terakhir"
        readOnly
        value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : "-"}
      />
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} leftIcon={<Save />} type="submit">
            {isSubmitting ? "Menyimpan..." : "Simpan Profil"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function PasswordForm() {
  const changePassword = useMutation({
    mutationFn: async (value: {
      confirmPassword: string;
      currentPassword: string;
      newPassword: string;
    }) => {
      const response = await eden.api.v1.profile.password.patch(value);

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      toast.success("Password berhasil diperbarui.");
    },
  });
  const form = useForm({
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
    },
    onSubmit: async ({ value }) => {
      await changePassword.mutateAsync(value);
      form.reset();
    },
  });
  const errorMessage = changePassword.error
    ? getErrorMessage(changePassword.error, "Password gagal diperbarui.")
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
      <form.Field name="currentPassword">
        {(field) => (
          <PasswordInput
            autoComplete="current-password"
            errorMessage={getFieldError(field.state.meta.errors)}
            id="current-password"
            label="Password Saat Ini"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="newPassword">
        {(field) => (
          <PasswordInput
            autoComplete="new-password"
            errorMessage={getFieldError(field.state.meta.errors)}
            helperText="Wajib huruf besar, huruf kecil, angka, dan simbol."
            id="new-password"
            label="Password Baru"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field
        name="confirmPassword"
        validators={{
          onChangeListenTo: ["newPassword"],
          onChange: ({ fieldApi, value }) => {
            const newPassword = fieldApi.form.getFieldValue("newPassword");

            if (value !== newPassword) return "Konfirmasi password tidak sama.";

            return undefined;
          },
        }}
      >
        {(field) => (
          <PasswordInput
            autoComplete="new-password"
            errorMessage={getFieldError(field.state.meta.errors)}
            id="confirm-password"
            label="Konfirmasi Password"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} leftIcon={<KeyRound />} type="submit">
            {isSubmitting ? "Menyimpan..." : "Ubah Password"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function ActivityFilterForm({
  filters,
  onApply,
}: {
  filters: ActivityFilters;
  onApply: (filters: ActivityFilters) => void;
}) {
  const form = useForm({
    defaultValues: filters,
    onSubmit: ({ value }) => onApply(value),
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_260px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="action">
        {(field) => (
          <TextInput
            id="activity-action"
            label="Aksi"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder="Contoh: LOGIN_SUCCESS"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="dateRange">
        {(field) => (
          <DateInput
            id="activity-date-range"
            label="Tanggal"
            mode="range"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>
      <section className="flex items-end">
        <Button leftIcon={<RefreshCw />} type="submit">
          Terapkan
        </Button>
      </section>
    </form>
  );
}

/**
 * Self-service profile page.
 */
export default function ProfilePage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ActivityFilters>({
    action: "",
    dateRange: { from: "", to: "" },
  });
  const profileQuery = useProfile();
  const activityQuery = useActivity(page, filters);
  const profile = profileQuery.data;
  const activities = (activityQuery.data?.data ?? []) as ActivityRecord[];
  const pagination = activityQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const activityRows = activities.map((activity) => (
    <TableRow key={activity.id}>
      <TableCell className="ts-mono-xs">{formatDateTime(activity.createdAt)}</TableCell>
      <TableCell>{activity.action}</TableCell>
      <TableCell>{activity.entityType}</TableCell>
      <TableCell>{activity.description}</TableCell>
    </TableRow>
  ));
  let profileContent = (
    <Card>
      <CardContent>
        <p className="ts-sm text-text-muted">Memuat profil...</p>
      </CardContent>
    </Card>
  );
  let activityContent = (
    <DataTable dense>
      <TableHeader>
        <TableRow>
          <TableHead>Waktu</TableHead>
          <TableHead>Aksi</TableHead>
          <TableHead>Module</TableHead>
          <TableHead>Deskripsi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{activityRows}</TableBody>
    </DataTable>
  );

  if (profileQuery.isError) {
    profileContent = (
      <ErrorState
        description={getErrorMessage(profileQuery.error, "Profil gagal dimuat.")}
        onRetry={() => profileQuery.refetch()}
      />
    );
  }

  if (profile) {
    profileContent = <ProfileForm profile={profile} />;
  }

  if (activityQuery.isError) {
    activityContent = (
      <ErrorState
        description={getErrorMessage(activityQuery.error, "Aktivitas gagal dimuat.")}
        onRetry={() => activityQuery.refetch()}
      />
    );
  }

  if (!activityQuery.isLoading && !activityQuery.isError && activities.length === 0) {
    activityContent = (
      <EmptyState
        description="Belum ada aktivitas akun yang sesuai filter."
        title="Aktivitas Kosong"
      />
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Profil | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Profil</h1>
        <p className="ts-sm text-text-muted">
          Kelola nama akun, password, dan lihat aktivitas akun sendiri.
        </p>
      </header>
      <section className="ssp-detail-layout">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <UserCircle className="size-5" />
                Data Profil
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>{profileContent}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ubah Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Saya</CardTitle>
        </CardHeader>
        <CardContent>
          <section className="grid gap-4">
            <ActivityFilterForm
              filters={filters}
              onApply={(nextFilters) => {
                setPage(1);
                setFilters(nextFilters);
              }}
            />
            {activityContent}
            <Pagination
              currentPage={pagination.page}
              onPageChange={setPage}
              pageCount={pagination.pageCount}
            />
          </section>
        </CardContent>
      </Card>
    </section>
  );
}
