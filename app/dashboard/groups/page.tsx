import { GroupsDashboardClient } from "@/components/groups/GroupsDashboardClient";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import type { PoolSummary } from "@/components/pools/PoolContextPanel";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { MatchGoal, Team } from "@/types/match";
import type { Prediction } from "@/types/prediction";

export const dynamic = "force-dynamic";

type PoolInfo = {
  id: string;
  name: string;
};
type GroupsPageProps = {
  searchParams?: Promise<{
    pool?: string | string[];
  }>;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapTeam(team: Record<string, unknown> | null): Team | null {
  if (!team) return null;

  return {
    id: String(team.id),
    name: String(team.name),
    code: typeof team.code === "string" ? team.code : null,
    flagUrl: typeof team.flag_url === "string" ? team.flag_url : null,
  };
}

function mapPrediction(
  row: Record<string, unknown>,
  currentPoolId: string,
): Prediction {
  return {
    id: String(row.id),
    poolId:
      typeof row.pool_id === "string"
        ? row.pool_id
        : currentPoolId,
    userId: String(row.user_id),
    matchId: String(row.match_id),
    homeScore:
      typeof row.home_score === "number" ? row.home_score : null,
    awayScore:
      typeof row.away_score === "number" ? row.away_score : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPoolSummary(row: Record<string, unknown>): PoolSummary | null {
  const pool = single(
    row.pools as Record<string, unknown> | Record<string, unknown>[] | null,
  );

  if (!pool?.id) {
    return null;
  }

  const rawType = pool.type;
  const role = row.role === "owner" ? "owner" : "member";

  return {
    id: String(pool.id),
    name: typeof pool.name === "string" ? pool.name : "Meu bolão",
    description:
      typeof pool.description === "string" ? pool.description : null,
    type: rawType === "general" ? "general" : "private",
    isDefault: pool.is_default === true,
    role,
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

function uniquePredictionsByMatch(predictions: Prediction[]) {
  const predictionsByMatchId = new Map<string, Prediction>();

  predictions.forEach((prediction) => {
    if (!predictionsByMatchId.has(prediction.matchId)) {
      predictionsByMatchId.set(prediction.matchId, prediction);
    }
  });

  return Array.from(predictionsByMatchId.values());
}

function mapMatchGoal(row: Record<string, unknown>): MatchGoal {
  return {
    id: String(row.id),
    minute: typeof row.minute === "number" ? row.minute : null,
    teamName: typeof row.team_name === "string" ? row.team_name : null,
    playerName: typeof row.player_name === "string" ? row.player_name : null,
    goalType: typeof row.goal_type === "string" ? row.goal_type : null,
    isPenalty: row.is_penalty === true,
    isOwnGoal: row.is_own_goal === true,
  };
}

function mapGroups(rows: Record<string, unknown>[]): GroupWithTeamsAndMatches[] {
  return rows.map((row) => {
    const groupTeams = Array.isArray(row.group_teams)
      ? (row.group_teams as Record<string, unknown>[])
      : [];
    const matches = Array.isArray(row.matches)
      ? (row.matches as Record<string, unknown>[])
      : [];

    return {
      id: String(row.id),
      name: String(row.name),
      teams: groupTeams
        .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        .map((groupTeam) =>
          mapTeam(
            single(
              groupTeam.team as
                | Record<string, unknown>
                | Record<string, unknown>[]
                | null
                | undefined,
            ),
          ),
        )
        .filter((team): team is Team => Boolean(team)),
      matches: matches
        .map((match) => {
          const homeTeam = mapTeam(
            single(
              match.home_team as
                | Record<string, unknown>
                | Record<string, unknown>[]
                | null
                | undefined,
            ),
          );
          const awayTeam = mapTeam(
            single(
              match.away_team as
                | Record<string, unknown>
                | Record<string, unknown>[]
                | null
                | undefined,
            ),
          );

          if (!homeTeam || !awayTeam) {
            return null;
          }

          return {
            id: String(match.id),
            groupId: String(match.group_id),
            fifaMatchNumber:
              typeof match.fifa_match_number === "number"
                ? match.fifa_match_number
                : null,
            roundNumber: Number(match.round_number),
            matchDate:
              typeof match.match_date === "string" ? match.match_date : null,
            kickoffAt:
              typeof match.kickoff_at === "string" ? match.kickoff_at : null,
            stadium: typeof match.stadium === "string" ? match.stadium : null,
            city: typeof match.city === "string" ? match.city : null,
            country: typeof match.country === "string" ? match.country : null,
            homeScore:
              typeof match.home_score === "number" ? match.home_score : null,
            awayScore:
              typeof match.away_score === "number" ? match.away_score : null,
            apiFootballFixtureId:
              typeof match.api_football_fixture_id === "number"
                ? match.api_football_fixture_id
                : null,
            statusShort:
              typeof match.status_short === "string"
                ? match.status_short
                : null,
            statusLong:
              typeof match.status_long === "string" ? match.status_long : null,
            elapsed: typeof match.elapsed === "number" ? match.elapsed : null,
            homeScoreLive:
              typeof match.home_score_live === "number"
                ? match.home_score_live
                : null,
            awayScoreLive:
              typeof match.away_score_live === "number"
                ? match.away_score_live
                : null,
            scoreUpdatedAt:
              typeof match.score_updated_at === "string"
                ? match.score_updated_at
                : null,
            goals: Array.isArray(match.match_goals)
              ? (match.match_goals as Record<string, unknown>[])
                  .map(mapMatchGoal)
                  .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))
              : [],
            homeTeam,
            awayTeam,
          };
        })
        .filter((match): match is NonNullable<typeof match> => Boolean(match))
        .sort((a, b) => a.roundNumber - b.roundNumber),
    };
  });
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
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
    .select("pool_id, role, pools(id, name, description, type, is_default)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const pools = sortPools(
    (membershipsData ?? [])
      .map((row) => mapPoolSummary(row as Record<string, unknown>))
      .filter((pool): pool is PoolSummary => Boolean(pool)),
  );
  const selectedPool =
    pools.find((pool) => pool.id === requestedPoolId) ?? pools[0] ?? null;

  if (requestedPoolId && !pools.some((pool) => pool.id === requestedPoolId)) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-5 lg:px-6">
        <Card className="p-6">
          <Badge tone="amber">Acesso negado</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Bolão não encontrado
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Esse bolão não existe ou você não tem permissão para acessá-lo.
          </p>
        </Card>
      </main>
    );
  }

  if (!selectedPool) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-5 lg:px-6">
        <Card className="p-6">
          <Badge tone="amber">Sem bolão</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Fase de grupos
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite válido para entrar em um bolão.
          </p>
        </Card>
      </main>
    );
  }

  const pool: PoolInfo = {
    id: selectedPool.id,
    name: selectedPool.name,
  };

  const [
    { data: groupsData, error: groupsError },
    { data: predictionsData },
    { data: selectedPoolMembers },
  ] = await Promise.all([
      supabase
        .from("groups")
        .select(
          `
          id,
          name,
          group_teams(
            position,
            team:teams(id, name, code, flag_url)
          ),
          matches(
            id,
            group_id,
            fifa_match_number,
            round_number,
            match_date,
            kickoff_at,
            stadium,
            city,
            country,
            home_score,
            away_score,
            api_football_fixture_id,
            status_short,
            status_long,
            elapsed,
            home_score_live,
            away_score_live,
            score_updated_at,
            match_goals(
              id,
              minute,
              team_name,
              player_name,
              goal_type,
              is_penalty,
              is_own_goal
            ),
            home_team:teams!matches_home_team_id_fkey(id, name, code, flag_url),
            away_team:teams!matches_away_team_id_fkey(id, name, code, flag_url)
          )
        `,
        )
        .order("name"),
      supabase
        .from("predictions")
        .select(
          "id, user_id, match_id, home_score, away_score, created_at, updated_at",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("pool_members")
        .select("id")
        .eq("pool_id", pool.id),
    ]);

  if (groupsError || !groupsData?.length) {
    return (
      <main className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-5 lg:px-6">
        <Card className="p-6">
          <Badge tone="amber">Dados indisponíveis</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Não foi possível carregar as partidas reais
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400 light:text-slate-600">
            Verifique a configuração do banco, aplique as migrations e importe
            os jogos oficiais antes de liberar palpites.
          </p>
        </Card>
      </main>
    );
  }

  const groups = mapGroups(groupsData as Record<string, unknown>[]);
  const predictions = uniquePredictionsByMatch(
    (predictionsData ?? []).map((row) =>
      mapPrediction(row as Record<string, unknown>, pool.id),
    ),
  );

  return (
    <GroupsDashboardClient
      groups={groups}
      initialPredictions={predictions}
      poolId={pool.id}
      poolName={pool.name}
      pools={pools}
      canViewPoolPredictions={
        pools.length > 1 || (selectedPoolMembers?.length ?? 0) > 1
      }
      userId={userId}
    />
  );
}
