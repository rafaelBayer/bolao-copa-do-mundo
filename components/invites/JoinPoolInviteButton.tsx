"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type JoinPoolInviteButtonProps = {
  inviteCode: string;
  initialPoolId: string;
  isMember: boolean;
};

type JoinResult = {
  pool_id: string;
  pool_name: string;
  already_member: boolean;
  joined: boolean;
};

export function JoinPoolInviteButton({
  inviteCode,
  initialPoolId,
  isMember,
}: JoinPoolInviteButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "joining" | "joined" | "already-member" | "error"
  >(isMember ? "already-member" : "idle");
  const [poolId, setPoolId] = useState(initialPoolId);

  async function joinPool() {
    setStatus("joining");

    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_pool_by_invite_code", {
      target_invite_code: inviteCode,
    });

    if (error) {
      setStatus("error");
      return;
    }

    const result = Array.isArray(data) ? (data[0] as JoinResult | undefined) : null;

    if (!result?.pool_id) {
      setStatus("error");
      return;
    }

    setPoolId(result.pool_id);
    setStatus(result.already_member ? "already-member" : "joined");
    router.refresh();
  }

  if (status === "already-member" || status === "joined") {
    return (
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-800">
          <CheckCircle2 size={17} aria-hidden="true" />
          {status === "joined"
            ? "Você entrou neste bolão."
            : "Você já participa deste bolão."}
        </p>
        <div>
          <Link
            href={`/dashboard/groups?pool=${poolId}`}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
          >
            Acessar bolão
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={joinPool} disabled={status === "joining"}>
        {status === "joining" ? (
          <Loader2 size={17} className="animate-spin" aria-hidden="true" />
        ) : null}
        {status === "joining" ? "Entrando..." : "Entrar no bolão"}
      </Button>

      {status === "error" ? (
        <p className="text-sm font-bold text-red-300 light:text-red-600">
          Não foi possível entrar no bolão agora.
        </p>
      ) : null}
    </div>
  );
}
