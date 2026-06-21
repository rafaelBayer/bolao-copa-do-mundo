"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus } from "lucide-react";
import type { PoolSummary } from "@/components/pools/PoolContextPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

type ProfilePoolsPanelProps = {
  pools: PoolSummary[];
};

export function ProfilePoolsPanel({ pools }: ProfilePoolsPanelProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);

    const supabase = createClient();
    const { error: createError } = await supabase.rpc("create_private_pool", {
      target_name: name,
      target_description: description || null,
    });

    setIsCreating(false);

    if (createError) {
      setError("Nao foi possivel criar o bolao agora.");
      return;
    }

    setName("");
    setDescription("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            Criar bolao privado
          </h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Voce ja participa do Bolao Geral. Crie um bolao privado apenas se quiser disputar com amigos.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start"
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do bolao"
            required
            minLength={2}
          />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descricao opcional"
          />
          <Button type="submit" disabled={isCreating}>
            <Plus size={16} aria-hidden="true" />
            {isCreating ? "Criando..." : "Criar"}
          </Button>
        </form>

        {error ? (
          <p className="mt-3 text-sm font-bold text-red-300 light:text-red-600">
            {error}
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            Seus boloes
          </h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Voce ve apenas os boloes dos quais participa.
          </p>
        </div>

        <div className="divide-y divide-slate-800 light:divide-slate-200">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-50 light:text-slate-950">
                    {pool.name}
                  </h3>
                  <Badge tone={pool.isDefault ? "emerald" : "default"}>
                    {pool.isDefault ? "Geral" : "Privado"}
                  </Badge>
                  <Badge tone={pool.role === "owner" ? "amber" : "default"}>
                    {pool.role === "owner" ? "Owner" : "Membro"}
                  </Badge>
                  {typeof pool.membersCount === "number" ? (
                    <Badge>
                      {pool.membersCount}{" "}
                      {pool.membersCount === 1 ? "membro" : "membros"}
                    </Badge>
                  ) : null}
                </div>
                {pool.description ? (
                  <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                    {pool.description}
                  </p>
                ) : null}
              </div>

              <Link
                href={`/dashboard/groups?pool=${pool.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-bold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-200 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:text-emerald-700"
              >
                <ExternalLink size={15} aria-hidden="true" />
                Ver palpites
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
