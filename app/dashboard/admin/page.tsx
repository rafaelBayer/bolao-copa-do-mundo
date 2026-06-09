import Link from "next/link";
import { AdminStats } from "@/components/admin/AdminStats";
import { CreateInviteButton } from "@/components/admin/CreateInviteButton";
import { InviteList, type AdminInvite } from "@/components/admin/InviteList";
import {
  ParticipantsList,
  type AdminParticipant,
} from "@/components/admin/ParticipantsList";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PoolInfo = {
  id: string;
  name: string;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapParticipant(row: Record<string, unknown>): AdminParticipant {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    role: String(row.role),
    createdAt: String(row.created_at),
  };
}

function mapInvite(row: Record<string, unknown>): AdminInvite {
  return {
    id: String(row.id),
    token: String(row.token),
    usedBy: typeof row.used_by === "string" ? row.used_by : null,
    usedAt: typeof row.used_at === "string" ? row.used_at : null,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    createdAt: String(row.created_at),
  };
}

function isInviteAvailable(invite: AdminInvite) {
  if (invite.usedAt) {
    return false;
  }

  if (!invite.expiresAt) {
    return true;
  }

  return new Date(invite.expiresAt).getTime() >= Date.now();
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: membership } = await supabase
    .from("pool_members")
    .select("pool_id, role, pools(id, name)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!membership?.pool_id || membership.role !== "owner") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Card className="p-6">
          <Badge tone="amber">Acesso negado</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Area restrita ao dono do bolao
          </h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            Apenas usuarios com role owner podem gerar convites e ver esta area.
          </p>
          <Link
            href="/dashboard/groups"
            className="mt-5 inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
          >
            Voltar para grupos
          </Link>
        </Card>
      </main>
    );
  }

  const rawPool = single(
    (membership as {
      pools?: Record<string, unknown> | Record<string, unknown>[] | null;
    }).pools,
  );
  const pool: PoolInfo = {
    id: String(membership.pool_id),
    name:
      rawPool && typeof rawPool === "object" && "name" in rawPool
        ? String(rawPool.name)
        : "Meu bolao",
  };

  const [{ data: participantsData }, { data: invitesData }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("id, user_id, role, created_at")
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("pool_invites")
      .select("id, token, used_by, used_at, expires_at, created_at")
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false }),
  ]);

  const participants = (participantsData ?? []).map((row) =>
    mapParticipant(row as Record<string, unknown>),
  );
  const invites = (invitesData ?? []).map((row) =>
    mapInvite(row as Record<string, unknown>),
  );
  const availableInvitesCount = invites.filter(isInviteAvailable).length;
  const usedInvitesCount = invites.filter((invite) => invite.usedAt).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="space-y-5">
        <AdminStats
          poolName={pool.name}
          participantsCount={participants.length}
          availableInvitesCount={availableInvitesCount}
          usedInvitesCount={usedInvitesCount}
        />

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
                Novo convite
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                Convites expiram em 7 dias e podem ser usados uma unica vez.
              </p>
            </div>
            <CreateInviteButton poolId={pool.id} userId={userId} />
          </div>
        </Card>

        <InviteList invites={invites} />
        <ParticipantsList participants={participants} />
      </div>
    </main>
  );
}
