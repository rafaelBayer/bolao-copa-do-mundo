import { GroupSection } from "@/components/groups/GroupSection";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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
        <Card className="p-6">
          <Badge tone="amber">Convite pendente</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Fase de grupos
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Voce ainda nao participa de nenhum bolao.
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
  const totalMatches = groups.reduce(
    (total, group) => total + group.matches.length,
    0,
  );
  const filledPredictions = predictions.filter(
    (prediction) =>
      prediction.homeScore !== null || prediction.awayScore !== null,
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Card className="mb-6 overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Badge tone="emerald">{pool.name}</Badge>
            <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950 sm:text-4xl">
              Fase de grupos
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-400 light:text-slate-500">
              Faca seus palpites da Copa do Mundo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[28rem]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
              <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                {groups.length}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                grupos
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
              <p className="text-2xl font-black text-slate-50 light:text-slate-950">
                {totalMatches}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
                jogos
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 light:border-emerald-200 light:bg-emerald-50">
              <p className="text-2xl font-black text-emerald-300 light:text-emerald-700">
                {filledPredictions}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-200/80 light:text-emerald-700">
                palpites
              </p>
            </div>
          </div>
        </div>
      </Card>

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
