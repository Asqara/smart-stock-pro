"use client";

import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import Link from "next/link";
import { Helmet } from "react-helmet-async";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  ErrorState,
  StatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { ROUTES } from "@/constants/routes";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { formatRp } from "@/utils/formatRp";
import { formatStockQuantity } from "@/utils/inventoryDisplay";

type WarehouseMapMarker = {
  address: string | null;
  city: string;
  code: string;
  criticalStockCount: number;
  id: string;
  inventoryValue: number;
  latitude: number | null;
  longitude: number | null;
  lowStockCount: number;
  name: string;
  status: "critical" | "healthy" | "warning";
  totalProducts: number;
  totalStock: number;
};

function getMarkerIcon(status: WarehouseMapMarker["status"]) {
  const className =
    status === "critical"
      ? "bg-danger"
      : status === "warning"
        ? "bg-warning"
        : "bg-success";

  return L.divIcon({
    className: "",
    html: `<span class="${className} block size-4 rounded-full border-2 border-white shadow-md"></span>`,
    iconAnchor: [8, 8],
    iconSize: [16, 16],
  });
}

function getStatusTone(status: WarehouseMapMarker["status"]) {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";

  return "success";
}

function getStatusLabel(status: WarehouseMapMarker["status"]) {
  if (status === "critical") return "Critical";
  if (status === "warning") return "Warning";

  return "Healthy";
}

function useWarehouseMap() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.warehouses.map.get();

      if (response.error) throw response.error;

      return response.data as WarehouseMapMarker[];
    },
    queryKey: ["warehouses", "map"],
  });
}

/**
 * Warehouse interactive map page.
 */
export default function WarehouseMapPage() {
  const mapQuery = useWarehouseMap();
  const markers = (mapQuery.data ?? []).filter(
    (warehouse) => warehouse.latitude !== null && warehouse.longitude !== null,
  );
  const rows = (mapQuery.data ?? []).map((warehouse) => (
    <TableRow key={warehouse.id}>
      <TableCell>
        <section className="grid gap-1">
          <Link
            className="font-medium text-text-strong hover:text-primary-blue"
            href={ROUTES.WAREHOUSES.DETAIL(warehouse.id)}
          >
            {warehouse.name}
          </Link>
          <span className="ts-mono-xs text-text-muted">{warehouse.code}</span>
        </section>
      </TableCell>
      <TableCell>{warehouse.city}</TableCell>
      <TableCell>{formatStockQuantity(warehouse.totalStock, "unit")}</TableCell>
      <TableCell>{formatRp(Number(warehouse.inventoryValue))}</TableCell>
      <TableCell>{warehouse.lowStockCount}</TableCell>
      <TableCell>
        <StatusBadge
          label={getStatusLabel(warehouse.status)}
          tone={getStatusTone(warehouse.status)}
        />
      </TableCell>
    </TableRow>
  ));
  let mapContent = (
    <section className="h-[520px] overflow-hidden rounded-xl border border-border-default">
      <MapContainer
        center={[-2.5489, 118.0149]}
        className="h-full w-full"
        scrollWheelZoom
        zoom={5}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((warehouse) => (
          <Marker
            icon={getMarkerIcon(warehouse.status)}
            key={warehouse.id}
            position={[warehouse.latitude!, warehouse.longitude!]}
          >
            <Popup>
              <section className="grid gap-1">
                <strong>{warehouse.name}</strong>
                <span>{warehouse.city}</span>
                <span>{warehouse.address ?? "Alamat belum diisi"}</span>
                <span>Total stok: {formatStockQuantity(warehouse.totalStock, "unit")}</span>
                <span>Total produk: {warehouse.totalProducts}</span>
                <span>Stok rendah: {warehouse.lowStockCount}</span>
              </section>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );

  if (mapQuery.isLoading) {
    mapContent = (
      <section className="h-[520px] animate-pulse rounded-xl bg-muted-surface" />
    );
  }

  if (mapQuery.isError) {
    mapContent = (
      <ErrorState
        description={getErrorMessage(mapQuery.error, "Peta gudang gagal dimuat.")}
        onRetry={() => mapQuery.refetch()}
      />
    );
  }

  if (!mapQuery.isLoading && !mapQuery.isError && markers.length === 0) {
    mapContent = (
      <EmptyState
        description="Koordinat gudang belum tersedia. Isi latitude dan longitude pada data gudang."
        title="Peta Belum Tersedia"
      />
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Peta Gudang | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Peta Gudang</h1>
        <p className="ts-sm text-text-muted">
          Lokasi gudang, total stok, nilai inventaris, dan status low stock.
        </p>
      </header>
      {mapContent}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Gudang</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable dense>
            <TableHeader>
              <TableRow>
                <TableHead>Gudang</TableHead>
                <TableHead>Kota</TableHead>
                <TableHead>Total Stok</TableHead>
                <TableHead>Nilai</TableHead>
                <TableHead>Stok Rendah</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </DataTable>
        </CardContent>
      </Card>
    </section>
  );
}
