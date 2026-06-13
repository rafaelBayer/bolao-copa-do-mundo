"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Star, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  buildLeaderboard,
  hasRealResult,
  type LeaderboardDataRow,
  type LeaderboardEntry,
} from "@/lib/scoring/buildLeaderboard";
import { createClient } from "@/lib/supabase/client";

type RankingMode = "general" | "round" | "live";

type RoundLeaderboard = {
  entries: LeaderboardEntry[];
  hasResult: boolean;
};
type RoundHighlight = {
  title: string;
  name: string;
  detail: string;
};
type RoundHighlights = {
  star?: RoundHighlight;
  exact?: RoundHighlight;
  climber?: RoundHighlight;
};

type LeaderboardClientProps = {
  poolId: string;
  poolName: string;
  generalEntries: LeaderboardEntry[];
  hasGeneralResult: boolean;
  roundLeaderboards: Record<number, RoundLeaderboard>;
  roundHighlights: Record<number, RoundHighlights>;
  liveEntries: LeaderboardEntry[];
  hasLiveResult: boolean;
  liveMatchesCount: number;
};

type LiveLeaderboardDataRow = LeaderboardDataRow & {
  is_live_match?: boolean | null;
  live_matches_count?: number | null;
};
type LiveImpactMessage = {
  title: string;
  description: string;
};

const rounds = [1, 2, 3];
const emptyLeaderboardEntries: LeaderboardEntry[] = [];
const columnTooltips = {
  pts: "Pontos",
  pe: "Placares exatos",
  rc: "Resultados corretos",
  jp: "Jogos pontuados",
  pf: "Palpites feitos",
};

function participantInitial(entry: Pick<LeaderboardEntry, "name">) {
  return entry.name.trim().charAt(0).toUpperCase() || "U";
}

function ParticipantAvatar({
  entry,
  size = "md",
}: {
  entry: Pick<LeaderboardEntry, "avatarUrl" | "name">;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 font-black text-slate-200 light:border-slate-200 light:bg-white light:text-slate-700`}
    >
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        participantInitial(entry)
      )}
    </span>
  );
}

function ParticipantIdentity({
  entry,
  avatarSize = "sm",
  strong = false,
}: {
  entry: Pick<LeaderboardEntry, "avatarUrl" | "name" | "username">;
  avatarSize?: "sm" | "md" | "lg";
  strong?: boolean;
}) {
  const content = (
    <>
      <ParticipantAvatar entry={entry} size={avatarSize} />
      <span
        className={`truncate ${
          strong
            ? "font-black text-slate-50 light:text-slate-950"
            : "font-bold text-slate-100 light:text-slate-950"
        }`}
      >
        {entry.name}
      </span>
    </>
  );

  if (!entry.username) {
    return <div className="flex min-w-0 items-center gap-3">{content}</div>;
  }

  return (
    <Link
      href={`/dashboard/users/${entry.username}`}
      className="flex min-w-0 items-center gap-3 rounded-xl transition hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 light:hover:text-emerald-700"
    >
      {content}
    </Link>
  );
}

function PodiumCard({
  entry,
  highlight = false,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-emerald-400/30 bg-emerald-400/10 light:border-emerald-200 light:bg-emerald-50"
          : "border-slate-800 bg-slate-950/35 light:border-slate-200 light:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-emerald-300 light:bg-white light:text-emerald-700">
          {entry.position}o
        </div>
        <div className="min-w-0">
          <ParticipantIdentity
            entry={entry}
            avatarSize={highlight ? "lg" : "md"}
            strong
          />
          <p className="mt-1 text-sm font-bold text-emerald-300 light:text-emerald-700">
            {entry.totalPoints} pts
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
        <span>PE: {entry.exactScores}</span>
        <span>RC: {entry.correctResults}</span>
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  icon,
}: {
  highlight: RoundHighlight;
  icon: "star" | "target" | "up";
}) {
  const Icon = icon === "star" ? Star : icon === "target" ? Target : TrendingUp;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 light:border-slate-200 light:bg-slate-50">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400 light:text-slate-500">
            {highlight.title}
          </p>
          <p className="mt-1 truncate text-sm font-black text-slate-100 light:text-slate-950">
            {highlight.name}
          </p>
          <p className="mt-1 text-xs font-bold text-emerald-200 light:text-emerald-700">
            {highlight.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 light:border-slate-200">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Participante</th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.pts}
                aria-label={columnTooltips.pts}
              >
                Pts
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.pe}
                aria-label={columnTooltips.pe}
              >
                PE
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.rc}
                aria-label={columnTooltips.rc}
              >
                RC
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.jp}
                aria-label={columnTooltips.jp}
              >
                JP
              </th>
              <th
                className="px-4 py-3 text-right"
                title={columnTooltips.pf}
                aria-label={columnTooltips.pf}
              >
                PF
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.userId}
                className="border-b border-slate-800/70 light:border-slate-200/80"
              >
                <td className="px-4 py-3 text-lg font-black text-slate-50 light:text-slate-950">
                  {entry.position}
                </td>
                <td className="px-4 py-3">
                  <ParticipantIdentity entry={entry} avatarSize="sm" />
                </td>
                <td className="px-4 py-3 text-right font-black text-emerald-300 light:text-emerald-700">
                  {entry.totalPoints}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.exactScores}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.correctResults}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.scoredMatches}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 light:text-slate-700">
                  {entry.filledPredictions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-800 md:hidden light:divide-slate-200">
        {entries.map((entry) => (
          <div key={entry.userId} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-lg font-black text-slate-50 light:text-slate-950">
                  {entry.position}
                </span>
                <ParticipantIdentity entry={entry} avatarSize="sm" />
              </div>
              <p className="text-lg font-black text-emerald-300 light:text-emerald-700">
                {entry.totalPoints} pts
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-bold text-slate-400 light:text-slate-500">
              <span title={columnTooltips.pe} aria-label={columnTooltips.pe}>
                PE {entry.exactScores}
              </span>
              <span title={columnTooltips.rc} aria-label={columnTooltips.rc}>
                RC {entry.correctResults}
              </span>
              <span title={columnTooltips.jp} aria-label={columnTooltips.jp}>
                JP {entry.scoredMatches}
              </span>
              <span title={columnTooltips.pf} aria-label={columnTooltips.pf}>
                PF {entry.filledPredictions}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function modeButtonClass(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? "bg-emerald-400 text-slate-950 light:bg-emerald-600 light:text-white"
      : "text-slate-400 hover:text-slate-100 light:text-slate-500 light:hover:text-slate-950"
  }`;
}

function entriesChanged(
  previousEntries: LeaderboardEntry[],
  nextEntries: LeaderboardEntry[],
) {
  if (previousEntries.length !== nextEntries.length) {
    return true;
  }

  return nextEntries.some((nextEntry) => {
    const previousEntry = previousEntries.find(
      (entry) => entry.userId === nextEntry.userId,
    );

    return (
      !previousEntry ||
      previousEntry.position !== nextEntry.position ||
      previousEntry.totalPoints !== nextEntry.totalPoints ||
      previousEntry.exactScores !== nextEntry.exactScores
    );
  });
}

function createLiveImpactMessage(
  previousEntries: LeaderboardEntry[],
  nextEntries: LeaderboardEntry[],
): LiveImpactMessage | null {
  if (
    previousEntries.length === 0 ||
    nextEntries.length === 0 ||
    !entriesChanged(previousEntries, nextEntries)
  ) {
    return null;
  }

  const previousLeader = previousEntries.find((entry) => entry.position === 1);
  const nextLeader = nextEntries.find((entry) => entry.position === 1);

  if (
    previousLeader &&
    nextLeader &&
    previousLeader.userId !== nextLeader.userId &&
    nextLeader.totalPoints > 0
  ) {
    return {
      title: "Novo lider provisorio",
      description: `${nextLeader.name} assumiu a lideranca do ranking ao vivo.`,
    };
  }

  const previousPositions = new Map(
    previousEntries.map((entry) => [entry.userId, entry.position]),
  );
  const biggestClimb = nextEntries
    .map((entry) => ({
      entry,
      climb: (previousPositions.get(entry.userId) ?? entry.position) - entry.position,
    }))
    .filter((item) => item.climb > 0)
    .sort((left, right) => {
      if (right.climb !== left.climb) return right.climb - left.climb;

      return left.entry.position - right.entry.position;
    })[0];

  if (biggestClimb) {
    return {
      title: "Ranking ao vivo mudou",
      description: `${biggestClimb.entry.name} subiu ${biggestClimb.climb} ${
        biggestClimb.climb === 1 ? "posicao" : "posicoes"
      } na classificacao provisoria.`,
    };
  }

  const previousExactScores = previousEntries.reduce(
    (total, entry) => total + entry.exactScores,
    0,
  );
  const nextExactScores = nextEntries.reduce(
    (total, entry) => total + entry.exactScores,
    0,
  );

  if (nextExactScores > previousExactScores) {
    return {
      title: "Placares exatos ao vivo",
      description: `${nextExactScores} placares exatos aparecem na projecao agora.`,
    };
  }

  return {
    title: "GOL!",
    description: "O gol mudou a classificacao provisoria.",
  };
}

export function LeaderboardClient({
  poolId,
  poolName,
  generalEntries,
  hasGeneralResult,
  roundLeaderboards,
  roundHighlights,
  liveEntries,
  hasLiveResult,
  liveMatchesCount,
}: LeaderboardClientProps) {
  const [mode, setMode] = useState<RankingMode>("general");
  const [selectedRound, setSelectedRound] = useState(1);
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [liveRankingEntries, setLiveRankingEntries] = useState(liveEntries);
  const [liveRankingHasResult, setLiveRankingHasResult] =
    useState(hasLiveResult);
  const [liveRankingMatchesCount, setLiveRankingMatchesCount] =
    useState(liveMatchesCount);
  const [liveRefreshStatus, setLiveRefreshStatus] = useState<
    "idle" | "refreshing" | "error"
  >("idle");
  const [liveImpactMessage, setLiveImpactMessage] =
    useState<LiveImpactMessage | null>(null);
  const liveRankingEntriesRef = useRef(liveEntries);
  const liveImpactTimeoutRef = useRef<number | null>(null);
  const selectedRoundLeaderboard = roundLeaderboards[selectedRound];
  const selectedRoundHighlights = roundHighlights[selectedRound] ?? {};
  const highlightItems = [
    selectedRoundHighlights.star
      ? {
          key: "star",
          highlight: selectedRoundHighlights.star,
          icon: "star" as const,
        }
      : null,
    selectedRoundHighlights.exact
      ? {
          key: "exact",
          highlight: selectedRoundHighlights.exact,
          icon: "target" as const,
        }
      : null,
    selectedRoundHighlights.climber
      ? {
          key: "climber",
          highlight: selectedRoundHighlights.climber,
          icon: "up" as const,
        }
      : null,
  ].filter(
    (item): item is { key: string; highlight: RoundHighlight; icon: "star" | "target" | "up" } =>
      Boolean(item),
  );
  const activeEntries =
    mode === "general"
      ? generalEntries
      : mode === "live"
        ? liveRankingEntries
        : selectedRoundLeaderboard?.entries ?? emptyLeaderboardEntries;
  const activeHasResult =
    mode === "general"
      ? hasGeneralResult
      : mode === "live"
        ? liveRankingHasResult
        : Boolean(selectedRoundLeaderboard?.hasResult);
  const podiumEntries = useMemo(
    () => activeEntries.filter((entry) => entry.totalPoints > 0).slice(0, 3),
    [activeEntries],
  );
  const podiumTitle =
    mode === "general"
      ? "Top 3 geral"
      : mode === "live"
        ? "Top 3 ao vivo"
        : `Top 3 da Rodada ${selectedRound}`;
  const tableTitle =
    mode === "general"
      ? "Ranking geral"
      : mode === "live"
        ? "Ranking ao vivo"
        : `Ranking da Rodada ${selectedRound}`;
  const emptyMessage =
    mode === "general"
      ? "A classificacao sera atualizada quando os primeiros resultados forem cadastrados."
      : mode === "live"
        ? "Ainda nao ha placares finalizados ou ao vivo para calcular a classificacao."
        : `A Rodada ${selectedRound} ainda nao possui jogos com resultado.`;
  const noScoreMessage =
    mode === "general"
      ? "Nenhum participante pontuou ainda."
      : mode === "live"
        ? "Nenhum participante pontuou na classificacao ao vivo ainda."
        : `Nenhum participante pontuou na Rodada ${selectedRound} ainda.`;

  const refreshLiveLeaderboard = useCallback(async () => {
    setLiveRefreshStatus("refreshing");

    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "get_pool_live_leaderboard_data",
      {
        target_pool_id: poolId,
      },
    );

    if (error) {
      setLiveRefreshStatus("error");
      return;
    }

    const rows = (data ?? []) as LiveLeaderboardDataRow[];
    const nextEntries = buildLeaderboard(rows);
    const nextImpactMessage = createLiveImpactMessage(
      liveRankingEntriesRef.current,
      nextEntries,
    );

    liveRankingEntriesRef.current = nextEntries;
    setLiveRankingEntries(nextEntries);
    setLiveRankingHasResult(hasRealResult(rows));
    setLiveRankingMatchesCount(rows[0]?.live_matches_count ?? 0);
    setLiveRefreshStatus("idle");

    if (nextImpactMessage) {
      setLiveImpactMessage(nextImpactMessage);

      if (liveImpactTimeoutRef.current !== null) {
        window.clearTimeout(liveImpactTimeoutRef.current);
      }

      liveImpactTimeoutRef.current = window.setTimeout(() => {
        setLiveImpactMessage(null);
        liveImpactTimeoutRef.current = null;
      }, 7000);
    }
  }, [poolId]);

  useEffect(
    () => () => {
      if (liveImpactTimeoutRef.current !== null) {
        window.clearTimeout(liveImpactTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (mode !== "live" || liveRankingMatchesCount <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshLiveLeaderboard();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [liveRankingMatchesCount, mode, refreshLiveLeaderboard]);

  useEffect(() => {
    if (mode !== "live") {
      return;
    }

    function handleFocus() {
      void refreshLiveLeaderboard();
    }

    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, [mode, refreshLiveLeaderboard]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300 light:text-emerald-700">
            {poolName}
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-50 light:text-slate-950">
            Classificacao
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 light:text-slate-500">
            Ranking dos participantes com base nos jogos que ja possuem resultado.
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowScoringInfo((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2 text-sm font-bold text-slate-200 transition hover:border-slate-700 hover:bg-slate-900 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:bg-slate-50"
            aria-expanded={showScoringInfo}
          >
            <HelpCircle size={16} aria-hidden="true" />
            Como pontua?
          </button>

          {showScoringInfo ? (
            <div className="absolute right-0 z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl light:border-slate-200 light:bg-white">
              <p className="text-sm font-black text-slate-50 light:text-slate-950">
                Como funciona a pontuacao
              </p>
              <p className="mt-3 text-sm font-bold text-slate-300 light:text-slate-700">
                Placar exato: 3 pts
              </p>
              <p className="mt-1 text-sm font-bold text-slate-300 light:text-slate-700">
                Resultado correto: 1 pt
              </p>
              <p className="mt-1 text-sm font-bold text-slate-300 light:text-slate-700">
                Erro: 0 pts
              </p>
              <p className="mt-3 text-sm text-slate-400 light:text-slate-500">
                Resultado correto significa acertar se o jogo terminou com
                vitoria do mandante, empate ou vitoria do visitante.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-fit rounded-xl border border-slate-800 bg-slate-950/45 p-1 light:border-slate-200 light:bg-slate-50">
          <button
            type="button"
            onClick={() => setMode("general")}
            className={modeButtonClass(mode === "general")}
          >
            Ranking geral
          </button>
          <button
            type="button"
            onClick={() => setMode("round")}
            className={modeButtonClass(mode === "round")}
          >
            Por rodada
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("live");
              void refreshLiveLeaderboard();
            }}
            className={modeButtonClass(mode === "live")}
          >
            Ao vivo
          </button>
        </div>

        {mode === "round" ? (
          <div className="inline-flex w-fit rounded-xl border border-slate-800 bg-slate-950/45 p-1 light:border-slate-200 light:bg-slate-50">
            {rounds.map((round) => (
              <button
                key={round}
                type="button"
                onClick={() => setSelectedRound(round)}
                className={modeButtonClass(selectedRound === round)}
              >
                Rodada {round}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {mode === "live" ? (
        <Card className="border-red-400/20 bg-red-500/5 p-4 light:border-red-200 light:bg-red-50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-red-200 light:text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                Ranking ao vivo
              </p>
              <p className="mt-2 text-sm font-bold text-slate-200 light:text-slate-800">
                Classificacao provisoria considerando os placares atuais.
              </p>
              <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
                Os pontos so sao confirmados ao fim das partidas.
              </p>
              {liveRankingMatchesCount === 0 ? (
                <p className="mt-2 text-sm font-bold text-amber-200 light:text-amber-800">
                  Nenhum jogo ao vivo agora.
                </p>
              ) : null}
            </div>
            <span className="rounded-full bg-slate-950/50 px-3 py-1 text-xs font-black text-slate-300 light:bg-white light:text-slate-700">
              {liveRefreshStatus === "refreshing"
                ? "Atualizando..."
                : liveRefreshStatus === "error"
                  ? "Nao atualizou agora"
                  : `${liveRankingMatchesCount} ao vivo`}
            </span>
          </div>
        </Card>
      ) : null}

      {mode === "live" && liveImpactMessage ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm shadow-lg shadow-emerald-950/10 motion-safe:animate-pulse light:border-emerald-200 light:bg-emerald-50"
        >
          <p className="text-xs font-black uppercase tracking-wide text-emerald-200 light:text-emerald-700">
            {liveImpactMessage.title}
          </p>
          <p className="mt-1 font-bold text-slate-100 light:text-slate-800">
            {liveImpactMessage.description}
          </p>
        </div>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              {podiumTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
              {mode === "general"
                ? "Melhores participantes considerando todos os jogos com resultado."
                : mode === "live"
                  ? "Classificacao provisoria com jogos finalizados e placares atuais."
                  : `Desempenho considerando apenas jogos da Rodada ${selectedRound}.`}
            </p>
          </div>
        </div>

        {!activeHasResult ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
            {emptyMessage}
          </div>
        ) : podiumEntries.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-500">
            {noScoreMessage}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {podiumEntries.map((entry, index) => (
              <PodiumCard
                key={entry.userId}
                entry={entry}
                highlight={index === 0}
              />
            ))}
          </div>
        )}
      </Card>

      {mode === "round" && highlightItems.length > 0 ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
              Destaques da rodada
            </h2>
            <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
              Recortes divertidos da Rodada {selectedRound}, sem pontos extras.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {highlightItems.map((item) => (
              <HighlightCard
                key={item.key}
                highlight={item.highlight}
                icon={item.icon}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-50 light:text-slate-950">
            {tableTitle}
          </h2>
        </div>

        {!activeHasResult ? (
          <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm font-medium text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
            {emptyMessage}
          </div>
        ) : null}

        <LeaderboardTable entries={activeEntries} />
      </Card>
    </div>
  );
}
