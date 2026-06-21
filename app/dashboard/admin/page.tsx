import { redirect } from "next/navigation";
import { AdminRedirect } from "@/components/admin/AdminRedirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: membership } = await supabase
    .from("pool_members")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (membership?.role !== "owner") {
    redirect("/dashboard/groups");
  }

  return <AdminRedirect />;
}
