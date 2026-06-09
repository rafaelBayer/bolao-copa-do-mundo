"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  userId: string;
  initialName: string;
  initialAvatarUrl: string;
};

type SaveStatus = "idle" | "uploading" | "saving" | "saved" | "error";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function extensionFromFile(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return file.name.split(".").pop()?.toLowerCase() || "jpg";
}

function validateAvatarFile(file: File) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    return "Use uma imagem PNG, JPG ou WEBP.";
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return "A imagem deve ter no maximo 2MB.";
  }

  return null;
}

export function ProfileForm({
  userId,
  initialName,
  initialAvatarUrl,
}: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(initialAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!avatarPreviewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setErrorMessage("");
    setStatus("idle");

    if (!file) {
      setAvatarFile(null);
      setAvatarPreviewUrl("");
      return;
    }

    const validationError = validateAvatarFile(file);

    if (validationError) {
      setAvatarFile(null);
      setErrorMessage(validationError);
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const supabase = createClient();
    let nextAvatarUrl = currentAvatarUrl.trim() || null;

    if (avatarFile) {
      setStatus("uploading");

      const fileExtension = extensionFromFile(avatarFile);
      const filePath = `${userId}/avatar-${Date.now()}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, avatarFile, {
          cacheControl: "3600",
          contentType: avatarFile.type,
          upsert: true,
        });

      if (uploadError) {
        setStatus("error");
        setErrorMessage("Erro ao enviar imagem. Tente novamente.");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      nextAvatarUrl = publicUrlData.publicUrl;
    }

    setStatus("saving");
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        name: name.trim() || null,
        avatar_url: nextAvatarUrl,
      },
      { onConflict: "id" },
    );

    if (error) {
      setStatus("error");
      setErrorMessage("Erro ao salvar perfil. Tente novamente.");
      return;
    }

    setCurrentAvatarUrl(nextAvatarUrl ?? "");
    setAvatarFile(null);
    setAvatarPreviewUrl("");
    setStatus("saved");
    router.refresh();
  }

  const statusLabel = {
    idle: "",
    uploading: "Enviando imagem...",
    saving: "Salvando...",
    saved: "Perfil salvo",
    error: errorMessage,
  }[status];
  const statusClass = {
    idle: "text-slate-500",
    uploading: "text-amber-300 light:text-amber-600",
    saving: "text-amber-300 light:text-amber-600",
    saved: "text-emerald-300 light:text-emerald-700",
    error: "text-red-300 light:text-red-600",
  }[status];
  const avatarDisplayUrl = avatarPreviewUrl || currentAvatarUrl.trim();
  const isBusy = status === "uploading" || status === "saving";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-950 text-3xl font-black text-slate-300 shadow-lg shadow-slate-950/20 light:border-slate-200 light:bg-slate-50 light:text-slate-700 light:shadow-slate-200/70">
          {avatarDisplayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarDisplayUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            (name.trim().charAt(0) || "U").toUpperCase()
          )}
          </div>
          <label
            htmlFor="profile-avatar-file"
            className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 shadow-sm transition hover:border-emerald-400 hover:text-emerald-300 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:text-emerald-700"
            title="Alterar foto"
          >
            <Camera size={17} aria-hidden="true" />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-slate-50 light:text-slate-950">
            Perfil
          </h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Nome e foto usados no cabecalho.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label
              htmlFor="profile-avatar-file"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
            >
              <Camera size={17} aria-hidden="true" />
              Alterar foto
            </label>
            <span className="text-xs font-medium text-slate-500 light:text-slate-500">
              PNG, JPG ou WEBP ate 2MB
            </span>
          </div>
          <input
            id="profile-avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="sr-only"
          />
        </div>
      </div>

      <div className="grid gap-5">
        <div className="space-y-2">
          <label
            htmlFor="profile-name"
            className="text-sm font-bold text-slate-200 light:text-slate-700"
          >
            Nome
          </label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setStatus("idle");
              setErrorMessage("");
            }}
            autoComplete="name"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isBusy}>
          {isBusy ? (
            <Loader2 size={17} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={17} aria-hidden="true" />
          )}
          Salvar
        </Button>
        <span className={`min-h-5 text-sm font-bold ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
    </form>
  );
}
