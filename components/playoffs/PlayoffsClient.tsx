"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Crown, Lock, Save, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import type {
  PlayoffBracketState,
  PlayoffMatch,
  PlayoffPick,
  PlayoffStage,
  PlayoffTeam,
} from "@/types/playoffs";

const STAGES: PlayoffStage[] = [
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
];

const STAGE_LABELS: Record<PlayoffStage, string> = {
  ROUND_OF_32: "32 avos",
  ROUND_OF_16: "Oitavas",
  QUARTER_FINAL: "Quartas",
  SEMI_FINAL: "Semifinais",
  FINAL: "Final",
};

type SlotValue = {
  team: PlayoffTeam | null;
  label: string;
};

type PlayoffsClientProps = {
  poolId: string;
  poolName: string;
  initialBracket: PlayoffBracketState;
  deadlineLabel: string;
};

function formatKickoff(kickoffAt: string | null) {
  if (!kickoffAt) {
    return "Data a definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(kickoffAt));
}

function TeamMark({ team, label }: SlotValue) {
  const initials = team?.code?.slice(0, 3) ?? team?.name.slice(0, 2) ?? "?";

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 text-[10px] font-black uppercase text-slate-300 light:border-slate-200 light:bg-white light:text-slate-500">
        {team?.flagUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.flagUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0 truncate">{team?.name ?? label}</span>
    </span>
  );
}

function buildPickMap(picks: PlayoffPick[]) {
  return new Map(picks.map((pick) => [pick.playoffMatchId, pick]));
}

export function PlayoffsClient({
  poolId,
  poolName,
  initialBracket,
  deadlineLabel,
}: PlayoffsClientProps) {
  const [activeStage, setActiveStage] = useState<PlayoffStage>("ROUND_OF_32");
  const [picks, setPicks] = useState(initialBracket.picks);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const pickByMatchId = useMemo(() => buildPickMap(picks), [picks]);

  const matchesByStage = useMemo(() => {
    const grouped = new Map<PlayoffStage, PlayoffMatch[]>();

    STAGES.forEach((stage) => grouped.set(stage, []));
    initialBracket.matches.forEach((match) => {
      grouped.get(match.stage)?.push(match);
    });
    STAGES.forEach((stage) => {
      grouped.get(stage)?.sort((left, right) => left.position - right.position);
    });

    return grouped;
  }, [initialBracket.matches]);

  const teamById = useMemo(() => {
    const teams = new Map<string, PlayoffTeam>();

    initialBracket.matches.forEach((match) => {
      if (match.homeTeam) teams.set(match.homeTeam.id, match.homeTeam);
      if (match.awayTeam) teams.set(match.awayTeam.id, match.awayTeam);
    });

    return teams;
  }, [initialBracket.matches]);

  const sourceByTarget = useMemo(() => {
    const sources = new Map<string, PlayoffMatch>();

    initialBracket.matches.forEach((match) => {
      if (match.nextMatchId && match.nextMatchSlot) {
        sources.set(`${match.nextMatchId}:${match.nextMatchSlot}`, match);
      }
    });

    return sources;
  }, [initialBracket.matches]);

  const descendantsByMatch = useMemo(() => {
    const map = new Map<string, string[]>();

    initialBracket.matches.forEach((match) => {
      const descendants: string[] = [];
      let nextId = match.nextMatchId;

      while (nextId) {
        descendants.push(nextId);
        const nextMatch = initialBracket.matches.find((item) => item.id === nextId);
        nextId = nextMatch?.nextMatchId ?? null;
      }

      map.set(match.id, descendants);
    });

    return map;
  }, [initialBracket.matches]);

  function resolveSlot(match: PlayoffMatch, slot: "home" | "away"): SlotValue {
    const directTeam = slot === "home" ? match.homeTeam : match.awayTeam;
    const label =
      (slot === "home" ? match.sourceHome : match.sourceAway) ??
      (slot === "home" ? "Mandante a definir" : "Visitante a definir");

    if (directTeam) {
      return { team: directTeam, label };
    }

    const sourceMatch = sourceByTarget.get(`${match.id}:${slot}`);
    const sourcePick = sourceMatch ? pickByMatchId.get(sourceMatch.id) : null;
    const sourceTeam = sourcePick ? teamById.get(sourcePick.selectedTeamId) ?? null : null;

    return {
      team: sourceTeam,
      label: sourceTeam?.name ?? label,
    };
  }

  const finalMatch = initialBracket.matches.find((match) => match.stage === "FINAL");
  const championId = finalMatch ? pickByMatchId.get(finalMatch.id)?.selectedTeamId : null;
  const champion = championId ? teamById.get(championId) ?? null : null;
  const isReadOnly = initialBracket.isLocked;
  const statusLabel = initialBracket.isLocked
    ? "Bloqueado"
    : initialBracket.isEnabled
      ? "Aberto para palpites"
      : "Em breve";

  function updatePick(match: PlayoffMatch, selectedTeam: PlayoffTeam) {
    if (isReadOnly) {
      return;
    }

    const previousPicks = picks;
    const downstreamIds = new Set(descendantsByMatch.get(match.id) ?? []);
    const optimisticPick: PlayoffPick = {
      id: pickByMatchId.get(match.id)?.id ?? `local-${match.id}`,
      playoffMatchId: match.id,
      selectedTeamId: selectedTeam.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setErrorMessage(null);
    setSaveMessage("Salvando...");
    setPicks([
      ...previousPicks.filter(
        (pick) => pick.playoffMatchId !== match.id && !downstreamIds.has(pick.playoffMatchId),
      ),
      optimisticPick,
    ]);

    startTransition(async () => {
      const { data, error } = await supabase.rpc("save_playoff_pick", {
        target_pool_id: poolId,
        target_playoff_match_id: match.id,
        target_selected_team_id: selectedTeam.id,
      });

      if (error) {
        setPicks(previousPicks);
        setSaveMessage(null);
        setErrorMessage("Erro ao salvar. Tente novamente.");
        return;
      }

      const saved = Array.isArray(data) ? data[0] : data;
      if (saved && typeof saved === "object") {
        setPicks((current) => [
          ...current.filter((pick) => pick.playoffMatchId !== match.id),
          {
            id: String((saved as Record<string, unknown>).id),
            playoffMatchId: String((saved as Record<string, unknown>).playoff_match_id),
            selectedTeamId: String((saved as Record<string, unknown>).selected_team_id),
            createdAt: String((saved as Record<string, unknown>).created_at),
            updatedAt: String((saved as Record<string, unknown>).updated_at),
          },
        ]);
      }

      setSaveMessage("Salvo");
      window.setTimeout(() => setSaveMessage(null), 1800);
    });
  }

  function renderMatch(match: PlayoffMatch) {
    const home = resolveSlot(match, "home");
    const away = resolveSlot(match, "away");
    const selectedId = pickByMatchId.get(match.id)?.selectedTeamId ?? null;
    const canPick = Boolean(home.team && away.team && !isReadOnly);
    const waitingTeams = !home.team || !away.team;

    return (
      <Card key={match.id} className="p-3">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500 light:text-slate-500">
          <span className="font-bold">Jogo {match.position}</span>
          <span>{formatKickoff(match.kickoffAt)}</span>
        </div>

        <div className="space-y-2">
          {[
            { value: home, slot: "home" as const },
            { value: away, slot: "away" as const },
          ].map(({ value, slot }) => {
            const team = value.team;
            const isSelected = team?.id === selectedId;

            return (
              <button
                key={slot}
                type="button"
                disabled={!team || !canPick}
                onClick={() => team && updatePick(match, team)}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-black transition ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-400/12 text-emerald-100 light:border-emerald-500 light:bg-emerald-50 light:text-emerald-800"
                    : "border-slate-800 bg-slate-900/50 text-slate-100 hover:border-emerald-400/40 light:border-slate-200 light:bg-white light:text-slate-800 light:hover:border-emerald-300"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <TeamMark team={team} label={value.label} />
                {isSelected ? <Check size={17} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        {waitingTeams ? (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500 light:text-slate-500">
            <ShieldQuestion size={14} aria-hidden="true" />
            Aguardando classificados.
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={initialBracket.isLocked ? "amber" : initialBracket.isEnabled ? "emerald" : "default"}>
                {statusLabel}
              </Badge>
              {initialBracket.isOwner && !initialBracket.isEnabled && !initialBracket.isLocked ? (
                <Badge tone="amber">Acesso exclusivo do owner</Badge>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-black text-slate-50 light:text-slate-950">
              Playoffs
            </h1>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
              {poolName}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/45 px-4 py-3 text-sm light:border-slate-200 light:bg-slate-50">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
              Prazo final
            </p>
            <p className="mt-1 font-black text-slate-100 light:text-slate-900">
              {deadlineLabel}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-slate-300 light:text-slate-600 md:grid-cols-3">
          <div>
            <p className="font-black text-slate-100 light:text-slate-900">
              Como funciona
            </p>
            <p className="mt-1">
              Escolha quem avanca em cada confronto ate definir o campeao.
            </p>
          </div>
          <div>
            <p className="font-black text-slate-100 light:text-slate-900">
              Edicao
            </p>
            <p className="mt-1">
              Voce pode alterar suas escolhas ate o inicio do primeiro jogo dos playoffs.
            </p>
          </div>
          <div>
            <p className="font-black text-slate-100 light:text-slate-900">
              Bloqueio
            </p>
            <p className="mt-1">
              Quando o primeiro jogo comecar, toda a chave sera bloqueada.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {STAGES.map((stage) => (
            <Button
              key={stage}
              type="button"
              variant={activeStage === stage ? "primary" : "secondary"}
              className="shrink-0 px-3 py-2 lg:hidden"
              onClick={() => setActiveStage(stage)}
            >
              {STAGE_LABELS[stage]}
            </Button>
          ))}
        </div>

        <div className="min-h-6 text-sm font-bold">
          {saveMessage ? (
            <span className="inline-flex items-center gap-2 text-emerald-300 light:text-emerald-700">
              <Save size={15} aria-hidden="true" />
              {saveMessage}
            </span>
          ) : null}
          {errorMessage ? (
            <span className="text-amber-300 light:text-amber-700">{errorMessage}</span>
          ) : null}
          {isPending && !saveMessage ? (
            <span className="text-slate-400 light:text-slate-600">Salvando...</span>
          ) : null}
        </div>
      </div>

      {initialBracket.isLocked ? (
        <Card className="flex items-center gap-3 p-4 text-sm font-semibold text-amber-200 light:text-amber-700">
          <Lock size={18} aria-hidden="true" />
          Palpites encerrados. A chave esta em modo somente leitura.
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        {STAGES.map((stage) => (
          <section
            key={stage}
            className={`${activeStage === stage ? "block" : "hidden"} lg:block`}
          >
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-400 light:text-slate-500">
              {STAGE_LABELS[stage]}
            </h2>
            <div className="space-y-3">
              {(matchesByStage.get(stage) ?? []).map(renderMatch)}
            </div>
          </section>
        ))}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Campeao escolhido
          </p>
          <p className="mt-1 text-2xl font-black text-slate-50 light:text-slate-950">
            {champion?.name ?? "A definir"}
          </p>
        </div>
        <Crown className="text-amber-300 light:text-amber-600" size={32} aria-hidden="true" />
      </Card>
    </div>
  );
}
