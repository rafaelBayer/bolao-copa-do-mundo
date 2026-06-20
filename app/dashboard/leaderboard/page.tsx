import { LeaderboardClient } from "@/components/leaderboard/LeaderboardClient";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  buildLeaderboard,
  hasRealResult,
  type LeaderboardDataRow,
} from "@/lib/scoring/buildLeaderboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const rounds = [1, 2, 3];

type LiveLeaderboardDataRow = LeaderboardDataRow & {
  is_live_match?: boolean | null;
  live_matches_count?: number | null;
};
type RoundHighlight = {
  title: string;
  name: string;
  detail: string;
};
type RoundHighlights = {
  star?: RoundHighlight;
  exact?: RoundHighlight;
  climber?: RoundHighlight;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function rowsUntilRound(rows: LeaderboardDataRow[], round: number) {
  return rows.filter(
    (row) => row.round_number !== null && row.round_number <= round,
  );
}

function namesLabel(entries: Array<{ name: string }>) {
  if (entries.length === 0) return "";
  if (entries.length === 1) return entries[0].name;
  if (entries.length === 2) return `${entries[0].name} e ${entries[1].name}`;

  return `${entries[0].name} +${entries.length - 1}`;
}

function buildRoundHighlights(
  rows: LeaderboardDataRow[],
  round: number,
): RoundHighlights {
  const roundEntries = buildLeaderboard(rows, round);
  const star = roundEntries.find((entry) => entry.totalPoints > 0);
  const maxExactScores = Math.max(
    0,
    ...roundEntries.map((entry) => entry.exactScores),
  );
  const exactWinners =
    maxExactScores > 0
      ? roundEntries.filter((entry) => entry.exactScores === maxExactScores)
      : [];
  const previousRows = rowsUntilRound(rows, round - 1);
  const currentRows = rowsUntilRound(rows, round);
  const previousEntries = buildLeaderboard(previousRows);
  const currentEntries = buildLeaderboard(currentRows);
  const previousPositions = new Map(
    previousEntries.map((entry) => [entry.userId, entry.position]),
  );
  const climber =
    round > 1 && hasRealResult(previousRows) && hasRealResult(currentRows)
      ? currentEntries
          .map((entry) => ({
            entry,
            climb: (previousPositions.get(entry.userId) ?? entry.position) - entry.position,
          }))
          .filter((item) => item.climb > 0)
          .sort((left, right) => {
            if (right.climb !== left.climb) return right.climb - left.climb;

            return left.entry.position - right.entry.position;
          })[0]
      : null;

  return {
    star: star
      ? {
          title: `Craque da Rodada ${round}`,
          name: star.name,
          detail: `${star.totalPoints} pontos, ${star.exactScores} placares exatos`,
        }
      : undefined,
    exact:
      exactWinners.length > 0
        ? {
            title: "Rei dos placares",
            name: namesLabel(exactWinners),
            detail: `${maxExactScores} ${
              maxExactScores === 1 ? "placar exato" : "placares exatos"
            }`,
          }
        : undefined,
    climber: climber
      ? {
          title: "Maior subida",
          name: climber.entry.name,
          detail: `Subiu ${climber.climb} ${
            climber.climb === 1 ? "posicao" : "posicoes"
          }`,
        }
      : undefined,
  };
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

  const [{ data, error }, { data: liveData, error: liveError }] =
    await Promise.all([
      supabase.rpc("get_pool_leaderboard_data", {
        target_pool_id: membership.pool_id,
      }),
      supabase.rpc("get_pool_live_leaderboard_data", {
        target_pool_id: membership.pool_id,
      }),
    ]);
  const rows = (data ?? []) as LeaderboardDataRow[];
  const liveRows = (liveData ?? []) as LiveLeaderboardDataRow[];
  const liveMatchesCount = liveRows[0]?.live_matches_count ?? 0;
  const roundLeaderboards = Object.fromEntries(
    rounds.map((round) => [
      round,
      {
        entries: buildLeaderboard(rows, round),
        hasResult: hasRealResult(rows, round),
      },
    ]),
  );
  const roundHighlights = Object.fromEntries(
    rounds.map((round) => [round, buildRoundHighlights(rows, round)]),
  );

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
      {error ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Erro</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Nao foi possivel carregar a classificacao agora.
          </p>
        </Card>
      ) : null}

      {liveError ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Ao vivo</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Nao foi possivel carregar a classificacao ao vivo agora.
          </p>
        </Card>
      ) : null}

      <LeaderboardClient
        poolId={membership.pool_id}
        poolName={poolName}
        generalEntries={buildLeaderboard(rows)}
        hasGeneralResult={hasRealResult(rows)}
        roundLeaderboards={roundLeaderboards}
        roundHighlights={roundHighlights}
        liveEntries={buildLeaderboard(liveRows)}
        hasLiveResult={hasRealResult(liveRows)}
        liveMatchesCount={liveMatchesCount}
      />
    </main>
  );
}
