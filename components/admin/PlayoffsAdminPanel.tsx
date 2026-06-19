import { Lock } from "lucide-react";

type PlayoffsAdminPanelProps = {
  isLocked: boolean;
  lockAt: string | null;
  startedUsersCount: number;
  matchesCount: number;
};

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

export function PlayoffsAdminPanel({
  isLocked,
  lockAt,
  startedUsersCount,
  matchesCount,
}: PlayoffsAdminPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="grid gap-3 text-sm text-slate-300 light:text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Status
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {isLocked ? "Bloqueado" : "Owner"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Prazo
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {formatDeadline(lockAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Jogos
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {matchesCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 light:border-slate-200 light:bg-slate-50">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 light:text-slate-500">
            Chaves iniciadas
          </p>
          <p className="mt-1 font-black text-slate-100 light:text-slate-900">
            {startedUsersCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4 text-sm font-semibold text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-600">
        <p className="flex items-center gap-2 font-black text-slate-100 light:text-slate-900">
          <Lock size={17} aria-hidden="true" />
          Acesso restrito ao owner
        </p>
        <p className="mt-2 text-xs text-slate-500 light:text-slate-500">
          {isLocked
            ? "O primeiro jogo ja comecou. A edicao esta bloqueada."
            : "Participantes nao veem nem editam a chave eliminatoria."}
        </p>
      </div>
    </div>
  );
}
