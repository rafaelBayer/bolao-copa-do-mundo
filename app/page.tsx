import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  GitBranch,
  ListChecks,
  Medal,
  Trophy,
  UsersRound,
} from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

const steps = [
  {
    title: "Crie seu bolão",
    description: "Monte um grupo privado para sua turma acompanhar a competição.",
    icon: Trophy,
  },
  {
    title: "Convide amigos",
    description: "Chame participantes para entrar na disputa com poucos cliques.",
    icon: UsersRound,
  },
  {
    title: "Faça seus palpites",
    description: "Registre os placares antes dos jogos e acompanhe sua pontuação.",
    icon: CheckCircle2,
  },
  {
    title: "Acompanhe o ranking",
    description: "Veja quem está liderando e como a classificação muda rodada a rodada.",
    icon: BarChart3,
  },
];
const mainLinks = [
  {
    href: "/dashboard/groups",
    label: "Palpites",
    description: "Jogos, placares e palpites da fase de grupos.",
    icon: ListChecks,
  },
  {
    href: "/dashboard/leaderboard",
    label: "Classificação",
    description: "Ranking geral, por fase, por rodada e ao vivo.",
    icon: Medal,
  },
  {
    href: "/dashboard/mata-mata",
    label: "Mata-mata",
    description: "Bracket, confrontos oficiais e palpites de vencedor.",
    icon: GitBranch,
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
    : user.email ?? "Usuário";
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
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-black">
          Bolão
        </Link>
        <nav className="order-3 grid w-full grid-cols-3 gap-2 text-xs font-black sm:order-none sm:w-auto sm:flex sm:items-center sm:text-sm">
          {mainLinks.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/55 px-2 text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-200 light:border-slate-200 light:bg-white light:text-slate-600 light:hover:border-emerald-300 light:hover:text-emerald-700 sm:h-auto sm:border-0 sm:bg-transparent sm:px-3 sm:py-2 light:sm:bg-transparent"
              >
                <Icon size={16} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {user && userLabel ? (
          <nav className="flex items-center gap-2">
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
            Plataforma de bolão
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">
            Crie seus bolões e dispute palpites com seus amigos
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300 light:text-slate-600">
            Monte grupos privados, convide seus amigos, registre palpites e
            acompanhe a classificação em tempo real.
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
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {mainLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/55 p-4 transition hover:border-emerald-400/45 hover:bg-slate-900 light:border-slate-200 light:bg-white light:hover:border-emerald-300 light:hover:bg-emerald-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 transition group-hover:bg-emerald-400 group-hover:text-slate-950 light:bg-emerald-50 light:text-emerald-700 light:group-hover:bg-emerald-600 light:group-hover:text-white">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="mt-3 block font-black text-slate-50 light:text-slate-950">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400 light:text-slate-600">
                    {item.description}
                  </span>
                </Link>
              );
            })}
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
              Comece seu bolão em poucos minutos
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 light:text-slate-600">
              Crie sua conta, entre no Bolão Geral, registre seus palpites e
              convide amigos para disputar em bolões privados.
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
