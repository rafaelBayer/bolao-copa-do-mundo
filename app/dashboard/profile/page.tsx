import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

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

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <Card className="mx-auto max-w-3xl p-5 sm:p-7">
        <ProfileForm
          userId={userId}
          initialName={profile?.name ?? ""}
          initialUsername={profile?.username ?? ""}
          initialAvatarUrl={profile?.avatar_url ?? ""}
        />
      </Card>
    </main>
  );
}
