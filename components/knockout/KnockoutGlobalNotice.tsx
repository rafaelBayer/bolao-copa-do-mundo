import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

type KnockoutGlobalNoticeProps = {
  isAvailable: boolean;
  isLocked: boolean;
  userBracketComplete: boolean;
  userPicksCount: number;
  missingPicksCount: number;
  lockAt: string | null;
};

function formatLockAt(value: string | null) {
  if (!value) {
    return "antes do primeiro jogo";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function KnockoutGlobalNotice({
  isAvailable,
  isLocked,
  userBracketComplete,
  userPicksCount,
  missingPicksCount,
  lockAt,
}: KnockoutGlobalNoticeProps) {
  if (!isAvailable || isLocked || userBracketComplete) {
    return null;
  }

  const hasStarted = userPicksCount > 0;

  return (
    <section className="mx-auto mt-4 w-full max-w-[1800px] px-3 sm:px-5 lg:px-8">
      <div className="flex flex-col gap-4 rounded-lg border border-emerald-400/30 bg-emerald-400/12 p-4 shadow-lg shadow-emerald-950/10 light:border-emerald-200 light:bg-emerald-50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/35 bg-emerald-400/15 text-emerald-200 light:border-emerald-200 light:bg-white light:text-emerald-700">
            <Trophy size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-emerald-100 light:text-emerald-900">
              {hasStarted
                ? "Seu mata-mata ainda esta incompleto."
                : "Os playoffs foram liberados!"}
            </p>
            <p className="mt-1 text-sm leading-5 text-emerald-50/80 light:text-emerald-800">
              {hasStarted
                ? `Faltam ${missingPicksCount} escolhas. Finalize antes de ${formatLockAt(lockAt)}.`
                : `Monte sua chave ate 10 minutos antes do primeiro jogo: ${formatLockAt(lockAt)}.`}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/mata-mata"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-emerald-300 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
        >
          Montar mata-mata
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
