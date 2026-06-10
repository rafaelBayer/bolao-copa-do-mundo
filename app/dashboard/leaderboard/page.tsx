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

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
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
  const roundLeaderboards = Object.fromEntries(
    rounds.map((round) => [
      round,
      {
        entries: buildLeaderboard(rows, round),
        hasResult: hasRealResult(rows, round),
      },
    ]),
  );

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      {error ? (
        <Card className="mb-5 p-5">
          <Badge tone="amber">Erro</Badge>
          <p className="mt-3 text-sm text-slate-400 light:text-slate-600">
            Nao foi possivel carregar a classificacao agora.
          </p>
        </Card>
      ) : null}

      <LeaderboardClient
        poolName={poolName}
        generalEntries={buildLeaderboard(rows)}
        hasGeneralResult={hasRealResult(rows)}
        roundLeaderboards={roundLeaderboards}
      />
    </main>
  );
}
