"use client";

import { useState } from "react";
import { Clipboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

export type AdminInvite = {
  id: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
  usesCount: number;
};

type InviteListProps = {
  invites: AdminInvite[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function inviteStatus(invite: AdminInvite) {
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return "Expirado";
  }

  return "Ativo";
}

function statusTone(status: string): "default" | "emerald" | "amber" {
  if (status === "Ativo") return "emerald";
  if (status === "Expirado") return "amber";
  return "default";
}

export function InviteList({ invites }: InviteListProps) {
  const router = useRouter();
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{
    inviteId: string;
    type: "deleted" | "error";
  } | null>(null);

  async function copyInvite(invite: AdminInvite) {
    const link = `${window.location.origin}/register?invite=${invite.token}`;

    await navigator.clipboard.writeText(link);
    setCopiedInviteId(invite.id);
    window.setTimeout(() => setCopiedInviteId(null), 1800);
  }

  async function deleteInvite(invite: AdminInvite) {
    const confirmed = window.confirm(
      "Excluir este link de convite? Participantes que ja entraram permanecem no bolao.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingInviteId(invite.id);
    setDeleteStatus(null);

    const supabase = createClient();
    const { data: deletedInvite, error } = await supabase
      .from("pool_invites")
      .delete()
      .eq("id", invite.id)
      .select("id")
      .maybeSingle();

    setDeletingInviteId(null);

    if (error || !deletedInvite) {
      setDeleteStatus({ inviteId: invite.id, type: "error" });
      return;
    }

    setDeleteStatus({ inviteId: invite.id, type: "deleted" });
    router.refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            Convites
          </h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Links de cadastro por convite para novos participantes.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {invites.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
            Nenhum convite criado ainda.
          </div>
        ) : null}

        {invites.map((invite) => {
          const status = inviteStatus(invite);
          const inviteLink = `/register?invite=${invite.token}`;

          return (
            <div
              key={invite.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 light:border-slate-200 light:bg-slate-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(status)}>{status}</Badge>
                    {copiedInviteId === invite.id ? (
                      <span className="text-xs font-bold text-emerald-300 light:text-emerald-700">
                        Copiado!
                      </span>
                    ) : null}
                    {deleteStatus?.inviteId === invite.id ? (
                      <span
                        className={`text-xs font-bold ${
                          deleteStatus.type === "deleted"
                            ? "text-emerald-300 light:text-emerald-700"
                            : "text-red-300 light:text-red-600"
                        }`}
                      >
                        {deleteStatus.type === "deleted"
                          ? "Convite excluido"
                          : "Erro ao excluir convite"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 break-all font-mono text-xs text-slate-300 light:text-slate-700">
                    {inviteLink}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 light:text-slate-500 sm:grid-cols-3">
                    <span>Criado: {formatDate(invite.createdAt)}</span>
                    <span>Expira: {formatDate(invite.expiresAt)}</span>
                    <span>Usos: {invite.usesCount}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copyInvite(invite)}
                  >
                    <Clipboard size={16} aria-hidden="true" />
                    Copiar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deletingInviteId === invite.id}
                    onClick={() => deleteInvite(invite)}
                    title="Excluir convite"
                    className="text-red-300 hover:bg-red-500/10 hover:text-red-200 light:text-red-700 light:hover:bg-red-50 light:hover:text-red-800"
                  >
                    {deletingInviteId === invite.id
                      ? "Excluindo..."
                      : "Excluir"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
