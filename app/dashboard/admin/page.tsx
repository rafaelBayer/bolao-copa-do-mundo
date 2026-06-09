import { redirect } from "next/navigation";
import { AdminStats } from "@/components/admin/AdminStats";
import { CreateInviteButton } from "@/components/admin/CreateInviteButton";
import { InviteList, type AdminInvite } from "@/components/admin/InviteList";
import {
  ParticipantsList,
  type AdminParticipant,
} from "@/components/admin/ParticipantsList";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PoolInfo = {
  id: string;
  name: string;
};

type AdminParticipantRow = {
  user_id: string;
  role: string;
  created_at: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapParticipant(row: Record<string, unknown>): AdminParticipant {
  const userId = String(row.user_id);

  return {
    id: userId,
    userId,
    role: String(row.role),
    createdAt: String(row.created_at),
    name: typeof row.name === "string" ? row.name : null,
    email: typeof row.email === "string" ? row.email : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
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
    redirect("/dashboard/groups");
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
    supabase.rpc("get_pool_participants", {
      target_pool_id: pool.id,
    }),
    supabase
      .from("pool_invites")
      .select("id, token, used_by, used_at, expires_at, created_at")
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false }),
  ]);

  const participants = ((participantsData ?? []) as AdminParticipantRow[]).map((row) =>
    mapParticipant(row as Record<string, unknown>),
  );
  const invites = (invitesData ?? []).map((row) =>
    mapInvite(row as Record<string, unknown>),
  );
  const availableInvitesCount = invites.filter(isInviteAvailable).length;
  const usedInvitesCount = invites.filter((invite) => invite.usedAt).length;

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
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
