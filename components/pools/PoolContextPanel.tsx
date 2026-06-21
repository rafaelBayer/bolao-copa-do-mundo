"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export type PoolSummary = {
  id: string;
  name: string;
  description: string | null;
  type: "general" | "private";
  isDefault: boolean;
  role: "owner" | "member";
};

type PoolContextPanelProps = {
  pools: PoolSummary[];
  selectedPoolId: string;
};

function poolHref(poolId: string) {
  return `/dashboard/groups?pool=${poolId}`;
}

export function PoolContextPanel({
  pools,
  selectedPoolId,
}: PoolContextPanelProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedPool = pools.find((pool) => pool.id === selectedPoolId);
  const showPoolSwitcher = pools.length > 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);

    const supabase = createClient();
    const { data, error: createError } = await supabase.rpc(
      "create_private_pool",
      {
        target_name: name,
        target_description: description || null,
      },
    );

    setIsCreating(false);

    if (createError || !data) {
      setError("Nao foi possivel criar o bolao agora.");
      return;
    }

    setName("");
    setDescription("");
    router.push(poolHref(String(data)));
    router.refresh();
  }

  return (
    <Card className="mb-5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
              Meus boloes
            </h2>
            {selectedPool ? (
              <Badge tone={selectedPool.isDefault ? "emerald" : "default"}>
                {selectedPool.isDefault ? "Geral" : "Privado"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {selectedPool
              ? `Visualizando ${selectedPool.name}.`
              : "Visualize seus palpites em um bolao."}
          </p>

          {showPoolSwitcher ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {pools.map((pool) => {
                const isSelected = pool.id === selectedPoolId;

                return (
                  <Link
                    key={pool.id}
                    href={poolHref(pool.id)}
                    aria-current={isSelected ? "page" : undefined}
                    className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                      isSelected
                        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 light:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700"
                        : "border-slate-800 bg-slate-950/35 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200 light:border-slate-200 light:bg-slate-50 light:text-slate-600 light:hover:border-emerald-300 light:hover:text-emerald-700"
                    }`}
                  >
                    {pool.name}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-2 sm:min-w-[22rem] sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Novo bolao privado"
              required
              minLength={2}
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descricao opcional"
            />
            {error ? (
              <p className="text-xs font-bold text-red-300 light:text-red-700">
                {error}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={isCreating} className="h-12">
            <Plus size={16} aria-hidden="true" />
            {isCreating ? "Criando..." : "Criar"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
