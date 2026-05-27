"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, MapPin, Plus, Power } from "lucide-react";
import L from "leaflet";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

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
import {
  INDONESIA_MAP_CENTER,
  WAREHOUSE_CITY_COORDINATES,
  WAREHOUSE_MAP_PICKER_ZOOM,
} from "@/constants/inventory";
import { eden } from "@/lib/eden";
import { getFieldError } from "@/utils/formErrors";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatStockQuantity } from "@/utils/inventoryDisplay";
import { hasPermission } from "@/utils/permissions";
import { useAuth } from "@/hooks/useAuth";

type WarehouseRecord = {
  address: string | null;
  city: string;
  code: string;
  id: string;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  name: string;
  totalProducts: number;
  totalStock: number;
};

type WarehouseFormValue = {
  address: string;
  city: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type WarehouseLocationPickerProps = {
  city: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (coordinate: Coordinate) => void;
};

const warehousePickerIcon = L.divIcon({
  className: "",
  html: '<span class="block size-5 rounded-full border-2 border-white bg-primary-blue shadow-md"></span>',
  iconAnchor: [10, 10],
  iconSize: [20, 20],
});

function getPickerCenter(city: string, latitude: number | null, longitude: number | null): Coordinate {
  if (latitude !== null && longitude !== null) {
    return { latitude, longitude };
  }

  const cityName = city.trim() as keyof typeof WAREHOUSE_CITY_COORDINATES;

  return WAREHOUSE_CITY_COORDINATES[cityName] ?? INDONESIA_MAP_CENTER;
}

function WarehouseMapEvents({ onChange }: Pick<WarehouseLocationPickerProps, "onChange">) {
  useMapEvents({
    click: (event) => {
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function WarehouseMapRecenter({
  center,
  hasMarker,
}: {
  center: Coordinate;
  hasMarker: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(
      [center.latitude, center.longitude],
      hasMarker ? WAREHOUSE_MAP_PICKER_ZOOM.location : WAREHOUSE_MAP_PICKER_ZOOM.country,
    );
  }, [center, hasMarker, map]);

  return null;
}

function WarehouseLocationPicker({
  city,
  latitude,
  longitude,
  onChange,
}: WarehouseLocationPickerProps) {
  const hasMarker = latitude !== null && longitude !== null;
  const center = getPickerCenter(city, latitude, longitude);
  const markerPosition: [number, number] = [center.latitude, center.longitude];
  let markerNode = null;

  if (hasMarker) {
    markerNode = (
      <Marker
        draggable
        eventHandlers={{
          dragend: (event) => {
            const marker = event.target as L.Marker;
            const nextPosition = marker.getLatLng();

            onChange({
              latitude: nextPosition.lat,
              longitude: nextPosition.lng,
            });
          },
        }}
        icon={warehousePickerIcon}
        position={markerPosition}
      />
    );
  }

  return (
    <section className="grid gap-2">
      <section className="h-80 overflow-hidden rounded-lg border border-border-default">
        <MapContainer
          center={markerPosition}
          className="h-full w-full"
          scrollWheelZoom
          zoom={hasMarker ? WAREHOUSE_MAP_PICKER_ZOOM.location : WAREHOUSE_MAP_PICKER_ZOOM.country}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <WarehouseMapEvents onChange={onChange} />
          <WarehouseMapRecenter center={center} hasMarker={hasMarker} />
          {markerNode}
        </MapContainer>
      </section>
      <p className="ts-xs text-text-muted">
        Pilih lokasi gudang dari peta. Klik untuk memasang marker, lalu geser marker bila perlu.
      </p>
    </section>
  );
}

function useWarehouses(page: number, search: string) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.warehouses.get({
        query: { limit: "10", page: String(page), search, sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["warehouses", page, search],
  });
}

function WarehouseForm({
  onDone,
  warehouse,
}: {
  onDone: () => void;
  warehouse?: WarehouseRecord | null;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (value: WarehouseFormValue) => {
      const payload = {
        ...value,
        address: value.address || null,
        latitude: value.latitude === null ? null : Number(value.latitude),
        longitude: value.longitude === null ? null : Number(value.longitude),
      };
      const response = warehouse
        ? await eden.api.v1.warehouses({ id: warehouse.id }).patch(payload)
        : await eden.api.v1.warehouses.post(payload);

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(warehouse ? "Gudang diperbarui." : "Gudang dibuat.");
      onDone();
    },
  });
  const form = useForm({
    defaultValues: {
      address: warehouse?.address ?? "",
      city: warehouse?.city ?? "",
      code: warehouse?.code ?? "",
      latitude: warehouse?.latitude ?? null,
      longitude: warehouse?.longitude ?? null,
      name: warehouse?.name ?? "",
    },
    onSubmit: async ({ value }) => {
      if (value.latitude === null || value.longitude === null) {
        toast.error("Pilih lokasi gudang dari peta.");
        return;
      }

      await mutation.mutateAsync(value);
    },
  });
  const errorMessage = mutation.error
    ? getErrorMessage(mutation.error, "Gudang gagal disimpan.")
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
        <form.Field name="code" validators={{ onChange: ({ value }) => (!value.trim() ? "Kode wajib diisi." : undefined) }}>
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="warehouse-code"
              label="Kode"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="name" validators={{ onChange: ({ value }) => (!value.trim() ? "Nama wajib diisi." : undefined) }}>
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="warehouse-name"
              label="Nama Gudang"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="city" validators={{ onChange: ({ value }) => (!value.trim() ? "Kota wajib diisi." : undefined) }}>
          {(field) => (
            <TextInput
              errorMessage={getFieldError(field.state.meta.errors)}
              id="warehouse-city"
              label="Kota"
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
      </section>
      <form.Field name="address">
        {(field) => (
          <TextareaInput
            id="warehouse-address"
            label="Alamat"
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe
        selector={(state) => ({
          city: state.values.city,
          latitude: state.values.latitude,
          longitude: state.values.longitude,
        })}
      >
        {({ city, latitude, longitude }) => (
          <section className="grid gap-3">
            <WarehouseLocationPicker
              city={city}
              latitude={latitude}
              longitude={longitude}
              onChange={(coordinate) => {
                form.setFieldValue("latitude", coordinate.latitude);
                form.setFieldValue("longitude", coordinate.longitude);
              }}
            />
            <section className="grid gap-4 md:grid-cols-2">
              <TextInput
                id="warehouse-latitude"
                label="Latitude"
                readOnly
                required
                value={latitude ?? ""}
              />
              <TextInput
                id="warehouse-longitude"
                label="Longitude"
                readOnly
                required
                value={longitude ?? ""}
              />
            </section>
            {latitude === null || longitude === null ? (
              <p className="ts-xs text-danger">Lokasi gudang wajib dipilih dari peta.</p>
            ) : null}
          </section>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button disabled={!canSubmit || isSubmitting} type="submit">
            {isSubmitting ? "Menyimpan..." : "Simpan Gudang"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/**
 * Warehouse management page.
 */
export default function WarehousesPage() {
  const auth = useAuth();
  const user = auth.data?.user;
  const canCreate = user ? hasPermission(user.role, "warehouse.create") : false;
  const canUpdate = user ? hasPermission(user.role, "warehouse.update") : false;
  const canDelete = user ? hasPermission(user.role, "warehouse.delete") : false;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseRecord | null>(null);
  const warehousesQuery = useWarehouses(page, search);
  const queryClient = useQueryClient();
  const deactivate = useMutation({
    mutationFn: async (warehouse: WarehouseRecord) => {
      const response = await eden.api.v1.warehouses({ id: warehouse.id }).delete();

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Gudang dinonaktifkan.");
    },
  });
  const warehouses = (warehousesQuery.data?.data ?? []) as WarehouseRecord[];
  const pagination = warehousesQuery.data?.pagination ?? {
    limit: 10,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  const rows = warehouses.map((warehouse) => {
    const items = [];

    if (canUpdate) {
      items.push({ icon: <Edit3 />, label: "Edit", onSelect: () => setSelectedWarehouse(warehouse) });
    }

    if (canDelete) {
      items.push({ icon: <Power />, label: "Nonaktifkan", onSelect: () => deactivate.mutate(warehouse) });
    }

    return (
      <TableRow key={warehouse.id}>
        <TableCell>
          <section className="grid gap-1">
            <span className="font-medium text-text-strong">{warehouse.name}</span>
            <span className="ts-mono-xs text-text-muted">{warehouse.code}</span>
          </section>
        </TableCell>
        <TableCell>{warehouse.city}</TableCell>
        <TableCell>{warehouse.totalProducts}</TableCell>
        <TableCell>{formatStockQuantity(warehouse.totalStock, "unit")}</TableCell>
        <TableCell>
          <section className="flex items-center gap-2">
            <MapPin className="size-4 text-text-muted" />
            <span className="ts-xs text-text-muted">
              {warehouse.latitude ?? "-"}, {warehouse.longitude ?? "-"}
            </span>
          </section>
        </TableCell>
        <TableCell>
          <StatusBadge label={warehouse.isActive ? "Aktif" : "Nonaktif"} tone={warehouse.isActive ? "success" : "neutral"} />
        </TableCell>
        <TableCell>
          {items.length > 0 ? <ActionMenu items={items} /> : <span className="ts-sm text-text-muted">Tidak ada aksi</span>}
        </TableCell>
      </TableRow>
    );
  });
  let tableBody = rows;

  if (rows.length === 0) {
    tableBody = [
      <TableRow key="empty">
        <TableCell className="text-text-muted" colSpan={7}>
          Belum ada gudang yang sesuai filter.
        </TableCell>
      </TableRow>,
    ];
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Gudang | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <section className="grid gap-2">
          <h1 className="ts-3xl text-text-strong">Gudang</h1>
          <p className="ts-sm text-text-muted">
            Lima gudang utama PT Maju Bersama Digital dan stok per lokasi.
          </p>
        </section>
        <Button disabled={!canCreate} leftIcon={<Plus />} onClick={() => setCreateOpen(true)}>
          Tambah Gudang
        </Button>
      </header>
      <DataTableShell
        description={`Total ${pagination.total} gudang tercatat.`}
        footer={<Pagination currentPage={pagination.page} onPageChange={setPage} pageCount={pagination.pageCount} />}
        title="Daftar Gudang"
        toolbar={
          <TextInput
            id="warehouse-search"
            label="Cari"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nama, kode, atau kota"
            value={search}
          />
        }
      >
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead>Gudang</TableHead>
              <TableHead>Kota</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Total Stok</TableHead>
              <TableHead>Koordinat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableBody}</TableBody>
        </DataTable>
      </DataTableShell>
      <Dialog id="create-warehouse-dialog" onClose={() => setCreateOpen(false)} open={createOpen} title="Tambah Gudang">
        <WarehouseForm onDone={() => setCreateOpen(false)} />
      </Dialog>
      <Dialog id="edit-warehouse-dialog" onClose={() => setSelectedWarehouse(null)} open={Boolean(selectedWarehouse)} title="Edit Gudang">
        <WarehouseForm onDone={() => setSelectedWarehouse(null)} warehouse={selectedWarehouse} />
      </Dialog>
    </section>
  );
}
