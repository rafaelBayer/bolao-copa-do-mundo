import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KnockoutBracket } from "@/components/knockout/KnockoutBracket";
import {
  KNOCKOUT_TOURNAMENT_KEY,
} from "@/lib/knockout/buildBracket";
import type {
  KnockoutMatch,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRound,
  KnockoutSettings,
  UserKnockoutBracket,
} from "@/lib/knockout/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MataMataPageProps = {
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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
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

function mapSettings(value: unknown): KnockoutSettings {
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    tournamentKey: String(row.tournamentKey),
    name: typeof row.name === "string" ? row.name : "Copa do Mundo 2026",
    deadlineAt: String(row.deadlineAt),
    isActive: row.isActive === true,
  };
}

function mapMatch(value: unknown): KnockoutMatch {
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    tournamentKey: String(row.tournamentKey),
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    teamA: typeof row.teamA === "string" ? row.teamA : null,
    teamB: typeof row.teamB === "string" ? row.teamB : null,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    winnerTeam: typeof row.winnerTeam === "string" ? row.winnerTeam : null,
  };
}

function mapBracket(value: unknown): UserKnockoutBracket | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    userId: String(row.userId),
    tournamentKey: String(row.tournamentKey),
    submittedAt: typeof row.submittedAt === "string" ? row.submittedAt : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapPick(value: unknown): KnockoutPick {
  const row = value as Record<string, unknown>;

  return {
    id: typeof row.id === "string" ? row.id : undefined,
    round: String(row.round) as KnockoutRound,
    position: Number(row.position),
    selectedTeam: String(row.selectedTeam),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
}

function mapRankingEntry(value: unknown): KnockoutRankingEntry {
  const row = value as Record<string, unknown>;
  const fallbackName =
    typeof row.username === "string" ? row.username : "Participante";

  return {
    userId: String(row.user_id),
    name:
      typeof row.profile_name === "string" && row.profile_name.trim()
        ? row.profile_name
        : fallbackName,
    username: typeof row.username === "string" ? row.username : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
    totalPoints:
      typeof row.total_points === "number" ? row.total_points : 0,
    correctPicks:
      typeof row.correct_picks === "number" ? row.correct_picks : 0,
    submittedAt:
      typeof row.submitted_at === "string" ? row.submitted_at : null,
  };
}

export default async function MataMataPage({ searchParams }: MataMataPageProps) {
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

  if (requestedPoolId && !pools.some((pool) => pool.id === requestedPoolId)) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Acesso negado</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Bolao nao encontrado
          </h1>
        </Card>
      </main>
    );
  }

  if (!selectedPool) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Sem bolao</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Mata-mata
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite valido para entrar em um bolao.
          </p>
        </Card>
      </main>
    );
  }

  const [{ data: stateData, error: stateError }, { data: rankingData }] =
    await Promise.all([
      supabase.rpc("get_knockout_state", {
        target_tournament_key: KNOCKOUT_TOURNAMENT_KEY,
      }),
      supabase.rpc("get_pool_knockout_ranking", {
        target_pool_id: selectedPool.id,
        target_tournament_key: KNOCKOUT_TOURNAMENT_KEY,
      }),
    ]);
  const stateRow = single(stateData as Record<string, unknown>[] | null);

  if (stateError || !stateRow) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Mata-mata</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Mata-mata ainda nao configurado.
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Aplique a migration e cadastre os confrontos dos 16 avos para liberar a tela.
          </p>
        </Card>
      </main>
    );
  }

  const settings = mapSettings(stateRow.settings);
  const matches = Array.isArray(stateRow.matches)
    ? (stateRow.matches as unknown[]).map(mapMatch)
    : [];
  const bracket = mapBracket(stateRow.bracket);
  const picks = Array.isArray(stateRow.picks)
    ? (stateRow.picks as unknown[]).map(mapPick)
    : [];
  const rankingEntries = Array.isArray(rankingData)
    ? (rankingData as unknown[]).map(mapRankingEntry)
    : [];

  return (
    <main className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-5 sm:py-7 lg:px-8">
      {pools.length > 1 ? (
        <Card className="mb-5 p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
            Ranking por bolao
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {pools.map((pool) => {
              const isSelected = pool.id === selectedPool.id;

              return (
                <Link
                  key={pool.id}
                  href={`/dashboard/mata-mata?pool=${pool.id}`}
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

      <KnockoutBracket
        tournamentKey={KNOCKOUT_TOURNAMENT_KEY}
        settings={settings}
        matches={matches}
        initialBracket={bracket}
        initialPicks={picks}
        rankingEntries={rankingEntries}
        isLocked={stateRow.is_locked === true}
        deadlineLabel={formatDateTime(String(stateRow.deadline_at)) ?? "A definir"}
        submittedAtLabel={formatDateTime(bracket?.submittedAt)}
      />
    </main>
  );
}
