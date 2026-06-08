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

  const userLabel =
    typeof data.claims.email === "string" ? data.claims.email : "Usuario";

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader userLabel={userLabel} />
      {children}
    </div>
  );
}
