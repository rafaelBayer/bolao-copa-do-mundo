import { GroupsDashboardClient } from "@/components/groups/GroupsDashboardClient";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { mockGroups } from "@/lib/mock/groups";
import { createClient } from "@/lib/supabase/server";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { MatchGoal, Team } from "@/types/match";
import type { Prediction } from "@/types/prediction";

export const dynamic = "force-dynamic";

type PoolInfo = {
  id: string;
  name: string;
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

function mapPrediction(row: Record<string, unknown>): Prediction {
  return {
    id: String(row.id),
    poolId: String(row.pool_id),
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

export default async function GroupsPage() {
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
      <main className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-5 lg:px-6">
        <Card className="p-6">
          <Badge tone="amber">Sem bolao</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Fase de grupos
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
  const pool: PoolInfo = {
    id: String(membership.pool_id),
    name:
      rawPool && typeof rawPool === "object" && "name" in rawPool
        ? String(rawPool.name)
        : "Meu bolao",
  };

  const [{ data: groupsData, error: groupsError }, { data: predictionsData }] =
    await Promise.all([
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
          "id, pool_id, user_id, match_id, home_score, away_score, created_at, updated_at",
        )
        .eq("pool_id", pool.id)
        .eq("user_id", userId),
    ]);

  // TODO: remover fallback mock antes de producao; dados reais devem vir do Supabase
  // importados por scripts/import-world-cup-2026.ts.
  const groups =
    groupsError || !groupsData?.length
      ? mockGroups
      : mapGroups(groupsData as Record<string, unknown>[]);
  const predictions = (predictionsData ?? []).map((row) =>
    mapPrediction(row as Record<string, unknown>),
  );
  return (
    <GroupsDashboardClient
      groups={groups}
      initialPredictions={predictions}
      poolId={pool.id}
      poolName={pool.name}
      userId={userId}
    />
  );
}
