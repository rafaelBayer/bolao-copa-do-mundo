import Link from "next/link";
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
type LeaderboardPageProps = {
  searchParams?: Promise<{
    pool?: string | string[];
  }>;
};
type PoolSummary = {
  id: string;
  name: string;
  isDefault: boolean;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapPoolSummary(row: Record<string, unknown>): PoolSummary | null {
  const pool = single(
    row.pools as Record<string, unknown> | Record<string, unknown>[] | null,
  );

  if (!pool?.id) {
    return null;
  }

  return {
    id: String(pool.id),
    name: typeof pool.name === "string" ? pool.name : "Meu bolao",
    isDefault: pool.is_default === true,
  };
}

function sortPools(pools: PoolSummary[]) {
  return [...pools].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
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
            climb:
              (previousPositions.get(entry.userId) ?? entry.position) -
              entry.position,
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

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const requestedPoolId = Array.isArray(resolvedSearchParams?.pool)
    ? resolvedSearchParams?.pool[0]
    : resolvedSearchParams?.pool;
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: membershipsData } = await supabase
    .from("pool_members")
    .select("pool_id, pools(id, name, is_default)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const pools = sortPools(
    (membershipsData ?? [])
      .map((row) => mapPoolSummary(row as Record<string, unknown>))
      .filter((pool): pool is PoolSummary => Boolean(pool)),
  );
  const selectedPool =
    pools.find((pool) => pool.id === requestedPoolId) ?? pools[0] ?? null;

  if (!selectedPool) {
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

  const [{ data, error }, { data: liveData, error: liveError }] =
    await Promise.all([
      supabase.rpc("get_pool_leaderboard_data", {
        target_pool_id: selectedPool.id,
      }),
      supabase.rpc("get_pool_live_leaderboard_data", {
        target_pool_id: selectedPool.id,
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
      {pools.length > 1 ? (
        <Card className="mb-5 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
              Classificacao por bolao
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Escolha qual grupo de participantes voce quer comparar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pools.map((pool) => {
              const isSelected = pool.id === selectedPool.id;

              return (
                <Link
                  key={pool.id}
                  href={`/dashboard/leaderboard?pool=${pool.id}`}
                  aria-current={isSelected ? "page" : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    isSelected
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 light:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700"
                      : "border-slate-800 bg-slate-950/35 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200 light:border-slate-200 light:bg-slate-50 light:text-slate-600 light:hover:border-emerald-300 light:hover:text-emerald-700"
                  }`}
                >
                  {pool.name}
                </Link>
              );
            })}
          </div>
        </Card>
      ) : null}

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
        poolId={selectedPool.id}
        poolName={selectedPool.name}
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
