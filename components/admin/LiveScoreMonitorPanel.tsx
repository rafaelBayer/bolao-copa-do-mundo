"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export type LiveScoreMonitorLog = {
  id: string;
  provider: string;
  status: "success" | "skipped" | "error";
  reason: string | null;
  activeMatchesCount: number;
  updatedMatchesCount: number;
  requestedMatchdays: number[];
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type LiveScoreMonitorMatch = {
  id: string;
  sourceLabel?: string;
  kickoffAt: string | null;
  homeTeamName: string;
  awayTeamName: string;
  statusShort: string | null;
  elapsed: number | null;
  homeScoreLive: number | null;
  awayScoreLive: number | null;
  homeScore: number | null;
  awayScore: number | null;
  scoreProviderFixtureId: string | null;
};

type LiveScoreMonitorPanelProps = {
  provider: string;
  logs: LiveScoreMonitorLog[];
  activeMatches: LiveScoreMonitorMatch[];
  nextMatch: LiveScoreMonitorMatch | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatKickoff(value: string | null) {
  if (!value) {
    return "Horário a definir";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatScore(match: LiveScoreMonitorMatch) {
  const homeScore = match.homeScoreLive ?? match.homeScore;
  const awayScore = match.awayScoreLive ?? match.awayScore;

  if (homeScore === null || awayScore === null) {
    return "-";
  }

  return `${homeScore} x ${awayScore}`;
}

function formatDurationSeconds(log: LiveScoreMonitorLog) {
  if (!log.finishedAt) {
    return "-";
  }

  const durationMs =
    new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime();

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "-";
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function reasonLabel(reason: string | null) {
  switch (reason) {
    case "outside_active_window":
      return "Nenhum jogo ativo agora";
    case "minimum_interval_not_reached":
      return "Intervalo mínimo ainda não atingido";
    case "halftime_pause":
      return "Pausa de intervalo";
    case "missing_fixture_mapping":
      return "Jogo ativo sem mapeamento";
    case "provider_error":
      return "Erro no provedor";
    case "active_match_window":
      return "Sincronizado em janela ativa";
    case "manual_provider":
      return "Provedor manual";
    default:
      return reason ?? "-";
  }
}

function statusTone(status: LiveScoreMonitorLog["status"]) {
  if (status === "success") return "emerald";
  if (status === "error") return "amber";
  return "default";
}

function generalStatus(logs: LiveScoreMonitorLog[]) {
  const latest = logs[0] ?? null;

  if (!latest) {
    return {
      label: "Atenção",
      tone: "amber" as const,
      description: "Nenhuma sincronização registrada ainda.",
    };
  }

  if (latest.status === "error") {
    return {
      label: "Erro",
      tone: "amber" as const,
      description: latest.errorMessage ?? "A última sincronização falhou.",
    };
  }

  return {
    label: "OK",
    tone: "emerald" as const,
    description: reasonLabel(latest.reason),
  };
}

export function LiveScoreMonitorPanel({
  provider,
  logs,
  activeMatches,
  nextMatch,
}: LiveScoreMonitorPanelProps) {
  const latestLog = logs[0] ?? null;
  const latestError = logs.find((log) => log.status === "error") ?? null;
  const latestSuccess = logs.find((log) => log.status === "success") ?? null;
  const status = generalStatus(logs);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100 light:border-amber-200 light:bg-amber-50 light:text-amber-800">
        <p className="font-black">Sincronização automática desativada no MVP</p>
        <p className="mt-1">
          As rotas de sincronização retornam 410 nesta publicação. Use a aba Partidas
          para atualizar placares manualmente quando necessário.
        </p>
      </div>

      {latestError && (!latestSuccess || latestError.startedAt > latestSuccess.startedAt) ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100 light:border-red-200 light:bg-red-50 light:text-red-700">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} aria-hidden="true" className="mt-0.5" />
            <div>
              <p className="font-black">Erro na sincronização do placar</p>
              <p className="mt-1">
                Provedor: {latestError.provider} · Última tentativa:{" "}
                {formatDateTime(latestError.startedAt)}
              </p>
              <p className="mt-1">
                Mensagem: {latestError.errorMessage ?? "Erro não informado."}
              </p>
              <p className="mt-2 font-bold">
                Ação recomendada: tente novamente em alguns minutos ou atualize
                manualmente se o jogo estiver ao vivo.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 light:text-slate-400">
                Status geral
              </p>
              <h3 className="mt-2 text-lg font-black text-slate-50 light:text-slate-950">
                Status do placar: {status.label}
              </h3>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <div className="mt-4 space-y-1 text-sm text-slate-300 light:text-slate-600">
            <p>Provedor: {provider}</p>
            <p>Última sincronização: {formatDateTime(latestLog?.startedAt ?? null)}</p>
            <p>Último sucesso: {formatDateTime(latestSuccess?.startedAt ?? null)}</p>
            <p>Último erro: {formatDateTime(latestError?.startedAt ?? null)}</p>
            <p className="text-slate-400 light:text-slate-500">
              {status.description}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 light:border-slate-200 light:bg-slate-50 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 light:text-slate-400">
            Jogos ativos
          </p>
          {activeMatches.length > 0 ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {activeMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/55 p-3 light:border-slate-200 light:bg-white"
                >
                  <p className="font-black text-slate-50 light:text-slate-950">
                    {match.homeTeamName} x {match.awayTeamName}
                  </p>
                  {match.sourceLabel ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-300 light:text-emerald-700">
                      {match.sourceLabel}
                    </p>
                  ) : null}
                  <div className="mt-2 space-y-1 text-xs font-bold text-slate-400 light:text-slate-500">
                    <p>Kickoff: {formatKickoff(match.kickoffAt)}</p>
                    <p>Fixture: {match.scoreProviderFixtureId ?? "-"}</p>
                    <p>Status atual: {match.statusShort ?? "NS"}</p>
                    <p>Placar live: {formatScore(match)}</p>
                    <p>
                      Minuto:{" "}
                      {match.elapsed !== null ? `${match.elapsed}'` : "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/55 p-4 text-sm text-slate-300 light:border-slate-200 light:bg-white light:text-slate-600">
              <p>Nenhum jogo em janela ativa agora.</p>
              {nextMatch ? (
                <p className="mt-1">
                  Próximo jogo: {nextMatch.homeTeamName} x{" "}
                  {nextMatch.awayTeamName} - {formatKickoff(nextMatch.kickoffAt)}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 light:border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm light:divide-slate-200">
            <thead className="bg-slate-950/70 light:bg-slate-50">
              <tr className="text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500 light:text-slate-400">
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Provedor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Ativos</th>
                <th className="px-4 py-3">Atualizados</th>
                <th className="px-4 py-3">Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 light:divide-slate-200">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="text-slate-300 light:text-slate-600">
                    <td className="px-4 py-3">{formatDateTime(log.startedAt)}</td>
                    <td className="px-4 py-3">{log.provider}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{reasonLabel(log.reason)}</td>
                    <td className="px-4 py-3">{log.activeMatchesCount}</td>
                    <td className="px-4 py-3">{log.updatedMatchesCount}</td>
                    <td className="px-4 py-3">{formatDurationSeconds(log)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-slate-400 light:text-slate-500"
                  >
                    Nenhuma execução de sincronização registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
