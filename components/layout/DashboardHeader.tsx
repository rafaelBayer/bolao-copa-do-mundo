"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

type DashboardHeaderProps = {
  userLabel: string;
  isOwner?: boolean;
};

export function DashboardHeader({
  userLabel,
  isOwner = false,
}: DashboardHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/82 backdrop-blur-xl light:border-slate-200/80 light:bg-white/85">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/dashboard/groups"
            className="flex items-center gap-2 text-base font-black text-slate-50 transition hover:text-emerald-300 light:text-slate-950 light:hover:text-emerald-700 sm:text-lg"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-950/30 light:bg-emerald-600 light:text-white">
              <Trophy size={18} aria-hidden="true" />
            </span>
            <span className="truncate">Bolao da Copa</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link
              href="/dashboard/groups"
              className="rounded-full px-3 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-emerald-300 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-emerald-700"
            >
              Grupos
            </Link>
            {isOwner ? (
              <Link
                href="/dashboard/admin"
                className="rounded-full px-3 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-emerald-300 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-emerald-700"
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden max-w-44 truncate text-sm font-medium text-slate-400 light:text-slate-500 sm:inline">
            {userLabel}
          </span>
          <ThemeToggle />
          <button
            type="button"
            onClick={handleSignOut}
            title="Sair"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 text-sm font-bold text-slate-100 shadow-sm transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-300 light:border-slate-200 light:bg-white light:text-slate-700 light:hover:border-red-200 light:hover:bg-red-50 light:hover:text-red-700"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
