"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUNDS,
  buildBracket,
} from "@/lib/knockout/buildBracket";
import { knockoutMatchCardId } from "@/lib/knockout/matchDomId";
import { pruneInvalidKnockoutPicks } from "@/lib/knockout/validateBracket";
import { isInLiveScoreRefreshWindow } from "@/lib/scores/liveRefreshWindow";
import type {
  KnockoutMatch,
  KnockoutBracketMatch,
  KnockoutCommunityPicksSummary,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRound,
  KnockoutSettings,
  UserKnockoutBracket,
} from "@/lib/knockout/types";
import { KnockoutMatchCard } from "./KnockoutMatchCard";
import { KnockoutLiveMatches } from "./KnockoutLiveMatches";
import { KnockoutRanking } from "./KnockoutRanking";
import { KnockoutRound as KnockoutRoundColumn } from "./KnockoutRound";
import { KnockoutStatus } from "./KnockoutStatus";

type KnockoutBracketProps = {
  tournamentKey: string;
  settings: KnockoutSettings;
  matches: KnockoutMatch[];
  initialBracket: UserKnockoutBracket | null;
  initialPicks: KnockoutPick[];
  rankingEntries: KnockoutRankingEntry[];
  rankingError: boolean;
  communityPicksByMatchKey: Record<string, KnockoutCommunityPicksSummary>;
  communityPicksError: boolean;
  isAuthenticated?: boolean;
  availableMatchesCount: number;
  openPicksCount: number;
  submittedOpenPicksCount: number;
  missingOpenPicksCount: number;
  nextLockLabel: string;
  submittedAtLabel: string | null;
};

type SaveStatus = "idle" | "saving" | "draft" | "error" | "locked";
type FocusRequest = {
  matchKey: string;
  requestId: number;
};
type CommunityPickDialogState = {
  match: KnockoutBracketMatch;
  summary: KnockoutCommunityPicksSummary;
};
type KnockoutLiveScoreFields = Pick<
  KnockoutMatch,
  | "statusShort"
  | "statusLong"
  | "elapsed"
  | "homeScoreLive"
  | "awayScoreLive"
  | "homeScore"
  | "awayScore"
  | "scoreUpdatedAt"
>;

function mapSavedPick(value: unknown): KnockoutPick {
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

function statusLabel(status: SaveStatus) {
  if (status === "locked") {
    return "Palpite bloqueado";
  }

  if (status === "saving") {
    return "Salvando...";
  }

  if (status === "error") {
    return "Erro ao salvar";
  }

  if (status === "draft") {
    return "Palpite salvo";
  }

  return "Palpites abertos";
}

function mapLiveScoreFields(row: Record<string, unknown>): KnockoutLiveScoreFields {
  return {
    statusShort:
      typeof row.status_short === "string" ? row.status_short : null,
    statusLong: typeof row.status_long === "string" ? row.status_long : null,
    elapsed: typeof row.elapsed === "number" ? row.elapsed : null,
    homeScoreLive:
      typeof row.home_score_live === "number" ? row.home_score_live : null,
    awayScoreLive:
      typeof row.away_score_live === "number" ? row.away_score_live : null,
    homeScore: typeof row.home_score === "number" ? row.home_score : null,
    awayScore: typeof row.away_score === "number" ? row.away_score : null,
    scoreUpdatedAt:
      typeof row.score_updated_at === "string" ? row.score_updated_at : null,
  };
}

export function KnockoutBracket({
  tournamentKey,
  settings,
  matches,
  initialBracket,
  initialPicks,
  rankingEntries,
  rankingError,
  communityPicksByMatchKey,
  communityPicksError,
  isAuthenticated = true,
  availableMatchesCount,
  openPicksCount,
  submittedOpenPicksCount,
  missingOpenPicksCount,
  nextLockLabel,
  submittedAtLabel,
}: KnockoutBracketProps) {
  const [activeRound, setActiveRound] = useState<KnockoutRound>("round_of_32");
  const [visibleMatches, setVisibleMatches] = useState(matches);
  const [picks, setPicks] = useState(() =>
    pruneInvalidKnockoutPicks(matches, initialPicks),
  );
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [communityPickDialog, setCommunityPickDialog] =
    useState<CommunityPickDialogState | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const requestIdRef = useRef(0);
  const lastFocusedRoundRequestIdRef = useRef<number | null>(null);
  const lastScrolledRequestIdRef = useRef<number | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const bracket = useMemo(
    () => buildBracket(visibleMatches, picks),
    [picks, visibleMatches],
  );
  const hasOpenMatches = openPicksCount > 0;
  const hasRoundOf32 =
    visibleMatches.filter((match) => match.round === "round_of_32").length === 16;
  const roundState = (round: KnockoutRound) =>
    bracket.find((item) => item.round === round);
  const leftRounds = [
    {
      round: "round_of_32" as const,
      matches: roundState("round_of_32")?.matches.slice(0, 8) ?? [],
    },
    {
      round: "round_of_16" as const,
      matches: roundState("round_of_16")?.matches.slice(0, 4) ?? [],
    },
    {
      round: "quarterfinal" as const,
      matches: roundState("quarterfinal")?.matches.slice(0, 2) ?? [],
    },
    {
      round: "semifinal" as const,
      matches: roundState("semifinal")?.matches.slice(0, 1) ?? [],
    },
  ];
  const rightRounds = [
    {
      round: "semifinal" as const,
      matches: roundState("semifinal")?.matches.slice(1, 2) ?? [],
    },
    {
      round: "quarterfinal" as const,
      matches: roundState("quarterfinal")?.matches.slice(2, 4) ?? [],
    },
    {
      round: "round_of_16" as const,
      matches: roundState("round_of_16")?.matches.slice(4, 8) ?? [],
    },
    {
      round: "round_of_32" as const,
      matches: roundState("round_of_32")?.matches.slice(8, 16) ?? [],
    },
  ];
  const finalMatch = roundState("final")?.matches[0] ?? null;
  const currentUserScore = initialBracket
    ? rankingEntries.find((entry) => entry.userId === initialBracket.userId)
    : null;
  const externalMatchIds = useMemo(
    () =>
      Array.from(
        new Set(
          visibleMatches
            .map((match) => match.externalMatchId)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [visibleMatches],
  );
  const externalMatchIdsKey = externalMatchIds.join("|");
  const shouldRefreshLiveScores = useMemo(() => {
    const now = new Date();

    return visibleMatches.some((match) =>
      isInLiveScoreRefreshWindow(match.startsAt, now),
    );
  }, [visibleMatches]);

  useEffect(() => {
    const liveScoreExternalMatchIds = externalMatchIdsKey
      ? externalMatchIdsKey.split("|")
      : [];

    if (!shouldRefreshLiveScores || liveScoreExternalMatchIds.length === 0) {
      return;
    }

    async function refreshKnockoutLiveScores() {
      const { data, error } = await supabase
        .from("knockout_matches")
        .select(
          "external_match_id, status_short, status_long, elapsed, home_score_live, away_score_live, home_score, away_score, score_updated_at",
        )
        .in("external_match_id", liveScoreExternalMatchIds);

      if (error || !data) {
        return;
      }

      const liveScoreByExternalMatchId = new Map(
        (data as Record<string, unknown>[])
          .filter((row) => typeof row.external_match_id === "string")
          .map((row) => [
            String(row.external_match_id),
            mapLiveScoreFields(row),
          ]),
      );

      setVisibleMatches((currentMatches) =>
        currentMatches.map((match) => {
          const liveScore =
            match.externalMatchId ?
              liveScoreByExternalMatchId.get(match.externalMatchId)
            : null;

          return liveScore ? { ...match, ...liveScore } : match;
        }),
      );
    }

    void refreshKnockoutLiveScores();

    const intervalId = window.setInterval(() => {
      void refreshKnockoutLiveScores();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [externalMatchIdsKey, shouldRefreshLiveScores, supabase]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFocusRequest((currentRequest) =>
        currentRequest?.requestId === focusRequest.requestId
          ? null
          : currentRequest,
      );
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [focusRequest]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (lastFocusedRoundRequestIdRef.current === focusRequest.requestId) {
      return;
    }

    const targetMatch = visibleMatches.find(
      (match) => `${match.round}:${match.position}` === focusRequest.matchKey,
    );

    if (!targetMatch || !KNOCKOUT_ROUNDS.includes(targetMatch.round)) {
      return;
    }

    lastFocusedRoundRequestIdRef.current = focusRequest.requestId;

    if (activeRound === targetMatch.round) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveRound(targetMatch.round);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeRound, focusRequest, visibleMatches]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    if (lastScrolledRequestIdRef.current === focusRequest.requestId) {
      return;
    }

    const targetMatch = visibleMatches.find(
      (match) => `${match.round}:${match.position}` === focusRequest.matchKey,
    );

    if (!targetMatch || activeRound !== targetMatch.round) {
      return;
    }

    lastScrolledRequestIdRef.current = focusRequest.requestId;

    const animationFrameId = window.requestAnimationFrame(() => {
      document
        .getElementById(knockoutMatchCardId(targetMatch))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeRound, focusRequest, visibleMatches]);

  const handleLiveMatchSelect = useCallback((match: KnockoutMatch) => {
    setFocusRequest({
      matchKey: `${match.round}:${match.position}`,
      requestId: Date.now(),
    });
  }, []);

  const handleCommunityPicksOpen = useCallback(
    (match: KnockoutBracketMatch, summary: KnockoutCommunityPicksSummary) => {
      setCommunityPickDialog({ match, summary });
    },
    [],
  );

  const persistPick = useCallback(
    (round: KnockoutRound, position: number, team: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setSaveStatus("saving");

      void (async () => {
        const { data, error } = await supabase.rpc("save_knockout_pick", {
          target_tournament_key: tournamentKey,
          target_round: round,
          target_position: position,
          target_selected_team: team,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (error) {
          setSaveStatus(
            error.message.toLowerCase().includes("bloqueado") ||
              error.message.toLowerCase().includes("prazo") ||
              error.message.toLowerCase().includes("locked")
              ? "locked"
              : "error",
          );
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        const savedPick = row?.pick ? mapSavedPick(row.pick) : null;

        if (savedPick) {
          setPicks((currentPicks) =>
            pruneInvalidKnockoutPicks(visibleMatches, [
              ...currentPicks.filter(
                (pick) =>
                  !(pick.round === savedPick.round && pick.position === savedPick.position),
              ),
              savedPick,
            ]),
          );
        }

        setSaveStatus("draft");
      })();
    },
    [supabase, tournamentKey, visibleMatches],
  );

  function updatePick(round: KnockoutRound, position: number, team: string) {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    const match = visibleMatches.find(
      (item) => item.round === round && item.position === position,
    );

    if (!match?.canPick) {
      setSaveStatus("locked");
      return;
    }

    const nextPicks = pruneInvalidKnockoutPicks(visibleMatches, [
      ...picks.filter(
        (pick) => !(pick.round === round && pick.position === position),
      ),
      {
        round,
        position,
        selectedTeam: team,
      },
    ]);

    setPicks(nextPicks);
    persistPick(round, position, team);
  }
  const highlightedMatchKey = focusRequest?.matchKey ?? null;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <KnockoutStatus
              hasOpenMatches={hasOpenMatches}
              nextLockLabel={nextLockLabel}
              availableMatchesCount={availableMatchesCount}
              submittedOpenPicksCount={submittedOpenPicksCount}
              openPicksCount={openPicksCount}
              submittedAtLabel={submittedAtLabel}
            />
            <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950">
              Palpites do mata-mata
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-400 light:text-slate-600">
              {settings.name}
            </p>
            <p className="mt-3 max-w-xl text-sm text-slate-500 light:text-slate-500">
              {isAuthenticated
                ? "Você pode preencher os palpites do mata-mata aos poucos. Cada jogo bloqueia 10 minutos antes do início."
                : "Você pode acompanhar a bracket sem login. Para salvar palpites, entre ou crie sua conta."}
            </p>
            <p className="mt-2 max-w-xl text-sm text-slate-500 light:text-slate-500">
              As próximas fases seguem os classificados reais da Copa. Se você errar um classificado, ainda poderá palpitar nos próximos confrontos oficiais.
            </p>
          </div>

          <div className="rounded-full border border-slate-800 bg-slate-900/55 px-3 py-1.5 text-xs font-black text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
            {isAuthenticated ? statusLabel(saveStatus) : "Entre para palpitar"}
          </div>
        </div>

        <div className="mt-4 min-h-6 text-sm font-bold text-slate-500 light:text-slate-500">
          {!isAuthenticated
            ? "Para registrar seu palpite no mata-mata, entre ou crie sua conta."
            : missingOpenPicksCount > 0
              ? `Ainda faltam ${missingOpenPicksCount} jogos abertos para palpitar.`
              : "Todos os jogos abertos já foram palpitados."}
          {saveStatus === "error" ? (
            <span className="ml-2 text-red-300 light:text-red-600">
              Erro ao salvar. Tente novamente.
            </span>
          ) : null}
        </div>
      </section>

      <KnockoutLiveMatches
        matches={visibleMatches}
        onMatchSelect={handleLiveMatchSelect}
      />

      {!hasRoundOf32 ? (
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-300 light:text-slate-700">
            Os confrontos do mata-mata ainda serão divulgados.
          </p>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-50 light:text-slate-950">
              Pontuação dos confrontos oficiais
            </h2>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
              Cada acerto vale 2 pts. Jogos avançados podem somar bônus se sua
              sequência anterior naquela chave estiver perfeita.
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/45 px-4 py-3 text-right light:border-slate-200 light:bg-slate-50">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 light:text-slate-500">
              {isAuthenticated ? "Sua pontuação" : "Ranking"}
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-300 light:text-emerald-700">
              {isAuthenticated ? `${currentUserScore?.totalPoints ?? 0} pts` : "-"}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500 light:text-slate-500">
              {currentUserScore
                ? `${currentUserScore.correctPicks} acertos em confrontos oficiais`
                : isAuthenticated
                  ? "Será calculada conforme os jogos terminarem"
                  : "Crie sua conta para salvar palpites e acompanhar sua pontuação"}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:hidden">
        {KNOCKOUT_ROUNDS.map((round) => (
          <Button
            key={round}
            type="button"
            variant={activeRound === round ? "primary" : "secondary"}
            className="shrink-0 px-3 py-2"
            onClick={() => setActiveRound(round)}
          >
            {KNOCKOUT_ROUND_LABELS[round]}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto pb-3 lg:hidden">
        <div className="flex min-w-max gap-4">
          {bracket.map((roundState) => (
            <div
              key={roundState.round}
              className={`${
                activeRound === roundState.round ? "block" : "hidden"
              } lg:block`}
            >
              <KnockoutRoundColumn
                round={roundState.round}
                matches={roundState.matches}
                disabled={false}
                highlightedMatchKey={highlightedMatchKey}
                communityPicksByMatchKey={communityPicksByMatchKey}
                onCommunityPicksOpen={handleCommunityPicksOpen}
                onSelect={updatePick}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto pb-4 lg:block">
        <div className="mx-auto min-w-[1280px] max-w-[1500px] rounded-lg border border-slate-800/75 bg-slate-950/38 px-6 py-6 light:border-slate-200 light:bg-slate-50">
          <div className="grid min-h-[44rem] grid-cols-[repeat(4,9.25rem)_13rem_repeat(4,9.25rem)] items-stretch justify-center gap-x-7">
            {leftRounds.map((roundConfig) => (
              <KnockoutRoundColumn
                key={`left-${roundConfig.round}`}
                round={roundConfig.round}
                matches={roundConfig.matches}
                disabled={false}
                side="left"
                compactTitle
                className="h-full"
                highlightedMatchKey={highlightedMatchKey}
                communityPicksByMatchKey={communityPicksByMatchKey}
                onCommunityPicksOpen={handleCommunityPicksOpen}
                onSelect={updatePick}
              />
            ))}

            <section className="flex h-full min-w-[13rem] flex-col items-center justify-center">
              <h2 className="mb-4 text-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 light:text-slate-500">
                {KNOCKOUT_ROUND_LABELS.final}
              </h2>
              {finalMatch ? (
                <div className="relative">
                  <span className="pointer-events-none absolute right-full top-1/2 h-px w-7 bg-slate-700/75 light:bg-slate-300" />
                  <span className="pointer-events-none absolute left-full top-1/2 h-px w-7 bg-slate-700/75 light:bg-slate-300" />
                  <KnockoutMatchCard
                    match={finalMatch}
                    disabled={false}
                    side="center"
                    isHighlighted={
                      highlightedMatchKey ===
                      `${finalMatch.round}:${finalMatch.position}`
                    }
                    communityPicks={
                      communityPicksByMatchKey[
                        `${finalMatch.round}:${finalMatch.position}`
                      ]
                    }
                    onCommunityPicksOpen={(summary) =>
                      handleCommunityPicksOpen(finalMatch, summary)
                    }
                    onSelect={(team) =>
                      updatePick(finalMatch.round, finalMatch.position, team)
                    }
                  />
                </div>
              ) : null}
            </section>

            {rightRounds.map((roundConfig) => (
              <KnockoutRoundColumn
                key={`right-${roundConfig.round}`}
                round={roundConfig.round}
                matches={roundConfig.matches}
                disabled={false}
                side="right"
                compactTitle
                className="h-full"
                highlightedMatchKey={highlightedMatchKey}
                communityPicksByMatchKey={communityPicksByMatchKey}
                onCommunityPicksOpen={handleCommunityPicksOpen}
                onSelect={updatePick}
              />
            ))}
          </div>
        </div>
      </div>

      {isAuthenticated ? (
        <KnockoutRanking entries={rankingEntries} hasError={rankingError} />
      ) : null}

      {communityPicksError ? (
        <p className="text-xs font-semibold text-amber-300 light:text-amber-700">
          Não foi possível carregar os palpites fechados da galera agora.
        </p>
      ) : null}

      {communityPickDialog ? (
        <CommunityPicksDialog
          state={communityPickDialog}
          onClose={() => setCommunityPickDialog(null)}
        />
      ) : null}

      {isAuthenticated && !initialBracket ? (
        <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
          Seu mata-mata ainda não foi salvo.
        </p>
      ) : null}

      <AuthRequiredModal
        isOpen={isAuthModalOpen}
        title="Entre para palpitar"
        message="Para registrar seu palpite no mata-mata, entre ou crie sua conta."
        note="Ainda não tem conta? Crie uma agora e participe do ranking."
        redirectTo="/dashboard/mata-mata"
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

function CommunityPicksDialog({
  state,
  onClose,
}: {
  state: CommunityPickDialogState;
  onClose: () => void;
}) {
  const { match, summary } = state;
  const matchLabel = `${match.teamA.team ?? match.teamA.label} x ${
    match.teamB.team ?? match.teamB.label
  }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-picks-title"
      className="fixed inset-0 z-50 flex items-end bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
    >
      <div className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-slate-800 bg-slate-950 shadow-2xl light:border-slate-200 light:bg-white sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-4 light:border-slate-200">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-300 light:text-emerald-700">
              Palpites da galera
            </p>
            <h2
              id="community-picks-title"
              className="mt-1 truncate text-xl font-black text-slate-50 light:text-slate-950"
            >
              {matchLabel}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 light:text-slate-500">
              {summary.totalPicks}{" "}
              {summary.totalPicks === 1 ? "palpite" : "palpites"} no bolão
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-900 hover:text-slate-100 light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-950"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="scrollbar-hidden max-h-[70vh] overflow-y-auto p-4">
          {summary.totalPicks === 0 ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900/55 p-4 text-sm font-semibold text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
              Nenhum palpite registrado para este jogo.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.options.map((option) => (
                <section
                  key={option.teamName}
                  className="rounded-xl border border-slate-800 bg-slate-900/45 p-3 light:border-slate-200 light:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-slate-100 light:text-slate-950">
                        {option.teamName}
                      </h3>
                      <p className="mt-1 text-xs font-bold text-slate-500 light:text-slate-500">
                        {option.count}{" "}
                        {option.count === 1 ? "palpite" : "palpites"} ·{" "}
                        {option.percentage}%
                      </p>
                    </div>
                  </div>
                  <div className="scrollbar-hidden mt-3 max-h-52 space-y-1 overflow-y-auto pr-1">
                    {option.users.length === 0 ? (
                      <p className="text-xs font-semibold text-slate-500 light:text-slate-500">
                        Nenhum participante escolheu este time.
                      </p>
                    ) : (
                      option.users.map((user) => (
                        <div
                          key={user.id}
                          className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-bold ${
                            user.isCurrentUser
                              ? "bg-emerald-400/15 text-emerald-200 light:bg-emerald-50 light:text-emerald-800"
                              : "bg-slate-950/35 text-slate-300 light:bg-white light:text-slate-700"
                          }`}
                        >
                          <span className="truncate">{user.name}</span>
                          {user.isCurrentUser ? (
                            <span className="shrink-0 text-[10px] font-black uppercase">
                              Você
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/35 p-3 text-sm font-bold text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
            Seu palpite: {summary.userPick ?? "sem palpite"}
          </div>
        </div>
      </div>
    </div>
  );
}
