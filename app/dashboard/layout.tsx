import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { createClient } from "@/lib/supabase/server";

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
  const [{ data: ownerMembership }, { data: profileData }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
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
  const profileName = profile?.name?.trim();
  const userLabel = profileName || email || "Usuario";

  return (
    <div className="min-h-screen">
      <DashboardHeader
        userLabel={userLabel}
        avatarUrl={profile?.avatar_url ?? null}
        isOwner={ownerMembership?.role === "owner"}
      />
      {children}
    </div>
  );
}
