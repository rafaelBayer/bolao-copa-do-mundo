"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type PlayoffsAdminPanelProps = {
  poolId: string;
  isEnabled: boolean;
  isLocked: boolean;
  lockAt: string | null;
  startedUsersCount: number;
  matchesCount: number;
};

function formatDeadline(lockAt: string | null) {
  if (!lockAt) {
    return "A definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(lockAt));
}

export function PlayoffsAdminPanel({
  poolId,
  isEnabled,
  isLocked,
  lockAt,
  startedUsersCount,
  matchesCount,
}: PlayoffsAdminPanelProps) {
  const [enabled, setEnabled] = useState(isEnabled);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  function toggleAccess() {
    if (isLocked) {
      return;
    }

    const nextEnabled = !enabled;
    setMessage("Salvando...");

    startTransition(async () => {
      const { error } = await supabase.rpc("admin_set_playoffs_enabled", {
        target_pool_id: poolId,
        target_enabled: nextEnabled,
      });

      if (error) {
        setMessage("Nao foi possivel alterar o acesso.");
        return;
      }

      setEnabled(nextEnabled);
      setMessage(nextEnabled ? "Playoffs liberados." : "Playoffs restritos ao owner.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="grid gap-3 text-sm text-slate-300 light:text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Status
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {isLocked ? "Bloqueado" : enabled ? "Liberado" : "Restrito"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Prazo
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {formatDeadline(lockAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Jogos
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {matchesCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Chaves iniciadas
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {startedUsersCount}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant={enabled ? "secondary" : "primary"}
          disabled={isLocked || isPending}
          onClick={toggleAccess}
          className="w-full lg:w-auto"
        >
          {enabled ? <Lock size={17} aria-hidden="true" /> : <Unlock size={17} aria-hidden="true" />}
          {enabled ? "Restringir ao owner" : "Liberar playoffs"}
        </Button>
        <p className="min-h-5 text-xs font-semibold text-slate-500 light:text-slate-500">
          {isLocked
            ? "O primeiro jogo ja comecou. O acesso de edicao esta bloqueado."
            : message ?? "Membros acessam somente depois da liberacao."}
        </p>
      </div>
    </div>
  );
}
