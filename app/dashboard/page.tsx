import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

const LEGACY_USER_CUTOFF = new Date("2026-06-20T00:00:00-03:00");

function userName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName = user.user_metadata?.name ?? user.user_metadata?.full_name;

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email ?? "Usuario";
}

function isLegacyUser(createdAt?: string | null) {
  if (!createdAt) {
    return false;
  }

  const createdAtDate = new Date(createdAt);

  return (
    !Number.isNaN(createdAtDate.getTime()) &&
    createdAtDate < LEGACY_USER_CUTOFF
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const [{ data: membership }, { data: existingPrediction }] =
    await Promise.all([
      supabase
        .from("pool_members")
        .select("pool_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("predictions")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle(),
    ]);
  const shouldSkipInitialFlow =
    isLegacyUser(data.user.created_at) ||
    Boolean(membership?.pool_id) ||
    Boolean(existingPrediction?.id);

  if (shouldSkipInitialFlow) {
    redirect("/dashboard/groups");
  }

  const name = userName(data.user);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300 light:text-emerald-700">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-50 light:text-slate-950">
            Bem-vindo, {name}
          </h1>
        </div>
        <SignOutButton />
      </header>

      <section className="mt-8">
        <Card className="p-6 sm:p-8">
          <h2 className="text-2xl font-black text-slate-50 light:text-slate-950">
            Sua conta esta pronta
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 light:text-slate-600">
            Esta e a area inicial autenticada do Bolao. Nas proximas etapas,
            voce podera criar boloes, convidar amigos, registrar palpites e
            acompanhar rankings.
          </p>
          <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 light:border-emerald-200 light:bg-emerald-50">
            <p className="text-sm font-bold text-emerald-200 light:text-emerald-900">
              Proxima etapa
            </p>
            <p className="mt-1 text-sm text-emerald-100/80 light:text-emerald-800">
              Implementar criacao de boloes, convites e o primeiro fluxo de
              palpites.
            </p>
          </div>
        </Card>
      </section>
    </main>
  );
}
