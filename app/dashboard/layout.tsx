import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KnockoutGlobalNotice } from "@/components/knockout/KnockoutGlobalNotice";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KNOCKOUT_TOURNAMENT_KEY } from "@/lib/knockout/bracketStructure";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return {
      icons: {
        icon: "/icon.svg",
      },
    };
  }

  const { data: membershipData } = await supabase
    .from("pool_members")
    .select("pool_id, pools(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const membership = membershipData as {
    pool_id?: string | null;
    pools?:
      | {
          name?: string | null;
        }
      | {
          name?: string | null;
        }[]
      | null;
  } | null;
  const pool = Array.isArray(membership?.pools)
    ? membership?.pools[0]
    : membership?.pools;
  const { data: brandingData } = membership?.pool_id
    ? await supabase
        .from("pools")
        .select("header_title, logo_url")
        .eq("id", membership.pool_id)
        .maybeSingle()
    : { data: null };
  const branding = brandingData as {
    header_title?: string | null;
    logo_url?: string | null;
  } | null;
  const brandTitle =
    branding?.header_title?.trim() || pool?.name?.trim() || "Bolao da Copa";
  const brandLogoUrl = branding?.logo_url?.trim() || "/icon.svg";

  return {
    title: brandTitle,
    icons: {
      icon: brandLogoUrl,
      shortcut: brandLogoUrl,
      apple: brandLogoUrl,
    },
  };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  const userId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  const metadata = data.claims.user_metadata;
  const preferredName =
    metadata &&
    typeof metadata === "object" &&
    "name" in metadata &&
    typeof metadata.name === "string"
      ? metadata.name
      : null;

  const { data: existingMembershipData } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error: defaultPoolError } = existingMembershipData?.pool_id
    ? { error: null }
    : await supabase.rpc("ensure_default_pool_membership", {
        preferred_name: preferredName,
      });

  if (defaultPoolError) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to ensure default pool membership", defaultPoolError);
    }
  }

  const [
    { data: membershipData },
    { data: profileData },
    { data: knockoutNoticeData },
  ] = await Promise.all([
    supabase
      .from("pool_members")
      .select("pool_id, pools(name)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("get_knockout_notice_state", {
      target_tournament_key: KNOCKOUT_TOURNAMENT_KEY,
    }),
  ]);
  const profile = profileData as {
    name?: string | null;
    avatar_url?: string | null;
  } | null;
  const membership = membershipData as {
    pool_id?: string | null;
    pools?:
      | {
          name?: string | null;
        }
      | {
          name?: string | null;
        }[]
      | null;
  } | null;
  const pool = Array.isArray(membership?.pools)
    ? membership?.pools[0]
    : membership?.pools;
  const { data: brandingData } = membership?.pool_id
    ? await supabase
        .from("pools")
        .select("header_title, logo_url")
        .eq("id", membership.pool_id)
        .maybeSingle()
    : { data: null };
  const branding = brandingData as {
    header_title?: string | null;
    logo_url?: string | null;
  } | null;
  const brandTitle =
    branding?.header_title?.trim() || pool?.name?.trim() || "Bolao da Copa";
  const brandLogoUrl = branding?.logo_url?.trim() || null;
  const profileName = profile?.name?.trim();
  const userLabel = profileName || email || "Usuario";
  const knockoutNotice = Array.isArray(knockoutNoticeData)
    ? (knockoutNoticeData[0] as Record<string, unknown> | undefined)
    : (knockoutNoticeData as Record<string, unknown> | null);

  if (defaultPoolError && !membershipData) {
    return (
      <div className="min-h-screen">
        <DashboardHeader
          userLabel={userLabel}
          userEmail={email}
          avatarUrl={profile?.avatar_url ?? null}
          brandTitle={brandTitle}
          brandLogoUrl={brandLogoUrl}
        />
        <main className="mx-auto w-full max-w-[960px] px-3 py-8 sm:px-5 lg:px-8">
          <Card className="p-6">
            <Badge tone="amber">Configuracao</Badge>
            <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
              Nao foi possivel preparar seu Bolao Geral
            </h1>
            <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
              O sistema nao conseguiu vincular sua conta ao bolao padrao.
              Tente novamente em alguns instantes ou avise o administrador.
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader
        userLabel={userLabel}
        userEmail={email}
        avatarUrl={profile?.avatar_url ?? null}
        brandTitle={brandTitle}
        brandLogoUrl={brandLogoUrl}
      />
      {knockoutNotice ? (
        <KnockoutGlobalNotice
          isAvailable={knockoutNotice.is_available === true}
          openPicksCount={
            typeof knockoutNotice.open_picks_count === "number"
              ? knockoutNotice.open_picks_count
              : 0
          }
          submittedOpenPicksCount={
            typeof knockoutNotice.submitted_open_picks_count === "number"
              ? knockoutNotice.submitted_open_picks_count
              : 0
          }
          missingOpenPicksCount={
            typeof knockoutNotice.missing_open_picks_count === "number"
              ? knockoutNotice.missing_open_picks_count
              : 0
          }
          nextLockAt={
            typeof knockoutNotice.next_lock_at === "string"
              ? knockoutNotice.next_lock_at
              : null
          }
        />
      ) : null}
      {children}
    </div>
  );
}
