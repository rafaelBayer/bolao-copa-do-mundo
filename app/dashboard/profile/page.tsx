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
    .select("name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  const profile = profileData as {
    name?: string | null;
    avatar_url?: string | null;
  } | null;

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <Card className="mx-auto max-w-3xl p-5 sm:p-7">
        <ProfileForm
          userId={userId}
          initialName={profile?.name ?? ""}
          initialAvatarUrl={profile?.avatar_url ?? ""}
        />
      </Card>
    </main>
  );
}
