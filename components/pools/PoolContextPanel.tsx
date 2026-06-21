"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export type PoolSummary = {
  id: string;
  name: string;
  description: string | null;
  type: "general" | "private";
  isDefault: boolean;
  role: "owner" | "member";
  membersCount?: number;
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
  const selectedPool = pools.find((pool) => pool.id === selectedPoolId);
  const showPoolSwitcher = pools.length > 1;

  function openPoolsSettings() {
    document.cookie =
      "bolao_profile_tab=boloes; path=/dashboard; max-age=31536000; samesite=lax";
    router.push("/dashboard/profile");
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

        <button
          type="button"
          onClick={openPoolsSettings}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
        >
          <Settings size={16} aria-hidden="true" />
          Gerenciar boloes
        </button>
      </div>
    </Card>
  );
}
