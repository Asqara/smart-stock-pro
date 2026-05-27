"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Helmet } from "react-helmet-async";

import { Button, ButtonExternalLink, Progress } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { APP_META_DESCRIPTION } from "@/constants/app";
import { IMPORT_MAX_FILE_SIZE_BYTES, IMPORT_REQUIRED_COLUMNS } from "@/constants/inventory";
import { API_ROUTES, ROUTES } from "@/constants/routes";
import { eden } from "@/lib/eden";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { mc } from "@/utils/mc";

type Step = "upload" | "processing" | "result";

type UploadImportResponse = {
  batch: { id: string };
  jobId: string;
};

function readFileAsDataBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new DOMException("File import gagal dibaca."));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function useJobStatus(jobId: string | null) {
  return useQuery({
    enabled: Boolean(jobId),
    queryFn: async () => {
      const response = await eden.api.v1.jobs({ id: jobId! }).get();
      if (response.error) throw response.error;

      return response.data;
    },
    queryKey: ["job", jobId],
    refetchInterval: 2000,
  });
}

/**
 * Import create page with stepper UI.
 */
export default function ImportCreatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const jobQuery = useJobStatus(jobId);
  const job = jobQuery.data as { progress: number; status: string; errorMessage?: string | null } | undefined;

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileType =
        file.type === "text/csv" ||
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === ""
          ? file.type
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const response = await eden.api.v1.imports.upload.post({
        dataBase64: await readFileAsDataBase64(file),
        fileName: file.name,
        fileSize: file.size,
        fileType,
      });

      if (response.error) throw response.error;

      return response.data as UploadImportResponse;
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Upload gagal."));
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setBatchId(data.batch.id);
      setStep("processing");
    },
  });

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Format file harus Excel (.xlsx).");
      return;
    }

    if (file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
      toast.error("Ukuran file maksimal 10 MB.");
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isJobDone = job?.status === "COMPLETED" || job?.status === "FAILED";
  const progress = job?.progress ?? 0;

  return (
    <section className="grid max-w-3xl gap-6">
      <Helmet>
        <title>Import Produk | SmartStock Pro</title>
        <meta content={APP_META_DESCRIPTION} name="description" />
      </Helmet>
      <header className="grid gap-2">
        <h1 className="ts-3xl text-text-strong">Import Produk</h1>
        <p className="ts-sm text-text-muted">
          Unggah file Excel dari template untuk mengimpor data produk dan stok.
        </p>
      </header>

      {step === "upload" ? (
        <section className="grid gap-6">
          <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
            <h2 className="ts-lg mb-4 font-semibold text-text-strong">Kolom yang Diperlukan</h2>
            <ul className="grid list-disc gap-1 pl-5 ts-sm text-text-default">
              {IMPORT_REQUIRED_COLUMNS.map((col) => (
                <li key={col}>
                  <code className="ts-mono-xs rounded bg-muted-surface px-1">{col}</code>
                </li>
              ))}
            </ul>
            <section className="mt-4">
              <ButtonExternalLink
                download="smartstock-products-import-template.xlsx"
                href={API_ROUTES.IMPORTS_TEMPLATE}
                leftIcon={<Download />}
                rel=""
                target="_self"
                variant="secondary"
              >
                Unduh Template Excel
              </ButtonExternalLink>
            </section>
          </article>

          <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
            <h2 className="ts-lg mb-4 font-semibold text-text-strong">Unggah File</h2>
            <section
              className={mc(
                "grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                dragOver
                  ? "border-primary-blue bg-primary-blue/5"
                  : "border-border-default bg-muted-surface hover:border-primary-blue",
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDrop={handleDrop}
            >
              <FileText aria-hidden="true" className="mb-3 size-10 text-text-muted" />
              {selectedFile ? (
                <section>
                  <p className="ts-sm font-medium text-text-strong">{selectedFile.name}</p>
                  <p className="ts-xs text-text-muted">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </section>
              ) : (
                <section>
                  <p className="ts-sm font-medium text-text-strong">
                    Drag & drop atau klik untuk pilih file
                  </p>
                  <p className="ts-xs text-text-muted">Excel (.xlsx), maksimal 10 MB</p>
                </section>
              )}
            </section>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              ref={fileInputRef}
              type="file"
            />
            <section className="mt-4 flex gap-3">
              <Button
                disabled={!selectedFile || uploadMutation.isPending}
                leftIcon={<Upload />}
                onClick={() => { if (selectedFile) uploadMutation.mutate(selectedFile); }}
                type="button"
              >
                {uploadMutation.isPending ? "Mengunggah..." : "Mulai Import"}
              </Button>
            </section>
          </article>
        </section>
      ) : null}

      {step === "processing" ? (
        <article className="rounded-xl border border-border-default bg-card-surface p-6 shadow-sm">
          <h2 className="ts-lg mb-4 font-semibold text-text-strong">
            {isJobDone ? "Import Selesai" : "Import Sedang Diproses"}
          </h2>
          <section className="grid gap-4">
            <Progress label="Progres Import" value={progress} />
            <p className="ts-sm text-text-muted">
              {job?.status === "PROCESSING"
                ? "Import sedang diproses. Halaman ini akan diperbarui otomatis."
                : job?.status === "COMPLETED"
                  ? "Import selesai."
                  : job?.status === "FAILED"
                    ? `Import gagal: ${job.errorMessage ?? "Error tidak diketahui."}`
                    : "Menunggu worker..."}
            </p>
            {isJobDone && batchId ? (
              <section className="flex gap-3">
                <Button
                  onClick={() => router.push(ROUTES.IMPORTS.DETAIL(batchId))}
                  type="button"
                >
                  Lihat Hasil Import
                </Button>
                <Button
                  onClick={() => {
                    setStep("upload");
                    setSelectedFile(null);
                    setJobId(null);
                    setBatchId(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Import Lagi
                </Button>
              </section>
            ) : null}
          </section>
        </article>
      ) : null}
    </section>
  );
}
