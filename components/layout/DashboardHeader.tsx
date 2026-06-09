"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { UserMenu } from "./UserMenu";

type DashboardHeaderProps = {
  userLabel: string;
  userEmail?: string | null;
  avatarUrl?: string | null;
  isOwner?: boolean;
};

export function DashboardHeader({
  userLabel,
  userEmail = null,
  avatarUrl = null,
  isOwner = false,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/82 backdrop-blur-xl light:border-slate-200/80 light:bg-white/85">
      <div className="mx-auto flex max-w-[1536px] flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-5 lg:px-8">
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
              Palpites
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <UserMenu
            userLabel={userLabel}
            userEmail={userEmail}
            avatarUrl={avatarUrl}
            isOwner={isOwner}
          />
        </div>
      </div>
    </header>
  );
}
