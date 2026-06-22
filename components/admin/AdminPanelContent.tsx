import { AdminSectionButton } from "@/components/admin/AdminSectionButton";
import { AdminStats } from "@/components/admin/AdminStats";
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
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";

export type AdminPanelSection =
  | "home"
  | "matches"
  | "scores"
  | "pools"
  | "users"
  | "settings";

type AdminPanelContentProps = {
  section: AdminPanelSection;
};

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
  if (!match.kickoffAt || match.statusShort === "FT") {
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

export function normalizeAdminSection(
  value: string | string[] | null | undefined,
): AdminPanelSection {
  const section = single(value);

  if (
    section === "matches" ||
    section === "scores" ||
    section === "pools" ||
    section === "users" ||
    section === "settings"
  ) {
    return section;
  }

  return "home";
}

function AdminHome({
  pool,
  participantsCount,
  matchesCount,
}: {
  pool: PoolInfo;
  participantsCount: number;
  matchesCount: number;
}) {
  const shortcuts = [
    {
      title: "Partidas",
      description: "Edite placares e dados dos jogos.",
      section: "matches" as const,
    },
    {
      title: "Placares",
      description: "Monitore provider, execucoes e janela ativa.",
      section: "scores" as const,
    },
    {
      title: "Boloes",
      description: "Veja onde gerenciar links de convite.",
      section: "pools" as const,
    },
    {
      title: "Usuarios",
      description: "Veja os participantes do bolao administrado.",
      section: "users" as const,
    },
    {
      title: "Configuracoes",
      description: "Ajuste aparencia e configuracoes administrativas.",
      section: "settings" as const,
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <Badge tone="amber">Painel Admin</Badge>
        <h1 className="mt-3 text-2xl font-black text-slate-50 light:text-slate-950">
          {pool.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400 light:text-slate-500">
          Gerencie partidas, placares, participantes e configuracoes
          do bolao em um unico lugar.
        </p>
      </Card>

      <AdminStats
        poolName={pool.name}
        participantsCount={participantsCount}
        matchesCount={matchesCount}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((shortcut) => (
          <AdminSectionButton
            key={shortcut.section}
            title={shortcut.title}
            description={shortcut.description}
            section={shortcut.section}
          />
        ))}
      </div>
    </div>
  );
}

export async function AdminPanelContent({ section }: AdminPanelContentProps) {
  const supabase = await createClient();
  const { data: isSystemAdmin } = await supabase.rpc("is_system_admin");

  if (isSystemAdmin !== true) {
    return null;
  }

  const { data: defaultPoolData } = await supabase
    .from("pools")
    .select("id, name, header_title, logo_url")
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: fallbackPoolData } = defaultPoolData
    ? { data: null }
    : await supabase
        .from("pools")
        .select("id, name, header_title, logo_url")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
  const adminPool = (defaultPoolData ?? fallbackPoolData) as {
    id?: string | null;
    name?: string | null;
    header_title?: string | null;
    logo_url?: string | null;
  } | null;

  if (!adminPool?.id) {
    return (
      <Card className="p-5">
        <Badge tone="amber">Configuracao</Badge>
        <h2 className="mt-3 text-xl font-black text-slate-50 light:text-slate-950">
          Nenhum bolao encontrado
        </h2>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
          Aplique as migrations e garanta o Bolao Geral antes de usar o Painel Admin.
        </p>
      </Card>
    );
  }

  const branding = adminPool as {
    header_title?: string | null;
    logo_url?: string | null;
  };
  const pool: PoolInfo = {
    id: adminPool.id,
    name: adminPool.name?.trim() || "Bolao Geral",
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
    { data: matchesData },
    { data: syncLogsData },
    { data: playoffsData },
  ] = await Promise.all([
    supabase.rpc("get_pool_participants", {
      target_pool_id: pool.id,
    }),
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

  const participants = ((participantsData ?? []) as AdminParticipantRow[]).map(
    (row) => mapParticipant(row as Record<string, unknown>),
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
  const playoffRow = single(playoffsData as PlayoffBracketAdminRow[] | null);
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

  if (section === "matches") {
    return (
      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            Partidas
          </h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Atualize placares ao vivo ou finalize partidas quando precisar.
          </p>
          <p className="mt-2 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-200 light:border-emerald-500/25 light:bg-emerald-50 light:text-emerald-700">
            Provider de placar: {currentLiveScoreProvider()}
          </p>
        </div>
        <LiveScoreAdminPanel poolId={pool.id} matches={adminMatches} />
      </Card>
    );
  }

  if (section === "scores") {
    return (
      <Card className="p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            Placares
          </h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Consulte historico e janela ativa. No MVP publico, a sincronizacao automatica fica desativada e o placar e manual.
          </p>
        </div>
        <LiveScoreMonitorPanel
          provider={currentLiveScoreProvider()}
          logs={syncLogs}
          activeMatches={activeMonitorMatches}
          nextMatch={nextMonitorMatch}
        />
      </Card>
    );
  }

  if (section === "pools") {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div>
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Boloes
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
              A criacao de boloes privados e os links de convite ficam
              centralizados na secao Boloes do perfil. Assim o Painel Admin
              permanece focado em partidas, placares e configuracoes do sistema.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (section === "users") {
    return <ParticipantsList participants={participants} />;
  }

  if (section === "settings") {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Configuracoes Admin
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

        {playoffRow ? (
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
                Playoffs
              </h2>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                Acompanhe a chave eliminatoria restrita ao owner.
              </p>
            </div>
            <PlayoffsAdminPanel
              isLocked={playoffRow.is_locked === true}
              lockAt={playoffRow.lock_at}
              startedUsersCount={playoffRow.started_users_count ?? 0}
              matchesCount={playoffMatchesCount}
            />
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <AdminHome
      pool={pool}
      participantsCount={participants.length}
      matchesCount={mappedMatches.length}
    />
  );
}
