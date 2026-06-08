import { GroupSection } from "@/components/groups/GroupSection";
import { mockGroups } from "@/lib/mock/groups";
import { createClient } from "@/lib/supabase/server";
import type { GroupWithTeamsAndMatches } from "@/types/group";
import type { Team } from "@/types/match";
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
            roundNumber: Number(match.round_number),
            matchDate:
              typeof match.match_date === "string" ? match.match_date : null,
            homeScore:
              typeof match.home_score === "number" ? match.home_score : null,
            awayScore:
              typeof match.away_score === "number" ? match.away_score : null,
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">Fase de grupos</h1>
          <p className="mt-3 text-sm text-slate-600">
            Voce ainda nao participa de nenhum bolao.
          </p>
        </section>
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
            round_number,
            match_date,
            home_score,
            away_score,
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

  const groups =
    groupsError || !groupsData?.length
      ? mockGroups
      : mapGroups(groupsData as Record<string, unknown>[]);
  const predictions = (predictionsData ?? []).map((row) =>
    mapPrediction(row as Record<string, unknown>),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase text-emerald-700">
          {pool.name}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Fase de grupos
        </h1>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            predictions={predictions}
            poolId={pool.id}
            userId={userId}
          />
        ))}
      </div>
    </main>
  );
}
