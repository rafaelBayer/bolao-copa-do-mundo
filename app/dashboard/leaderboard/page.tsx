import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { calculatePredictionScore } from "@/lib/scoring/calculatePredictionScore";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LeaderboardDataRow = {
  user_id: string;
  profile_name: string | null;
  avatar_url: string | null;
  match_id: string | null;
  round_number: number | null;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  actual_home_score: number | null;
  actual_away_score: number | null;
};

type LeaderboardEntry = {
  position: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalPoints: number;
  exactScores: number;
  correctResults: number;
  scoredMatches: number;
  filledPredictions: number;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function participantName(row: LeaderboardDataRow) {
  const profileName = row.profile_name?.trim();

  return profileName || "Visitante";
}

function participantInitial(entry: Pick<LeaderboardEntry, "name">) {
  return entry.name.trim().charAt(0).toUpperCase() || "U";
}

function sortEntries(entries: LeaderboardEntry[]) {
  return entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.correctResults !== a.correctResults) {
      return b.correctResults - a.correctResults;
    }
    if (b.filledPredictions !== a.filledPredictions) {
      return b.filledPredictions - a.filledPredictions;
    }

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function buildLeaderboard(rows: LeaderboardDataRow[], roundNumber?: number) {
  const entriesByUserId = new Map<string, LeaderboardEntry>();

  rows.forEach((row) => {
    if (roundNumber && row.round_number !== roundNumber) {
      return;
    }

    const entry =
      entriesByUserId.get(row.user_id) ??
      ({
        position: 0,
        userId: row.user_id,
        name: participantName(row),
        avatarUrl: row.avatar_url,
        totalPoints: 0,
        exactScores: 0,
        correctResults: 0,
        scoredMatches: 0,
        filledPredictions: 0,
      } satisfies LeaderboardEntry);

    const score = calculatePredictionScore({
      predictedHomeScore: row.predicted_home_score,
      predictedAwayScore: row.predicted_away_score,
      actualHomeScore: row.actual_home_score,
      actualAwayScore: row.actual_away_score,
    });

    const hasCompletePrediction =
      row.predicted_home_score !== null && row.predicted_away_score !== null;
    const hasResult =
      row.actual_home_score !== null && row.actual_away_score !== null;

    if (hasCompletePrediction) {
      entry.filledPredictions += 1;
    }

    if (hasCompletePrediction && hasResult) {
      entry.scoredMatches += 1;
    }

    entry.totalPoints += score.points;

    if (score.reason === "exact_score") {
      entry.exactScores += 1;
    }

    if (score.reason === "correct_result") {
      entry.correctResults += 1;
    }

    entriesByUserId.set(row.user_id, entry);
  });

  return sortEntries(Array.from(entriesByUserId.values())).map(
    (entry, index) => ({
      ...entry,
      position: index + 1,
    }),
  );
}

function hasRealResult(rows: LeaderboardDataRow[], roundNumber?: number) {
  return rows.some((row) => {
    if (roundNumber && row.round_number !== roundNumber) {
      return false;
    }

    return row.actual_home_score !== null && row.actual_away_score !== null;
  });
}

function ParticipantAvatar({
  entry,
  size = "md",
}: {
  entry: Pick<LeaderboardEntry, "avatarUrl" | "name">;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 font-black text-slate-200 light:border-slate-200 light:bg-white light:text-slate-700`}
    >
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        participantInitial(entry)
      )}
    </span>
  );
}

function PodiumCard({
  entry,
  highlight = false,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-emerald-400/30 bg-emerald-400/10 light:border-emerald-200 light:bg-emerald-50"
          : "border-slate-800 bg-slate-950/35 light:border-slate-200 light:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-emerald-300 light:bg-white light:text-emerald-700">
          {entry.position}o
        </div>
        <ParticipantAvatar entry={entry} size={highlight ? "lg" : "md"} />
        <div className="min-w-0">
          <p className="truncate font-black text-slate-50 light:text-slate-950">
            {entry.name}
          </p>
          <p className="mt-1 text-sm font-bold text-emerald-300 light:text-emerald-700">
            {entry.totalPoints} pts
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
        <span>PE: {entry.exactScores}</span>
        <span>RC: {entry.correctResults}</span>
      </div>
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 light:border-slate-200">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3 text-right">Pts</th>
              <th className="px-4 py-3 text-right">PE</th>
              <th className="px-4 py-3 text-right">RC</th>
              <th className="px-4 py-3 text-right">JP</th>
              <th className="px-4 py-3 text-right">PF</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.userId}
                className="border-b border-slate-800/70 light:border-slate-200/80"
              >
                <td className="px-4 py-3 text-lg font-black text-slate-50 light:text-slate-950">
                  {entry.position}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ParticipantAvatar entry={entry} size="sm" />
                    <p className="font-bold text-slate-100 light:text-slate-950">
                      {entry.name}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-black text-emerald-300 light:text-emerald-700">
                  {entry.totalPoints}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.exactScores}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.correctResults}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.scoredMatches}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.filledPredictions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-800 md:hidden light:divide-slate-200">
        {entries.map((entry) => (
          <div key={entry.userId} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-lg font-black text-slate-50 light:text-slate-950">
                  {entry.position}
                </span>
                <ParticipantAvatar entry={entry} size="sm" />
                <p className="truncate font-bold text-slate-100 light:text-slate-950">
                  {entry.name}
                </p>
              </div>
              <p className="text-lg font-black text-emerald-300 light:text-emerald-700">
                {entry.totalPoints} pts
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
              <span>PE {entry.exactScores}</span>
              <span>RC {entry.correctResults}</span>
              <span>JP {entry.scoredMatches}</span>
              <span>PF {entry.filledPredictions}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: membership } = await supabase
    .from("pool_members")
    .select("pool_id, pools(id, name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership?.pool_id) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Sem bolao</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Classificacao
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite valido para entrar em um bolao.
          </p>
        </Card>
      </main>
    );
  }

  const rawPool = single(
    (membership as {
      pools?: Record<string, unknown> | Record<string, unknown>[] | null;
    }).pools,
  );
  const poolName =
    rawPool && typeof rawPool === "object" && "name" in rawPool
      ? String(rawPool.name)
      : "Meu bolao";

  const { data, error } = await supabase.rpc("get_pool_leaderboard_data", {
    target_pool_id: membership.pool_id,
  });
  const rows = (data ?? []) as LeaderboardDataRow[];
  const leaderboard = buildLeaderboard(rows);
  const roundOneLeaderboard = buildLeaderboard(rows, 1).filter(
    (entry) => entry.totalPoints > 0,
  );
  const topRoundOne = roundOneLeaderboard.slice(0, 3);
  const hasAnyResult = hasRealResult(rows);
  const hasRoundOneResult = hasRealResult(rows, 1);

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <div className="space-y-5">
        <Card className="overflow-hidden p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Badge tone="emerald">{poolName}</Badge>
              <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950 sm:text-4xl">
                Classificacao
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-400 light:text-slate-500">
                Ranking dos participantes com base nos jogos que ja possuem resultado.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:min-w-[24rem]">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
                <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                  {leaderboard.length}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                  usuarios
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
                <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                  {leaderboard[0]?.totalPoints ?? 0}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                  lider
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 light:border-emerald-200 light:bg-emerald-50">
                <p className="text-2xl font-black text-emerald-300 light:text-emerald-700">
                  3/1/0
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-200/80 light:text-emerald-700">
                  pontos
                </p>
              </div>
            </div>
          </div>
        </Card>

        {error ? (
          <Card className="p-5">
            <Badge tone="amber">Erro</Badge>
            <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
              Nao foi possivel carregar a classificacao agora.
            </p>
          </Card>
        ) : null}

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
                Top 3 da Rodada 1
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                Desempenho considerando apenas jogos da primeira rodada.
              </p>
            </div>
          </div>

          {!hasRoundOneResult ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
              A rodada 1 ainda nao possui jogos com resultado.
            </div>
          ) : topRoundOne.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
              Nenhum participante pontuou na rodada 1 ainda.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {topRoundOne.map((entry, index) => (
                <PodiumCard
                  key={entry.userId}
                  entry={entry}
                  highlight={index === 0}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Tabela geral
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Pts = pontos, PE = placares exatos, RC = resultados corretos, JP = jogos pontuados, PF = palpites feitos.
            </p>
          </div>

          {!hasAnyResult ? (
            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-medium text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
              A classificacao sera atualizada quando os primeiros resultados forem cadastrados.
            </div>
          ) : null}

          <LeaderboardTable entries={leaderboard} />
        </Card>
      </div>
    </main>
  );
}
