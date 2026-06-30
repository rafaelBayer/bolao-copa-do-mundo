"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Radio, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

export type AdminLiveMatch = {
  id: string;
  kickoffAt: string | null;
  homeTeamName: string;
  awayTeamName: string;
  statusShort: string | null;
  elapsed: number | null;
  homeScoreLive: number | null;
  awayScoreLive: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type LiveScoreAdminPanelProps = {
  poolId: string;
  matches: AdminLiveMatch[];
};

type MatchFormState = {
  homeScoreLive: string;
  awayScoreLive: string;
  statusShort: string;
  elapsed: string;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

function toInputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function initialState(match: AdminLiveMatch): MatchFormState {
  return {
    homeScoreLive: toInputValue(match.homeScoreLive ?? match.homeScore),
    awayScoreLive: toInputValue(match.awayScoreLive ?? match.awayScore),
    statusShort: match.statusShort ?? "1H",
    elapsed: toInputValue(match.elapsed),
  };
}

function parseScore(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const score = Number(value);

  if (!Number.isInteger(score) || score < 0) {
    return null;
  }

  return score;
}

function formatKickoff(kickoffAt: string | null) {
  if (!kickoffAt) {
    return "Horário a definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoffAt));
}

export function LiveScoreAdminPanel({
  poolId,
  matches,
}: LiveScoreAdminPanelProps) {
  const [formByMatchId, setFormByMatchId] = useState(() =>
    new Map(matches.map((match) => [match.id, initialState(match)])),
  );
  const [saveByMatchId, setSaveByMatchId] = useState(
    () => new Map<string, SaveState>(),
  );

  function updateForm(matchId: string, field: keyof MatchFormState, value: string) {
    setFormByMatchId((current) => {
      const next = new Map(current);
      const previous = next.get(matchId);

      if (!previous) {
        return current;
      }

      next.set(matchId, {
        ...previous,
        [field]: value,
      });

      return next;
    });
    setSaveByMatchId((current) => {
      const next = new Map(current);
      next.set(matchId, { status: "idle", message: "" });
      return next;
    });
  }

  function setSaveState(matchId: string, state: SaveState) {
    setSaveByMatchId((current) => {
      const next = new Map(current);
      next.set(matchId, state);
      return next;
    });
  }

  async function saveLiveScore(match: AdminLiveMatch) {
    const form = formByMatchId.get(match.id);

    if (!form) {
      return;
    }

    const homeScore = parseScore(form.homeScoreLive);
    const awayScore = parseScore(form.awayScoreLive);
    const elapsed = form.elapsed.trim() === "" ? null : Number(form.elapsed);

    if (homeScore === null || awayScore === null) {
      setSaveState(match.id, {
        status: "error",
        message: "Informe placares válidos.",
      });
      return;
    }

    if (elapsed !== null && (!Number.isInteger(elapsed) || elapsed < 0)) {
      setSaveState(match.id, {
        status: "error",
        message: "Informe minuto válido.",
      });
      return;
    }

    setSaveState(match.id, { status: "saving", message: "Salvando..." });

    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_match_live_score", {
      target_pool_id: poolId,
      target_match_id: match.id,
      target_home_score_live: homeScore,
      target_away_score_live: awayScore,
      target_status_short: form.statusShort || "1H",
      target_elapsed: elapsed,
    });

    if (error) {
      setSaveState(match.id, {
        status: "error",
        message: "Erro ao salvar placar ao vivo.",
      });
      return;
    }

    setSaveState(match.id, {
      status: "saved",
      message: "Placar ao vivo salvo.",
    });
  }

  async function finalizeScore(match: AdminLiveMatch) {
    const form = formByMatchId.get(match.id);

    if (!form) {
      return;
    }

    const homeScore = parseScore(form.homeScoreLive);
    const awayScore = parseScore(form.awayScoreLive);

    if (homeScore === null || awayScore === null) {
      setSaveState(match.id, {
        status: "error",
        message: "Informe placares válidos para finalizar.",
      });
      return;
    }

    setSaveState(match.id, { status: "saving", message: "Finalizando..." });

    const supabase = createClient();
    const { error } = await supabase.rpc("admin_finalize_match_score", {
      target_pool_id: poolId,
      target_match_id: match.id,
      target_home_score: homeScore,
      target_away_score: awayScore,
    });

    if (error) {
      setSaveState(match.id, {
        status: "error",
        message: "Erro ao finalizar jogo.",
      });
      return;
    }

    updateForm(match.id, "statusShort", "FT");
    updateForm(match.id, "elapsed", "90");
    setSaveState(match.id, {
      status: "saved",
      message: "Jogo finalizado.",
    });
  }

  if (matches.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-sm text-slate-400 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
        Nenhum jogo encontrado para atualizar agora.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const form = formByMatchId.get(match.id) ?? initialState(match);
        const saveState =
          saveByMatchId.get(match.id) ?? { status: "idle", message: "" };
        const isSaving = saveState.status === "saving";

        return (
          <form
            key={match.id}
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void saveLiveScore(match);
            }}
            className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-50 light:text-slate-950">
                  {match.homeTeamName} x {match.awayTeamName}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400 light:text-slate-500">
                  {formatKickoff(match.kickoffAt)}
                </p>
              </div>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-black text-slate-300 light:border-slate-200 light:text-slate-600">
                {match.statusShort ?? "NS"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
              <Input
                type="number"
                min={0}
                value={form.homeScoreLive}
                onChange={(event) =>
                  updateForm(match.id, "homeScoreLive", event.target.value)
                }
                placeholder="Mandante"
                aria-label={`Placar de ${match.homeTeamName}`}
              />
              <Input
                type="number"
                min={0}
                value={form.awayScoreLive}
                onChange={(event) =>
                  updateForm(match.id, "awayScoreLive", event.target.value)
                }
                placeholder="Visitante"
                aria-label={`Placar de ${match.awayTeamName}`}
              />
              <Input
                value={form.statusShort}
                onChange={(event) =>
                  updateForm(match.id, "statusShort", event.target.value)
                }
                placeholder="1H, HT, 2H"
                aria-label="Status curto"
              />
              <Input
                type="number"
                min={0}
                value={form.elapsed}
                onChange={(event) =>
                  updateForm(match.id, "elapsed", event.target.value)
                }
                placeholder="Min"
                aria-label="Minuto"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  <Save size={16} aria-hidden="true" />
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSaving}
                  onClick={() => void finalizeScore(match)}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Finalizar
                </Button>
              </div>
            </div>

            {saveState.message ? (
              <p
                className={`mt-3 flex items-center gap-2 text-xs font-bold ${
                  saveState.status === "error"
                    ? "text-red-300 light:text-red-600"
                    : saveState.status === "saved"
                      ? "text-emerald-300 light:text-emerald-700"
                      : "text-amber-300 light:text-amber-700"
                }`}
              >
                <Radio size={14} aria-hidden="true" />
                {saveState.message}
              </p>
            ) : null}
          </form>
        );
      })}
    </div>
  );
}
