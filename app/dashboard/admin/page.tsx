import { redirect } from "next/navigation";
import { AdminStats } from "@/components/admin/AdminStats";
import { CreateInviteButton } from "@/components/admin/CreateInviteButton";
import { InviteList, type AdminInvite } from "@/components/admin/InviteList";
import {
  LiveScoreAdminPanel,
  type AdminLiveMatch,
} from "@/components/admin/LiveScoreAdminPanel";
import {
  LiveScoreMonitorPanel,
  type LiveScoreMonitorLog,
  type LiveScoreMonitorMatch,
} from "@/components/admin/LiveScoreMonitorPanel";
import {
  ParticipantsList,
  type AdminParticipant,
} from "@/components/admin/ParticipantsList";
import { PlayoffsAdminPanel } from "@/components/admin/PlayoffsAdminPanel";
import { PoolBrandingForm } from "@/components/admin/PoolBrandingForm";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PoolInfo = {
  id: string;
  name: string;
  headerTitle: string | null;
  logoUrl: string | null;
};

type AdminParticipantRow = {
  user_id: string;
  role: string;
  created_at: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
};

type AdminMatchRow = {
  id: string;
  kickoff_at: string | null;
  score_provider_fixture_id: string | null;
  status_short: string | null;
  elapsed: number | null;
  home_score_live: number | null;
  away_score_live: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { name: string } | { name: string }[] | null;
  away_team: { name: string } | { name: string }[] | null;
};

type LiveScoreSyncLogRow = {
  id: string;
  provider: string;
  status: "success" | "skipped" | "error";
  reason: string | null;
  active_matches_count: number | null;
  updated_matches_count: number | null;
  requested_matchdays: number[] | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

type PlayoffBracketAdminRow = {
  is_enabled: boolean;
  is_locked: boolean;
  lock_at: string | null;
  started_users_count: number | null;
  matches: unknown;
};

function single<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapParticipant(row: Record<string, unknown>): AdminParticipant {
  const userId = String(row.user_id);

  return {
    id: userId,
    userId,
    role: String(row.role),
    createdAt: String(row.created_at),
    name: typeof row.name === "string" ? row.name : null,
    email: typeof row.email === "string" ? row.email : null,
    avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
  };
}

function mapInvite(row: Record<string, unknown>): AdminInvite {
  return {
    id: String(row.id),
    token: String(row.token),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    createdAt: String(row.created_at),
    usesCount: typeof row.uses_count === "number" ? row.uses_count : 0,
  };
}

function mapAdminMatch(row: AdminMatchRow): AdminLiveMatch {
  const homeTeam = single(row.home_team);
  const awayTeam = single(row.away_team);

  return {
    id: row.id,
    kickoffAt: row.kickoff_at,
    homeTeamName: homeTeam?.name ?? "Mandante",
    awayTeamName: awayTeam?.name ?? "Visitante",
    statusShort: row.status_short,
    elapsed: row.elapsed,
    homeScoreLive: row.home_score_live,
    awayScoreLive: row.away_score_live,
    homeScore: row.home_score,
    awayScore: row.away_score,
  };
}

function mapMonitorMatch(row: AdminMatchRow): LiveScoreMonitorMatch {
  const homeTeam = single(row.home_team);
  const awayTeam = single(row.away_team);

  return {
    id: row.id,
    kickoffAt: row.kickoff_at,
    homeTeamName: homeTeam?.name ?? "Mandante",
    awayTeamName: awayTeam?.name ?? "Visitante",
    statusShort: row.status_short,
    elapsed: row.elapsed,
    homeScoreLive: row.home_score_live,
    awayScoreLive: row.away_score_live,
    homeScore: row.home_score,
    awayScore: row.away_score,
    scoreProviderFixtureId: row.score_provider_fixture_id,
  };
}

function mapSyncLog(row: LiveScoreSyncLogRow): LiveScoreMonitorLog {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    reason: row.reason,
    activeMatchesCount: row.active_matches_count ?? 0,
    updatedMatchesCount: row.updated_matches_count ?? 0,
    requestedMatchdays: row.requested_matchdays ?? [],
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function isNearMatchWindow(match: AdminLiveMatch) {
  if (!match.kickoffAt) {
    return false;
  }

  const now = Date.now();
  const kickoff = new Date(match.kickoffAt).getTime();
  const startsAt = kickoff - 12 * 60 * 60 * 1000;
  const endsAt = kickoff + 3 * 60 * 60 * 1000;

  return now >= startsAt && now <= endsAt;
}

function isActiveScoreWindow(match: LiveScoreMonitorMatch, now: number) {
  if (!match.kickoffAt) {
    return false;
  }

  if (match.statusShort === "FT") {
    return false;
  }

  const kickoff = new Date(match.kickoffAt).getTime();
  const startsAt = kickoff - 5 * 60 * 1000;
  const endsAt = kickoff + 240 * 60 * 1000;

  return now >= startsAt && now <= endsAt;
}

function isNext24Hours(match: LiveScoreMonitorMatch, now: number) {
  if (!match.kickoffAt) {
    return false;
  }

  const kickoff = new Date(match.kickoffAt).getTime();

  return kickoff >= now && kickoff <= now + 24 * 60 * 60 * 1000;
}

function isInviteAvailable(invite: AdminInvite) {
  if (!invite.expiresAt) {
    return true;
  }

  return new Date(invite.expiresAt).getTime() >= Date.now();
}

function currentLiveScoreProvider() {
  const provider = process.env.LIVE_SCORE_PROVIDER?.trim();

  if (
    provider === "api-football" ||
    provider === "football-data" ||
    provider === "worldcup26" ||
    provider === "espn" ||
    provider === "manual"
  ) {
    return provider;
  }

  return "manual";
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data: membership } = await supabase
    .from("pool_members")
    .select("pool_id, role, pools(id, name)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!membership?.pool_id || membership.role !== "owner") {
    redirect("/dashboard/groups");
  }

  const rawPool = single(
    (membership as {
      pools?: Record<string, unknown> | Record<string, unknown>[] | null;
    }).pools,
  );
  const { data: brandingData } = await supabase
    .from("pools")
    .select("header_title, logo_url")
    .eq("id", String(membership.pool_id))
    .maybeSingle();
  const branding = brandingData as {
    header_title?: string | null;
    logo_url?: string | null;
  } | null;
  const pool: PoolInfo = {
    id: String(membership.pool_id),
    name:
      rawPool && typeof rawPool === "object" && "name" in rawPool
        ? String(rawPool.name)
        : "Meu bolao",
    headerTitle:
      typeof branding?.header_title === "string"
        ? branding.header_title
        : null,
    logoUrl:
      typeof branding?.logo_url === "string"
        ? branding.logo_url
        : null,
  };

  const [
    { data: participantsData },
    { data: invitesData },
    { data: inviteUsesData },
    { data: matchesData },
    { data: syncLogsData },
    { data: playoffsData },
  ] = await Promise.all([
    supabase.rpc("get_pool_participants", {
      target_pool_id: pool.id,
    }),
    supabase
      .from("pool_invites")
      .select("id, token, expires_at, created_at")
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pool_invite_uses")
      .select("invite_id")
      .eq("pool_id", pool.id),
    supabase
      .from("matches")
      .select(
        `
        id,
        kickoff_at,
        score_provider_fixture_id,
        status_short,
        elapsed,
        home_score_live,
        away_score_live,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey(name),
        away_team:teams!matches_away_team_id_fkey(name)
      `,
      )
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("live_score_sync_logs")
      .select(
        [
          "id",
          "provider",
          "status",
          "reason",
          "active_matches_count",
          "updated_matches_count",
          "requested_matchdays",
          "error_message",
          "started_at",
          "finished_at",
        ].join(", "),
      )
      .order("started_at", { ascending: false })
      .limit(10),
    supabase.rpc("get_playoff_bracket", {
      target_pool_id: pool.id,
    }),
  ]);

  const participants = ((participantsData ?? []) as AdminParticipantRow[]).map((row) =>
    mapParticipant(row as Record<string, unknown>),
  );
  const inviteUsesByInviteId = new Map<string, number>();
  (inviteUsesData ?? []).forEach((row) => {
    const inviteId = String(
      (row as Record<string, unknown>).invite_id,
    );
    inviteUsesByInviteId.set(
      inviteId,
      (inviteUsesByInviteId.get(inviteId) ?? 0) + 1,
    );
  });
  const invites = (invitesData ?? []).map((row) => {
    const rawInvite = row as Record<string, unknown>;
    return mapInvite({
      ...rawInvite,
      uses_count: inviteUsesByInviteId.get(String(rawInvite.id)) ?? 0,
    });
  });
  const availableInvitesCount = invites.filter(isInviteAvailable).length;
  const inviteUsesCount = invites.reduce(
    (total, invite) => total + invite.usesCount,
    0,
  );
  const mappedMatches = ((matchesData ?? []) as unknown as AdminMatchRow[]).map(
    mapAdminMatch,
  );
  const monitorMatches = ((matchesData ?? []) as unknown as AdminMatchRow[]).map(
    mapMonitorMatch,
  );
  const syncLogs = ((syncLogsData ?? []) as unknown as LiveScoreSyncLogRow[]).map(
    mapSyncLog,
  );
  const playoffRow = single(
    playoffsData as PlayoffBracketAdminRow[] | null,
  );
  const playoffMatchesCount = Array.isArray(playoffRow?.matches)
    ? playoffRow.matches.length
    : 0;
  const now = new Date().getTime();
  const liveAdminMatches = mappedMatches.filter(isNearMatchWindow);
  const adminMatches =
    liveAdminMatches.length > 0 ? liveAdminMatches : mappedMatches.slice(0, 8);
  const activeMonitorMatches = monitorMatches.filter((match) =>
    isActiveScoreWindow(match, now),
  );
  const nextMonitorMatch =
    monitorMatches.find((match) => isNext24Hours(match, now)) ??
    monitorMatches.find((match) =>
      match.kickoffAt ? new Date(match.kickoffAt).getTime() >= now : false,
    ) ??
    null;

  return (
    <main className="mx-auto w-full max-w-[1536px] px-3 py-8 sm:px-5 sm:py-10 lg:px-8">
      <div className="space-y-5">
        <AdminStats
          poolName={pool.name}
          participantsCount={participants.length}
          availableInvitesCount={availableInvitesCount}
          inviteUsesCount={inviteUsesCount}
        />

        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Aparencia do bolao
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Personalize o titulo e o logo exibidos no header.
            </p>
          </div>
          <PoolBrandingForm
            poolId={pool.id}
            initialHeaderTitle={pool.headerTitle ?? ""}
            initialLogoUrl={pool.logoUrl ?? ""}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Status do placar ao vivo
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Monitore o provider automatico, ultimas execucoes e jogos em janela ativa.
            </p>
          </div>
          <LiveScoreMonitorPanel
            provider={currentLiveScoreProvider()}
            logs={syncLogs}
            activeMatches={activeMonitorMatches}
            nextMatch={nextMonitorMatch}
          />
        </Card>

        {playoffRow ? (
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
                Playoffs
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                Controle o acesso dos participantes ao simulador da chave eliminatoria.
              </p>
            </div>
            <PlayoffsAdminPanel
              poolId={pool.id}
              isEnabled={playoffRow.is_enabled === true}
              isLocked={playoffRow.is_locked === true}
              lockAt={playoffRow.lock_at}
              startedUsersCount={playoffRow.started_users_count ?? 0}
              matchesCount={playoffMatchesCount}
            />
          </Card>
        ) : null}

        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Placar dos jogos
            </h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Fallback manual para atualizar placar ao vivo ou finalizar uma partida.
            </p>
            <p className="mt-2 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-200 light:border-emerald-500/25 light:bg-emerald-50 light:text-emerald-700">
              Provider de placar: {currentLiveScoreProvider()}
            </p>
          </div>
          <LiveScoreAdminPanel poolId={pool.id} matches={adminMatches} />
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
                Novo convite
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                Convites expiram em 7 dias e podem ser compartilhados com varios amigos.
              </p>
            </div>
            <CreateInviteButton poolId={pool.id} userId={userId} />
          </div>
        </Card>

        <InviteList invites={invites} />
        <ParticipantsList participants={participants} />
      </div>
    </main>
  );
}
