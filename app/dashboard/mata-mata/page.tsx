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
    externalMatchId:
      typeof row.externalMatchId === "string" ? row.externalMatchId : null,
    teamASource: typeof row.teamASource === "string" ? row.teamASource : null,
    teamA: typeof row.teamA === "string" ? row.teamA : null,
    teamACode: typeof row.teamACode === "string" ? row.teamACode : null,
    teamAFlagUrl: typeof row.teamAFlagUrl === "string" ? row.teamAFlagUrl : null,
    teamBSource: typeof row.teamBSource === "string" ? row.teamBSource : null,
    teamB: typeof row.teamB === "string" ? row.teamB : null,
    teamBCode: typeof row.teamBCode === "string" ? row.teamBCode : null,
    teamBFlagUrl: typeof row.teamBFlagUrl === "string" ? row.teamBFlagUrl : null,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    lockAt: typeof row.lockAt === "string" ? row.lockAt : null,
    isLocked: row.isLocked === true,
    canPick: row.canPick === true,
    userPick: typeof row.userPick === "string" ? row.userPick : null,
    pointsIfCorrect:
      typeof row.pointsIfCorrect === "number" ? row.pointsIfCorrect : 0,
    isFinished: row.isFinished === true,
    isPickCorrect:
      typeof row.isPickCorrect === "boolean" ? row.isPickCorrect : null,
    pickPoints: typeof row.pickPoints === "number" ? row.pickPoints : 0,
    winnerTeam: typeof row.winnerTeam === "string" ? row.winnerTeam : null,
    winnerTeamCode:
      typeof row.winnerTeamCode === "string" ? row.winnerTeamCode : null,
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
    completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
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
    selectedTeam:
      typeof row.selectedTeam === "string" ? row.selectedTeam : "",
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
    completedAt:
      typeof row.completed_at === "string" ? row.completed_at : null,
    picksCount: typeof row.picks_count === "number" ? row.picks_count : 0,
    isComplete: row.is_complete === true,
    roundOf32Points:
      typeof row.round_of_32_points === "number" ? row.round_of_32_points : 0,
    roundOf16Points:
      typeof row.round_of_16_points === "number" ? row.round_of_16_points : 0,
    quarterfinalPoints:
      typeof row.quarterfinal_points === "number" ? row.quarterfinal_points : 0,
    semifinalPoints:
      typeof row.semifinal_points === "number" ? row.semifinal_points : 0,
    finalPoints: typeof row.final_points === "number" ? row.final_points : 0,
    roundOf32Correct:
      typeof row.round_of_32_correct === "number" ? row.round_of_32_correct : 0,
    roundOf16Correct:
      typeof row.round_of_16_correct === "number" ? row.round_of_16_correct : 0,
    quarterfinalCorrect:
      typeof row.quarterfinal_correct === "number" ? row.quarterfinal_correct : 0,
    semifinalCorrect:
      typeof row.semifinal_correct === "number" ? row.semifinal_correct : 0,
    finalCorrect:
      typeof row.final_correct === "number" ? row.final_correct : 0,
  };
}

function UnavailableKnockoutMessage() {
  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <Card className="p-6">
        <Badge tone="amber">Mata-mata</Badge>
        <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
          O mata-mata ainda nao esta disponivel.
        </h1>
        <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
          Assim que os confrontos forem definidos, voce podera palpitar nos jogos oficiais.
        </p>
      </Card>
    </main>
  );
}

function LoadErrorMessage() {
  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <Card className="p-6">
        <Badge tone="amber">Mata-mata</Badge>
        <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
          Nao foi possivel carregar o mata-mata agora.
        </h1>
        <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
          Tente novamente em alguns instantes.
        </p>
      </Card>
    </main>
  );
}

function logKnockoutStateError(error: unknown) {
  const serializeError = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return String(value);
    }

    const record = value as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    for (const key of Object.getOwnPropertyNames(value)) {
      payload[key] = record[key];
    }

    for (const key of ["code", "message", "details", "hint", "name", "stack"]) {
      if (!(key in payload) && key in record) {
        payload[key] = record[key];
      }
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return String(value);
    }
  };

  if (error instanceof Error) {
    console.error("Failed to load knockout state", serializeError({
      name: error.name,
      message: error.message,
      stack: error.stack,
    }));
    return;
  }

  console.error("Failed to load knockout state", serializeError(error));
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

  if (stateError) {
    if (
      stateError.code === "P0001" &&
      stateError.message?.toLowerCase().includes("not found")
    ) {
      return <UnavailableKnockoutMessage />;
    }

    if (process.env.NODE_ENV !== "production") {
      logKnockoutStateError(stateError);
    }

    return <LoadErrorMessage />;
  }

  const stateRow = single(stateData as Record<string, unknown>[] | null);
  const rankingEntries = Array.isArray(rankingData)
    ? (rankingData as unknown[]).map(mapRankingEntry)
    : [];

  if (!stateRow) {
    return <UnavailableKnockoutMessage />;
  }

  const settings = mapSettings(stateRow.settings);
  const matches = Array.isArray(stateRow.matches)
    ? (stateRow.matches as unknown[]).map(mapMatch)
    : [];
  const bracket = mapBracket(stateRow.bracket);
  const picks = Array.isArray(stateRow.picks)
    ? (stateRow.picks as unknown[]).map(mapPick)
    : [];

  if (
    matches.filter((match) => match.round === "round_of_32").length < 16
  ) {
    return <UnavailableKnockoutMessage />;
  }

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
        availableMatchesCount={
          typeof stateRow.available_matches_count === "number"
            ? stateRow.available_matches_count
            : 0
        }
        openPicksCount={
          typeof stateRow.open_picks_count === "number"
            ? stateRow.open_picks_count
            : 0
        }
        submittedOpenPicksCount={
          typeof stateRow.submitted_open_picks_count === "number"
            ? stateRow.submitted_open_picks_count
            : 0
        }
        missingOpenPicksCount={
          typeof stateRow.missing_open_picks_count === "number"
            ? stateRow.missing_open_picks_count
            : 0
        }
        nextLockLabel={
          formatDateTime(
            typeof stateRow.next_lock_at === "string"
              ? stateRow.next_lock_at
              : null,
          ) ?? "Sem jogos abertos"
        }
        submittedAtLabel={formatDateTime(bracket?.submittedAt)}
      />
    </main>
  );
}
