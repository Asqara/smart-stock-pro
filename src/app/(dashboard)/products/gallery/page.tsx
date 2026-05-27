"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Search, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Helmet } from "react-helmet-async";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Pagination,
  SelectInput,
  StockStatusBadge,
  TextInput,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import type { ProductStockStatus } from "@/constants/inventory";
import {
  PRODUCT_IMAGE_ALLOWED_MIME_TYPES,
  UPLOAD_FILE_LIMIT_BYTES,
} from "@/constants/upload";
import { useAuth } from "@/hooks/useAuth";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import {
  formatStockQuantity,
  toStockBadgeStatus,
} from "@/utils/inventoryDisplay";
import { readImageFile } from "@/utils/imageUpload";
import { mc } from "@/utils/mc";
import { hasPermission } from "@/utils/permissions";

type ProductGalleryRecord = {
  category: {
    id: string;
    name: string;
  };
  id: string;
  imageUrl: string | null;
  minimumStock: number;
  name: string;
  sku: string;
  stockStatus: ProductStockStatus;
  totalStock: number;
  unit: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type GalleryFilters = {
  categoryId: string;
  search: string;
};

type ProductImagePayload = {
  dataBase64: string;
  fileName: string;
  fileSize: number;
  fileType: (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];
};

function useGallery(page: number, filters: GalleryFilters) {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.products.gallery.get({
        query: {
          categoryId: filters.categoryId,
          limit: "12",
          page: String(page),
          search: filters.search,
          sortBy: "name",
          sortDir: "asc",
        },
      });

      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["products", "gallery", page, filters],
  });
}

function useCategories() {
  return useQuery({
    queryFn: async () => {
      const response = await eden.api.v1.categories.get({
        query: { isActive: "true", limit: "100", page: "1", sortBy: "name" },
      });

      if (response.error) throw response.error;

      return response.data.data as CategoryOption[];
    },
    queryKey: ["products", "gallery", "categories"],
  });
}

function GalleryFilterForm({
  categories,
  filters,
  onApply,
}: {
  categories: CategoryOption[];
  filters: GalleryFilters;
  onApply: (filters: GalleryFilters) => void;
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

  return (
    <form
      className="ssp-filter-bar md:grid-cols-[1fr_260px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="search">
        {(field) => (
          <TextInput
            id="gallery-search"
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
            id="gallery-category"
            label="Kategori"
            onBlur={field.handleBlur}
            onValueChange={field.handleChange}
            options={categoryOptions}
            searchable
            value={field.state.value}
          />
        )}
      </form.Field>
      <section className="flex items-end">
        <Button leftIcon={<Search />} type="submit">
          Terapkan
        </Button>
      </section>
    </form>
  );
}

function ProductGalleryCard({
  canUpload,
  product,
}: {
  canUpload: boolean;
  product: ProductGalleryRecord;
}) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ProductImagePayload | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const uploadImage = useMutation({
    mutationFn: async (payload: ProductImagePayload) => {
      const response = await eden.api.v1.products({ id: product.id }).image.post(payload);

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setPreview(null);
      toast.success("Gambar produk berhasil diperbarui.");
    },
  });
  const removeImage = useMutation({
    mutationFn: async () => {
      const response = await eden.api.v1.products({ id: product.id }).image.delete();

      if (response.error) throw response.error;

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Gambar produk berhasil dihapus.");
    },
  });
  const dropzone = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    disabled: !canUpload || uploadImage.isPending,
    maxFiles: 1,
    maxSize: UPLOAD_FILE_LIMIT_BYTES.product,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      setValidationMessage(null);

      if (rejectedFiles.length > 0) {
        setValidationMessage("File harus JPG, PNG, atau WebP dengan ukuran maksimal 2 MB.");
        return;
      }

      const file = acceptedFiles[0];

      if (!file) {
        return;
      }

      if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(file.type as never)) {
        setValidationMessage("Format gambar harus JPG, PNG, atau WebP.");
        return;
      }

      try {
        const image = await readImageFile(file);
        setPreview({
          dataBase64: image.dataBase64,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number],
        });
      } catch {
        setValidationMessage("Preview gambar gagal dibuat.");
      }
    },
  });
  const imageSrc = preview?.dataBase64 ?? product.imageUrl;
  let imageNode = (
    <section className="grid aspect-square place-items-center rounded-lg bg-muted-surface text-text-muted">
      <ImageOff className="size-10" />
    </section>
  );

  if (imageSrc) {
    imageNode = (
      <img
        alt={product.name}
        className="aspect-square w-full rounded-lg object-cover"
        loading="lazy"
        src={imageSrc}
      />
    );
  }

  let validationNode = null;

  if (validationMessage) {
    validationNode = <p className="ts-xs text-danger">{validationMessage}</p>;
  }

  let errorNode = null;

  if (uploadImage.error || removeImage.error) {
    errorNode = (
      <p className="ts-xs text-danger">
        {getErrorMessage(
          uploadImage.error ?? removeImage.error,
          "Gambar produk gagal diproses.",
        )}
      </p>
    );
  }

  let actionNode = null;

  if (canUpload) {
    actionNode = (
      <section className="grid gap-2">
        <section
          className={mc(
            "grid min-h-24 place-items-center rounded-lg border border-dashed border-border-strong bg-muted-surface p-3 text-center",
            dropzone.isDragActive && "border-primary-blue bg-info-bg",
          )}
          {...dropzone.getRootProps()}
        >
          <input {...dropzone.getInputProps()} />
          <section className="grid gap-1">
            <Upload className="mx-auto size-5 text-text-muted" />
            <p className="ts-xs text-text-muted">
              Tarik gambar atau klik untuk pilih file.
            </p>
          </section>
        </section>
        {validationNode}
        {errorNode}
        <section className="flex flex-wrap gap-2">
          <Button
            disabled={!preview || uploadImage.isPending}
            leftIcon={<Upload />}
            onClick={() => {
              if (preview) uploadImage.mutate(preview);
            }}
            size="sm"
          >
            {uploadImage.isPending ? "Mengunggah..." : "Simpan Gambar"}
          </Button>
          <Button
            disabled={!preview}
            leftIcon={<X />}
            onClick={() => setPreview(null)}
            size="sm"
            variant="secondary"
          >
            Batal
          </Button>
          <Button
            disabled={!product.imageUrl || removeImage.isPending}
            leftIcon={<Trash2 />}
            onClick={() => removeImage.mutate()}
            size="sm"
            variant="secondary"
          >
            Hapus
          </Button>
        </section>
      </section>
    );
  }

  return (
    <Card>
      <CardContent>
        {imageNode}
        <section className="grid gap-1">
          <p className="ts-mono-xs text-text-muted">{product.sku}</p>
          <h2 className="ts-lg font-semibold text-text-strong">{product.name}</h2>
          <p className="ts-sm text-text-muted">{product.category.name}</p>
        </section>
        <section className="flex flex-wrap items-center gap-2">
          <StockStatusBadge status={toStockBadgeStatus(product.stockStatus)} />
          <span className="ts-sm text-text-muted">
            {formatStockQuantity(product.totalStock, product.unit)}
          </span>
        </section>
        {actionNode}
      </CardContent>
    </Card>
  );
}

/**
 * Product gallery page with upload preview.
 */
export default function ProductGalleryPage() {
  const auth = useAuth();
  const user = auth.data?.user;
  const canUpload = user ? hasPermission(user.role, "product.upload_image") : false;
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<GalleryFilters>({
    categoryId: "",
    search: "",
  });
  const galleryQuery = useGallery(page, filters);
  const categoriesQuery = useCategories();
  const products = (galleryQuery.data?.data ?? []) as ProductGalleryRecord[];
  const pagination = galleryQuery.data?.pagination ?? {
    limit: 12,
    page: 1,
    pageCount: 1,
    total: 0,
  };
  let content = (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductGalleryCard
          canUpload={canUpload}
          key={product.id}
          product={product}
        />
      ))}
    </section>
  );

  if (galleryQuery.isLoading) {
    content = (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent>
              <section className="aspect-square animate-pulse rounded-lg bg-muted-surface" />
              <section className="h-4 w-32 animate-pulse rounded bg-muted-surface" />
              <section className="h-4 w-24 animate-pulse rounded bg-muted-surface" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  if (galleryQuery.isError) {
    content = (
      <ErrorState
        description={getErrorMessage(galleryQuery.error, "Galeri produk gagal dimuat.")}
        onRetry={() => galleryQuery.refetch()}
      />
    );
  }

  if (!galleryQuery.isLoading && !galleryQuery.isError && products.length === 0) {
    content = (
      <EmptyState
        description="Tidak ada produk yang sesuai dengan filter."
        title="Galeri Kosong"
      />
    );
  }

  return (
    <section className="grid gap-6">
      <Helmet>
        <title>Galeri Produk | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Galeri Produk</h1>
        <p className="ts-sm text-text-muted">
          Kelola thumbnail produk dengan preview sebelum upload.
        </p>
      </header>
      <GalleryFilterForm
        categories={categoriesQuery.data ?? []}
        filters={filters}
        onApply={(nextFilters) => {
          setPage(1);
          setFilters(nextFilters);
        }}
      />
      {content}
      <Pagination
        currentPage={pagination.page}
        onPageChange={setPage}
        pageCount={pagination.pageCount}
      />
    </section>
  );
}
