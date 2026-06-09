"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type RoundNavigatorProps = {
  currentRound: number;
  minRound: number;
  maxRound: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function RoundNavigator({
  currentRound,
  minRound,
  maxRound,
  onPrevious,
  onNext,
}: RoundNavigatorProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentRound <= minRound}
        title="Rodada anterior"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-35 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50 light:hover:text-emerald-700"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-300 light:border-amber-200 light:bg-amber-50 light:text-amber-700">
        Rodada {currentRound}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={currentRound >= maxRound}
        title="Proxima rodada"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-35 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50 light:hover:text-emerald-700"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
