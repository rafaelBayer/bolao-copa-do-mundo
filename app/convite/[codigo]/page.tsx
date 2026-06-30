import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { JoinPoolInviteButton } from "@/components/invites/JoinPoolInviteButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{
    codigo: string;
  }>;
};

type InviteInfo = {
  pool_id: string | null;
  pool_name: string | null;
  pool_description: string | null;
  invite_code: string | null;
  is_valid: boolean;
  is_member: boolean;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { codigo } = await params;
  const inviteCode = decodeURIComponent(codigo).trim();
  const supabase = await createClient();
  const [{ data: userData }, { data: inviteData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_pool_invite_by_code", {
      target_invite_code: inviteCode,
    }),
  ]);
  const user = userData.user;
  const invite = (Array.isArray(inviteData)
    ? inviteData[0]
    : null) as InviteInfo | null;
  const isValid = invite?.is_valid === true && invite.pool_id && invite.invite_code;
  const invitePath = `/convite/${encodeURIComponent(inviteCode)}`;

  if (!isValid) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl p-6 sm:p-8">
          <Badge tone="amber">Convite inválido</Badge>
          <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950">
            Não encontramos este convite
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-500">
            O código pode estar incorreto ou o bolão privado pode não aceitar
            entrada por este link.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
            >
              Voltar para a home
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl p-6 sm:p-8">
        <Badge tone="emerald">Convite de bolão</Badge>
        <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950">
          Você foi convidado para o bolão &quot;{invite.pool_name}&quot;
        </h1>
        <p className="mt-3 text-sm text-slate-400 light:text-slate-500">
          {invite.pool_description?.trim()
            ? invite.pool_description
            : "Entre com sua conta para participar da disputa com seus amigos."}
        </p>
        <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-2 text-sm text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
          Seus palpites continuam globais: o mesmo palpite vale no Bolão Geral
          e neste bolão privado.
        </p>

        <div className="mt-6">
          {user ? (
            <JoinPoolInviteButton
              inviteCode={invite.invite_code ?? inviteCode}
              initialPoolId={invite.pool_id ?? ""}
              isMember={invite.is_member === true}
            />
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/login?redirectTo=${encodeURIComponent(invitePath)}`}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
              >
                Entrar
              </Link>
              <Link
                href={`/cadastro?redirectTo=${encodeURIComponent(invitePath)}`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
              >
                Criar conta
              </Link>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
