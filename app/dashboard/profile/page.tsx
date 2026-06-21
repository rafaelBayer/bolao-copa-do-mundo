import { cookies } from "next/headers";
import {
  AdminPanelContent,
  normalizeAdminSection,
} from "@/components/admin/AdminPanelContent";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfilePoolsPanel } from "@/components/profile/ProfilePoolsPanel";
import { ProfileSettingsNav } from "@/components/profile/ProfileSettingsNav";
import type { PoolSummary } from "@/components/pools/PoolContextPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileTab = "perfil" | "boloes" | "admin";

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function selectedTab(value: string | string[] | null | undefined): ProfileTab {
  const tab = single(value);

  if (tab === "boloes") {
    return tab;
  }

  if (tab === "admin" || tab === "owner") {
    return "admin";
  }

  return "perfil";
}

function mapPoolSummary(row: Record<string, unknown>): PoolSummary | null {
  const pool = single(
    row.pools as Record<string, unknown> | Record<string, unknown>[] | null,
  );

  if (!pool?.id) {
    return null;
  }

  return {
    id: String(pool.id),
    name: typeof pool.name === "string" ? pool.name : "Meu bolao",
    description:
      typeof pool.description === "string" ? pool.description : null,
    type: pool.type === "general" ? "general" : "private",
    isDefault: pool.is_default === true,
    role: row.role === "owner" ? "owner" : "member",
  };
}

function sortPools(pools: PoolSummary[]) {
  return [...pools].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeTab = selectedTab(cookieStore.get("bolao_profile_tab")?.value);
  const activeAdminSection = normalizeAdminSection(
    cookieStore.get("bolao_admin_section")?.value,
  );
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const email =
    typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email
      : null;

  if (!userId) {
    return null;
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("name, username, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  let profile = profileData as {
    name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;

  if (!profile?.username) {
    const { data: membership } = await supabase
      .from("pool_members")
      .select("pool_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (membership?.pool_id) {
      await supabase.rpc("ensure_user_profile_for_pool", {
        target_pool_id: membership.pool_id,
        preferred_name: profile?.name ?? null,
      });

      const { data: refreshedProfile } = await supabase
        .from("profiles")
        .select("name, username, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      profile = refreshedProfile as typeof profile;
    }
  }

  const { data: membershipsData } = await supabase
    .from("pool_members")
    .select("pool_id, role, pools(id, name, description, type, is_default)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const basePools = sortPools(
    (membershipsData ?? [])
      .map((row) => mapPoolSummary(row as Record<string, unknown>))
      .filter((pool): pool is PoolSummary => Boolean(pool)),
  );
  const poolIds = basePools.map((pool) => pool.id);
  const { data: poolMembersData } =
    poolIds.length > 0
      ? await supabase
          .from("pool_members")
          .select("pool_id")
          .in("pool_id", poolIds)
      : { data: [] };
  const memberCountByPoolId = new Map<string, number>();

  (poolMembersData ?? []).forEach((row) => {
    const poolId = String((row as Record<string, unknown>).pool_id);

    memberCountByPoolId.set(poolId, (memberCountByPoolId.get(poolId) ?? 0) + 1);
  });
  const pools = basePools.map((pool) => ({
    ...pool,
    membersCount: memberCountByPoolId.get(pool.id) ?? 0,
  }));
  const isOwner = pools.some((pool) => pool.role === "owner");
  const visibleTab = activeTab === "admin" && !isOwner ? "perfil" : activeTab;
  const showAdminMenu = visibleTab === "admin" && isOwner;
  const tabs = [
    { id: "perfil" as const, label: "Perfil" },
    { id: "boloes" as const, label: "Boloes" },
    ...(isOwner ? [{ id: "admin" as const, label: "Painel Admin" }] : []),
  ];
  const adminSections = [
    { id: "home" as const, label: "Painel" },
    { id: "matches" as const, label: "Partidas" },
    { id: "scores" as const, label: "Placares" },
    { id: "pools" as const, label: "Boloes" },
    { id: "users" as const, label: "Usuarios" },
    { id: "settings" as const, label: "Configuracoes Admin" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="p-3 lg:sticky lg:top-24 lg:self-start">
          <ProfileSettingsNav
            tabs={tabs}
            adminSections={adminSections}
            activeTab={visibleTab}
            activeAdminSection={activeAdminSection}
            showAdminMenu={showAdminMenu}
          />
        </Card>

        <div className="min-w-0">
          {visibleTab === "perfil" ? (
            <Card className="p-5 sm:p-7">
              {email ? (
                <div className="mb-5">
                  <Badge>Email</Badge>
                  <p className="mt-2 text-sm font-bold text-slate-300 light:text-slate-700">
                    {email}
                  </p>
                </div>
              ) : null}
              <ProfileForm
                userId={userId}
                initialName={profile?.name ?? ""}
                initialUsername={profile?.username ?? ""}
                initialAvatarUrl={profile?.avatar_url ?? ""}
              />
            </Card>
          ) : null}

          {visibleTab === "boloes" ? <ProfilePoolsPanel pools={pools} /> : null}

          {visibleTab === "admin" && isOwner ? (
            <AdminPanelContent
              userId={userId}
              section={activeAdminSection}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
