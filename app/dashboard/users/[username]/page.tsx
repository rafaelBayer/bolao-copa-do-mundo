import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type UserProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams?: Promise<{
    pool?: string | string[];
  }>;
};

type VisiblePredictionRow = {
  target_user_id: string;
  target_name: string | null;
  target_username: string | null;
  target_avatar_url: string | null;
  is_current_user: boolean;
  blocked_predictions_count: number;
  prediction_id: string | null;
  match_id: string | null;
  group_id: string | null;
  group_name: string | null;
  round_number: number | null;
  kickoff_at: string | null;
  home_team_name: string | null;
  home_team_code: string | null;
  away_team_name: string | null;
  away_team_code: string | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function initialFromName(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 text-2xl font-black text-slate-200 light:border-slate-200 light:bg-white light:text-slate-700">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initialFromName(name)
      )}
    </span>
  );
}

function EmptyState({
  isCurrentUser,
}: {
  isCurrentUser: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
      {isCurrentUser
        ? "Seus palpites preenchidos aparecem aqui."
        : "Nenhum palpite liberado ainda. Os palpites dos outros participantes aparecem após o início dos jogos."}
    </div>
  );
}

export default async function UserProfilePage({
  params,
  searchParams,
}: UserProfilePageProps) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPoolId = Array.isArray(resolvedSearchParams?.pool)
    ? resolvedSearchParams?.pool[0]
    : resolvedSearchParams?.pool;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-3 py-8 sm:px-5 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Login necessário</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Entre para ver perfis de participantes
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Os perfis fazem parte da área protegida do bolão.
          </p>
          <Link
            href="/login?redirectTo=/dashboard/leaderboard"
            className="mt-5 inline-flex rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
          >
            Entrar
          </Link>
        </Card>
      </main>
    );
  }

  const { data: membershipsData } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const poolIds = (membershipsData ?? []).map((row) =>
    String((row as Record<string, unknown>).pool_id),
  );
  const selectedPoolId =
    (requestedPoolId && poolIds.includes(requestedPoolId)
      ? requestedPoolId
      : null) ??
    poolIds[0] ??
    null;

  if (requestedPoolId && !poolIds.includes(requestedPoolId)) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-3 py-8 sm:px-5 lg:px-8">
        <Card className="p-6">
          <Link
            href="/dashboard/leaderboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para classificação
          </Link>
          <h1 className="mt-5 text-2xl font-black text-slate-50 light:text-slate-950">
            Bolão não encontrado
          </h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
            Esse bolão não existe ou você não tem permissão para ver este contexto.
          </p>
        </Card>
      </main>
    );
  }

  if (!selectedPoolId) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-3 py-8 sm:px-5 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Sem bolão</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite válido para entrar em um bolão.
          </p>
        </Card>
      </main>
    );
  }

  const { data, error } = await supabase.rpc(
    "get_visible_user_predictions_by_username",
    {
      p_target_pool_id: selectedPoolId,
      p_target_username: username,
    },
  );
  const rows = (data ?? []) as VisiblePredictionRow[];
  const profile = single(rows);

  if (error || !profile) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-3 py-8 sm:px-5 lg:px-8">
        <Card className="p-6">
          <Link
            href="/dashboard/leaderboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para classificação
          </Link>
          <h1 className="mt-5 text-2xl font-black text-slate-50 light:text-slate-950">
            Perfil não encontrado
          </h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
            Este participante não existe ou não faz parte do seu bolão.
          </p>
        </Card>
      </main>
    );
  }

  const visiblePredictions = rows.filter((row) => row.prediction_id);
  const name = profile.target_name?.trim() || "Visitante";
  const usernameLabel = profile.target_username || username;
  const stats = visiblePredictions.reduce(
    (currentStats, row) => {
      const score = calculatePredictionScore({
        predictedHomeScore: row.predicted_home_score,
        predictedAwayScore: row.predicted_away_score,
        actualHomeScore: row.actual_home_score,
        actualAwayScore: row.actual_away_score,
      });

      return {
        points: currentStats.points + score.points,
        exactScores:
          currentStats.exactScores + (score.reason === "exact_score" ? 1 : 0),
        correctResults:
          currentStats.correctResults +
          (score.reason === "correct_result" ? 1 : 0),
        filledPredictions: currentStats.filledPredictions + 1,
      };
    },
    {
      points: 0,
      exactScores: 0,
      correctResults: 0,
      filledPredictions: 0,
    },
  );

  return (
    <main className="mx-auto w-full max-w-[1200px] px-3 py-8 sm:px-5 lg:px-8">
      <div className="space-y-5">
        <Link
          href={`/dashboard/leaderboard?pool=${selectedPoolId}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300 transition hover:text-emerald-200 light:text-emerald-700 light:hover:text-emerald-800"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para classificação
        </Link>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={name} avatarUrl={profile.target_avatar_url} />
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-black text-slate-50 light:text-slate-950">
                  {name}
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-400 light:text-slate-500">
                  @{usernameLabel}
                </p>
                <Badge tone={profile.is_current_user ? "emerald" : "default"} className="mt-3">
                  {profile.is_current_user ? "Seu perfil" : "Participante"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[28rem] sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 light:border-slate-200 light:bg-slate-50">
                <p className="text-xl font-black text-emerald-300 light:text-emerald-700">
                  {stats.points}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-400 light:text-slate-500">
                  pontos
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 light:border-slate-200 light:bg-slate-50">
                <p className="text-xl font-black text-slate-50 light:text-slate-950">
                  {stats.exactScores}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-400 light:text-slate-500">
                  exatos
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 light:border-slate-200 light:bg-slate-50">
                <p className="text-xl font-black text-slate-50 light:text-slate-950">
                  {stats.correctResults}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-400 light:text-slate-500">
                  corretos
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3 light:border-slate-200 light:bg-slate-50">
                <p className="text-xl font-black text-slate-50 light:text-slate-950">
                  {stats.filledPredictions}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-slate-400 light:text-slate-500">
                  palpites
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
                Palpites liberados
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                {profile.is_current_user
                  ? "Seus palpites preenchidos aparecem aqui."
                  : "Palpites dos outros participantes aparecem após o início dos jogos."}
              </p>
            </div>
            {profile.blocked_predictions_count > 0 ? (
              <Badge tone="amber">
                {profile.blocked_predictions_count} bloqueados
              </Badge>
            ) : null}
          </div>

          {profile.blocked_predictions_count > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-medium text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
              {profile.blocked_predictions_count} palpites ainda bloqueados
              porque os jogos ainda não começaram.
            </div>
          ) : null}

          {visiblePredictions.length === 0 ? (
            <EmptyState isCurrentUser={profile.is_current_user} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visiblePredictions.map((row) => (
                <div
                  key={row.prediction_id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 light:border-slate-200 light:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      {row.group_name} - Rodada {row.round_number}
                    </p>
                    {row.actual_home_score !== null &&
                    row.actual_away_score !== null ? (
                      <Badge tone="emerald">Resultado</Badge>
                    ) : (
                      <Badge>Sem resultado</Badge>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <p className="min-w-0 text-right text-sm font-bold text-slate-100 light:text-slate-950">
                      {row.home_team_name}
                    </p>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-center font-black text-slate-50 light:border-slate-200 light:bg-white light:text-slate-950">
                      {row.predicted_home_score} x {row.predicted_away_score}
                    </div>
                    <p className="min-w-0 text-sm font-bold text-slate-100 light:text-slate-950">
                      {row.away_team_name}
                    </p>
                  </div>

                  {row.actual_home_score !== null &&
                  row.actual_away_score !== null ? (
                    <p className="mt-3 text-center text-xs font-bold text-slate-400 light:text-slate-500">
                      Real: {row.actual_home_score} x {row.actual_away_score}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
