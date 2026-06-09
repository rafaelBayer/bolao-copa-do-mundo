"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

type ProfileFormProps = {
  userId: string;
  initialName: string;
  initialAvatarUrl: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ProfileForm({
  userId,
  initialName,
  initialAvatarUrl,
}: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [status, setStatus] = useState<SaveStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const supabase = createClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        name: name.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      },
      { onConflict: "id" },
    );

    if (error) {
      setStatus("error");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  const statusLabel = {
    idle: "",
    saving: "Salvando...",
    saved: "Perfil salvo",
    error: "Erro ao salvar",
  }[status];
  const statusClass = {
    idle: "text-slate-500",
    saving: "text-amber-300 light:text-amber-600",
    saved: "text-emerald-300 light:text-emerald-700",
    error: "text-red-300 light:text-red-600",
  }[status];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-2xl font-black text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
          {avatarUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl.trim()}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            (name.trim().charAt(0) || "U").toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-50 light:text-slate-950">
            Perfil
          </h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Nome e foto usados no cabecalho.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
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
            }}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="profile-avatar-url"
            className="text-sm font-bold text-slate-200 light:text-slate-700"
          >
            URL da foto
          </label>
          <Input
            id="profile-avatar-url"
            type="url"
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value);
              setStatus("idle");
            }}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? (
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

      {/* TODO: criar bucket avatars, fazer upload de imagem e salvar URL publica ou path. */}
    </form>
  );
}
