"use client";

import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { useParams } from "next/navigation";
import { Helmet } from "react-helmet-async";

import {
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  StockStatusBadge,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { APP_META_DESCRIPTION } from "@/constants/app";
import type { ProductStockStatus } from "@/constants/inventory";
import { ROUTES } from "@/constants/routes";
import { eden } from "@/lib/eden";
import {
  formatDateTime,
  formatStockQuantity,
  toStockBadgeStatus,
} from "@/utils/inventoryDisplay";

type ProductDetail = {
  batches: Array<{
    id: string;
    quantityInitial: number;
    quantityRemaining: number;
    receivedAt: Date | string;
    unitCost: number;
    warehouseCode: string;
    warehouseName: string;
  }>;
  category: { name: string };
  description: string | null;
  id: string;
  imageKey: string | null;
  imageUrl: string | null;
  minimumStock: number;
  movements: Array<{
    createdAt: Date | string;
    createdByName: string | null;
    id: string;
    notes: string | null;
    quantity: number;
    type: "IN" | "OUT";
    warehouseName: string;
  }>;
  name: string;
  sku: string;
  stockStatus: ProductStockStatus;
  supplier: { name: string };
  totalStock: number;
  unit: string;
  warehouseStock: Array<{
    currentStock: number;
    warehouseCode: string;
    warehouseName: string;
  }>;
};

function useProductDetail(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await eden.api.v1.products({ id }).get();

      if (response.error) {
        throw response.error;
      }

      return response.data as ProductDetail;
    },
    queryKey: ["products", id],
  });
}

/**
 * Product detail page with ledger data.
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productQuery = useProductDetail(params.id);
  const product = productQuery.data;

  let content = (
    <Card>
      <CardContent>
        <p className="ts-sm text-text-muted">Memuat detail produk...</p>
      </CardContent>
    </Card>
  );

  if (productQuery.isError) {
    content = (
      <Card>
        <CardContent>
          <p className="ts-sm text-danger">Detail produk gagal dimuat.</p>
        </CardContent>
      </Card>
    );
  }

  if (product) {
    let imageNode = (
      <section className="grid aspect-square min-h-40 place-items-center rounded-lg bg-muted-surface text-text-muted">
        <ImageOff className="size-10" />
      </section>
    );

    if (product.imageUrl) {
      imageNode = (
        <img
          alt={product.name}
          className="aspect-square min-h-40 rounded-lg object-cover"
          loading="lazy"
          src={product.imageUrl}
        />
      );
    }

    const warehouseRows = product.warehouseStock.map((row) => (
      <TableRow key={row.warehouseCode}>
        <TableCell>{row.warehouseName}</TableCell>
        <TableCell>{row.warehouseCode}</TableCell>
        <TableCell>{formatStockQuantity(row.currentStock, product.unit)}</TableCell>
      </TableRow>
    ));
    const batchRows = product.batches.map((batch) => (
      <TableRow key={batch.id}>
        <TableCell>{batch.warehouseName}</TableCell>
        <TableCell>{formatDateTime(batch.receivedAt)}</TableCell>
        <TableCell>
          {formatStockQuantity(batch.quantityInitial, product.unit)}
        </TableCell>
        <TableCell>
          {formatStockQuantity(batch.quantityRemaining, product.unit)}
        </TableCell>
        <TableCell>{batch.unitCost}</TableCell>
      </TableRow>
    ));
    const movementRows = product.movements.map((movement) => (
      <TableRow key={movement.id}>
        <TableCell className="ts-mono-xs">
          {formatDateTime(movement.createdAt)}
        </TableCell>
        <TableCell>{movement.warehouseName}</TableCell>
        <TableCell>{movement.type}</TableCell>
        <TableCell>{formatStockQuantity(movement.quantity, product.unit)}</TableCell>
        <TableCell>{movement.createdByName ?? "-"}</TableCell>
        <TableCell>{movement.notes ?? "-"}</TableCell>
      </TableRow>
    ));

    content = (
      <section className="grid gap-6">
        <section className="ssp-detail-layout">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Produk</CardTitle>
            </CardHeader>
            <CardContent>
              <section className="grid gap-4 md:grid-cols-[160px_1fr]">
                {imageNode}
                <section className="grid gap-3">
                  <p className="ts-mono-sm text-text-muted">{product.sku}</p>
                  <h1 className="ts-3xl text-text-strong">{product.name}</h1>
                  <p className="ts-sm text-text-muted">
                    {product.description ?? "Tidak ada deskripsi."}
                  </p>
                  <section className="flex flex-wrap gap-2">
                    <StockStatusBadge status={toStockBadgeStatus(product.stockStatus)} />
                    <span className="ts-sm text-text-muted">
                      {product.category.name}
                      {" / "}
                      {product.supplier.name}
                    </span>
                  </section>
                </section>
              </section>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Stok</CardTitle>
            </CardHeader>
            <CardContent>
              <section className="grid gap-3">
                <p className="ts-4xl text-text-strong">
                  {formatStockQuantity(product.totalStock, product.unit)}
                </p>
                <p className="ts-sm text-text-muted">
                  Minimum {formatStockQuantity(product.minimumStock, product.unit)}
                </p>
                <section className="flex gap-2">
                  <ButtonLink href={ROUTES.STOCK.IN} variant="secondary">
                    Stock In
                  </ButtonLink>
                  <ButtonLink href={ROUTES.STOCK.OUT} variant="secondary">
                    Stock Out
                  </ButtonLink>
                </section>
              </section>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Stok per Gudang</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Gudang</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{warehouseRows}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Batch FIFO</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Gudang</TableHead>
                  <TableHead>Diterima</TableHead>
                  <TableHead>Awal</TableHead>
                  <TableHead>Sisa</TableHead>
                  <TableHead>Unit Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{batchRows}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Movement</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Gudang</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Dibuat Oleh</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{movementRows}</TableBody>
            </DataTable>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Detail Produk | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      {content}
    </section>
  );
}
