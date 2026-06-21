import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
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

  const { error: defaultPoolError } = await supabase.rpc(
    "ensure_default_pool_membership",
    {
      preferred_name: preferredName,
    },
  );

  if (defaultPoolError && process.env.NODE_ENV === "development") {
    console.error(defaultPoolError);
  }

  const [
    { data: ownerMembership },
    { data: membershipData },
    { data: profileData },
  ] = await Promise.all([
    supabase
      .from("pool_members")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle(),
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
  const isOwner = ownerMembership?.role === "owner";

  return (
    <div className="min-h-screen">
      <DashboardHeader
        userLabel={userLabel}
        userEmail={email}
        avatarUrl={profile?.avatar_url ?? null}
        showPlayoffs={isOwner}
        brandTitle={brandTitle}
        brandLogoUrl={brandLogoUrl}
      />
      {children}
    </div>
  );
}
