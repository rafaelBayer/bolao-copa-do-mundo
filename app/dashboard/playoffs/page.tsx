import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PlayoffsClient } from "@/components/playoffs/PlayoffsClient";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type {
  PlayoffBracketState,
  PlayoffMatch,
  PlayoffPick,
  PlayoffStage,
  PlayoffTeam,
} from "@/types/playoffs";

export const dynamic = "force-dynamic";

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapTeam(value: unknown): PlayoffTeam | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    name: String(row.name),
    code: typeof row.code === "string" ? row.code : null,
    flagUrl: typeof row.flagUrl === "string" ? row.flagUrl : null,
  };
}

function mapMatch(value: unknown): PlayoffMatch {
  const row = value as Record<string, unknown>;
  const nextMatchSlot = row.nextMatchSlot;

  return {
    id: String(row.id),
    stage: String(row.stage) as PlayoffStage,
    position: Number(row.position),
    homeTeamId: typeof row.homeTeamId === "string" ? row.homeTeamId : null,
    awayTeamId: typeof row.awayTeamId === "string" ? row.awayTeamId : null,
    sourceHome: typeof row.sourceHome === "string" ? row.sourceHome : null,
    sourceAway: typeof row.sourceAway === "string" ? row.sourceAway : null,
    kickoffAt: typeof row.kickoffAt === "string" ? row.kickoffAt : null,
    nextMatchId:
      typeof row.nextMatchId === "string" ? row.nextMatchId : null,
    nextMatchSlot:
      nextMatchSlot === "home" || nextMatchSlot === "away"
        ? nextMatchSlot
        : null,
    homeTeam: mapTeam(row.homeTeam),
    awayTeam: mapTeam(row.awayTeam),
  };
}

function mapPick(value: unknown): PlayoffPick {
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id),
    playoffMatchId: String(row.playoffMatchId),
    selectedTeamId: String(row.selectedTeamId),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapBracket(row: Record<string, unknown>): PlayoffBracketState {
  const matches = Array.isArray(row.matches) ? row.matches : [];
  const picks = Array.isArray(row.picks) ? row.picks : [];

  return {
    isOwner: row.is_owner === true,
    isEnabled: row.is_enabled === true,
    canAccess: row.can_access === true,
    isLocked: row.is_locked === true,
    lockAt: typeof row.lock_at === "string" ? row.lock_at : null,
    startedUsersCount:
      typeof row.started_users_count === "number"
        ? row.started_users_count
        : 0,
    matches: matches.map(mapMatch),
    picks: picks.map(mapPick),
  };
}

function formatDeadline(lockAt: string | null) {
  if (!lockAt) {
    return "A definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(lockAt));
}

export default async function PlayoffsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: membership } = await supabase
    .from("pool_members")
    .select("pool_id, role, pools(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership?.pool_id) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Sem bolao</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Playoffs
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Use um link de convite valido para entrar em um bolao.
          </p>
        </Card>
      </main>
    );
  }

  if (membership.role !== "owner") {
    redirect("/dashboard/groups");
  }

  const { data, error } = await supabase.rpc("get_playoff_bracket", {
    target_pool_id: String(membership.pool_id),
  });
  const bracketRow = single(data as Record<string, unknown>[] | null);
  const bracket = bracketRow ? mapBracket(bracketRow) : null;
  const rawPool = single(
    (membership as {
      pools?: Record<string, unknown> | Record<string, unknown>[] | null;
    }).pools,
  );
  const poolName =
    rawPool && typeof rawPool === "object" && "name" in rawPool
      ? String(rawPool.name)
      : "Meu bolao";

  if (error || !bracket) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Playoffs</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Nao foi possivel carregar os playoffs agora.
          </h1>
        </Card>
      </main>
    );
  }

  if (!bracket.canAccess) {
    return (
      <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
        <Card className="p-6">
          <Badge tone="amber">Playoffs</Badge>
          <h1 className="mt-4 text-2xl font-black text-slate-50 light:text-slate-950">
            Os palpites dos playoffs ainda nao foram liberados.
          </h1>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Assim que o owner liberar, voce podera montar sua chave.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] px-3 py-6 sm:px-5 sm:py-8 lg:px-8">
      <PlayoffsClient
        poolId={String(membership.pool_id)}
        poolName={poolName}
        initialBracket={bracket}
        deadlineLabel={formatDeadline(bracket.lockAt)}
      />
    </main>
  );
}
