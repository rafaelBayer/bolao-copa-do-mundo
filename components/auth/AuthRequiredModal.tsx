"use client";

import Link from "next/link";
import { X } from "lucide-react";

type AuthRequiredModalProps = {
  isOpen: boolean;
  title?: string;
  message: string;
  note?: string;
  redirectTo?: string;
  onClose: () => void;
};

function authHref(path: "/login" | "/cadastro", redirectTo: string) {
  return `${path}?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export function AuthRequiredModal({
  isOpen,
  title = "Entre para palpitar",
  message,
  note,
  redirectTo = "/dashboard/groups",
  onClose,
}: AuthRequiredModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-required-title"
      className="fixed inset-0 z-50 flex items-end bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full max-w-md rounded-t-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl light:border-slate-200 light:bg-white sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-300 light:text-emerald-700">
              Conta gratuita
            </p>
            <h2
              id="auth-required-title"
              className="mt-2 text-2xl font-black text-slate-50 light:text-slate-950"
            >
              {title}
            </h2>
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

        <p className="mt-4 text-sm leading-6 text-slate-300 light:text-slate-700">
          {message}
        </p>
        {note ? (
          <p className="mt-2 text-sm font-semibold text-slate-500 light:text-slate-500">
            {note}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link
            href={authHref("/login", redirectTo)}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm shadow-emerald-950/20 transition hover:bg-emerald-400 light:bg-emerald-600 light:text-white light:hover:bg-emerald-700"
          >
            Entrar
          </Link>
          <Link
            href={authHref("/cadastro", redirectTo)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:bg-slate-800 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-emerald-300 light:hover:bg-emerald-50"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  );
}
