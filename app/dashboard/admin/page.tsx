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

  const { data: isSystemAdmin } = await supabase.rpc("is_system_admin");

  if (isSystemAdmin !== true) {
    redirect("/dashboard/groups");
  }

  return <AdminRedirect />;
}
