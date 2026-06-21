import Link from "next/link";
import { BarChart3, CheckCircle2, Trophy, UsersRound } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

const steps = [
  {
    title: "Crie seu bolao",
    description: "Monte um grupo privado para sua turma acompanhar a competicao.",
    icon: Trophy,
  },
  {
    title: "Convide amigos",
    description: "Chame participantes para entrar na disputa com poucos cliques.",
    icon: UsersRound,
  },
  {
    title: "Faca seus palpites",
    description: "Registre os placares antes dos jogos e acompanhe sua pontuacao.",
    icon: CheckCircle2,
  },
  {
    title: "Acompanhe o ranking",
    description: "Veja quem esta liderando e como a classificacao muda rodada a rodada.",
    icon: BarChart3,
  },
];

function userName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}, profileName?: string | null) {
  const metadataName = user.user_metadata?.name ?? user.user_metadata?.full_name;

  if (profileName?.trim()) {
    return profileName.trim();
  }

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email ?? "Usuario";
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const { data: profileData } = user
    ? await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const profile = profileData as {
    name?: string | null;
    avatar_url?: string | null;
  } | null;
  const userLabel = user ? userName(user, profile?.name) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 light:bg-slate-50 light:text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-black">
          Bolao
        </Link>
        {user && userLabel ? (
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard/groups"
              className="hidden rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-900 hover:text-slate-50 light:text-slate-600 light:hover:bg-white light:hover:text-slate-950 sm:inline-flex"
            >
              Ver palpites
            </Link>
            <UserMenu
              userLabel={userLabel}
              userEmail={user.email}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-900 hover:text-slate-50 light:text-slate-600 light:hover:bg-white light:hover:text-slate-950"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
            >
              Criar conta
            </Link>
          </nav>
        )}
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300 light:text-emerald-700">
            Plataforma de bolao
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">
            Crie seus boloes e dispute palpites com seus amigos
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300 light:text-slate-600">
            Monte grupos privados, convide seus amigos, registre palpites e
            acompanhe a classificacao em tempo real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link
                href="/dashboard/groups"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
              >
                Ver palpites
              </Link>
            ) : (
              <>
                <Link
                  href="/cadastro"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
                >
                  Criar conta
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
                >
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>

        <Card className="p-5 sm:p-6">
          <div className="space-y-4">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-black text-slate-50 light:text-slate-950">
                      {step.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400 light:text-slate-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="border-t border-slate-800 bg-slate-900/45 px-4 py-12 light:border-slate-200 light:bg-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-50 light:text-slate-950">
              Comece seu bolao em poucos minutos
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 light:text-slate-600">
              Nesta primeira etapa, voce ja pode criar sua conta e acessar a
              area logada. As funcionalidades de grupos, convites e palpites
              entram nas proximas etapas.
            </p>
          </div>
          {user ? (
            <Link
              href="/dashboard/groups"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
            >
              Ver palpites
            </Link>
          ) : (
            <Link
              href="/cadastro"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
            >
              Criar conta
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
