"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

type PoolBrandingFormProps = {
  poolId: string;
  initialHeaderTitle: string;
  initialLogoUrl: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type PoolBrandingResult = {
  header_title: string | null;
  logo_url: string | null;
};

const LOGO_BUCKET = "pool-logos";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

function isValidLogoUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension) {
    return extension.replace(/[^a-z0-9]/g, "");
  }

  return file.type === "image/svg+xml" ? "svg" : "png";
}

export function PoolBrandingForm({
  poolId,
  initialHeaderTitle,
  initialLogoUrl,
}: PoolBrandingFormProps) {
  const router = useRouter();
  const [headerTitle, setHeaderTitle] = useState(initialHeaderTitle);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const nextHeaderTitle = headerTitle.trim();
    let nextLogoUrl = logoUrl.trim();

    if (!logoFile && !isValidLogoUrl(nextLogoUrl)) {
      setStatus("error");
      setErrorMessage("Informe uma URL iniciando com http:// ou https://.");
      return;
    }

    setStatus("saving");

    const supabase = createClient();

    if (logoFile) {
      if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
        setStatus("error");
        setErrorMessage("Envie uma imagem PNG, JPG, WebP ou SVG.");
        return;
      }

      if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
        setStatus("error");
        setErrorMessage("Envie uma imagem com ate 2 MB.");
        return;
      }

      const extension = getFileExtension(logoFile);
      const path = `${poolId}/logo-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, logoFile, {
          cacheControl: "3600",
          contentType: logoFile.type,
          upsert: true,
        });

      if (uploadError) {
        setStatus("error");
        setErrorMessage("Erro ao enviar logo. Verifique o bucket no Supabase.");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(LOGO_BUCKET)
        .getPublicUrl(path);

      nextLogoUrl = publicUrlData.publicUrl;
      setLogoUrl(nextLogoUrl);
    }

    const { data, error } = await supabase
      .rpc("update_pool_branding", {
        target_pool_id: poolId,
        target_header_title: nextHeaderTitle || null,
        target_logo_url: nextLogoUrl || null,
      })
      .maybeSingle();

    if (error || !data) {
      setStatus("error");
      setErrorMessage("Erro ao salvar aparencia.");
      return;
    }

    const savedBranding = data as PoolBrandingResult;

    setHeaderTitle(savedBranding.header_title ?? "");
    setLogoUrl(savedBranding.logo_url ?? "");
    setLogoFile(null);
    setStatus("saved");
    router.refresh();
  }

  const isSaving = status === "saving";
  const statusLabel = {
    idle: "",
    saving: "Salvando...",
    saved: "Aparencia atualizada com sucesso.",
    error: errorMessage || "Erro ao salvar aparencia.",
  }[status];
  const statusClass = {
    idle: "text-slate-500",
    saving: "text-amber-300 light:text-amber-600",
    saved: "text-emerald-300 light:text-emerald-700",
    error: "text-red-300 light:text-red-600",
  }[status];

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
    >
      <div className="space-y-2">
        <label
          htmlFor="pool-header-title"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Titulo do header
        </label>
        <Input
          id="pool-header-title"
          value={headerTitle}
          onChange={(event) => {
            setHeaderTitle(event.target.value);
            setStatus("idle");
            setErrorMessage("");
          }}
          placeholder="Bolao da Copa"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="pool-logo-url"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          URL do logo
        </label>
        <Input
          id="pool-logo-url"
          value={logoUrl}
          disabled={Boolean(logoFile)}
          onChange={(event) => {
            setLogoUrl(event.target.value);
            setStatus("idle");
            setErrorMessage("");
          }}
          placeholder="https://..."
        />
        <p className="text-xs font-medium text-slate-500 light:text-slate-500">
          Cole uma URL ou envie uma imagem abaixo.
        </p>
      </div>

      <div className="space-y-2 lg:col-span-2">
        <label
          htmlFor="pool-logo-upload"
          className="text-sm font-bold text-slate-200 light:text-slate-700"
        >
          Upload do logo
        </label>
        <label
          htmlFor="pool-logo-upload"
          className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-3 py-3 text-sm font-bold text-slate-200 transition hover:border-emerald-400/70 hover:bg-slate-900 light:border-slate-200 light:bg-slate-50 light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
        >
          <ImageUp size={17} aria-hidden="true" />
          <span className="min-w-0 truncate">
            {logoFile ? logoFile.name : "Selecionar imagem"}
          </span>
          <span className="text-xs font-medium text-slate-500">
            PNG, JPG, WebP ou SVG ate 2 MB
          </span>
        </label>
        <input
          id="pool-logo-upload"
          type="file"
          accept={ALLOWED_LOGO_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setLogoFile(file);
            setStatus("idle");
            setErrorMessage("");
          }}
        />
        {logoFile ? (
          <button
            type="button"
            onClick={() => {
              setLogoFile(null);
              setStatus("idle");
              setErrorMessage("");
            }}
            className="text-xs font-bold text-slate-400 transition hover:text-slate-100 light:text-slate-500 light:hover:text-slate-800"
          >
            Remover imagem selecionada
          </button>
        ) : null}
      </div>

      <Button type="submit" disabled={isSaving} className="lg:self-end">
        <Save size={17} aria-hidden="true" />
        Salvar aparencia
      </Button>

      <p className={`min-h-5 text-sm font-bold lg:col-span-3 ${statusClass}`}>
        {statusLabel}
      </p>
    </form>
  );
}
