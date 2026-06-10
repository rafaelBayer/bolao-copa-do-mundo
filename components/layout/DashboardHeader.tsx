"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { UserMenu } from "./UserMenu";

type DashboardHeaderProps = {
  userLabel: string;
  userEmail?: string | null;
  avatarUrl?: string | null;
  isOwner?: boolean;
  brandTitle?: string | null;
  brandLogoUrl?: string | null;
};

export function DashboardHeader({
  userLabel,
  userEmail = null,
  avatarUrl = null,
  isOwner = false,
  brandTitle = "Bolao da Copa",
  brandLogoUrl = null,
}: DashboardHeaderProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const title = brandTitle?.trim() || "Bolao da Copa";
  const logoUrl = brandLogoUrl?.trim() || null;
  const shouldShowLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/82 backdrop-blur-xl light:border-slate-200/80 light:bg-white/85">
      <div className="mx-auto flex max-w-[1536px] flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/dashboard/groups"
            className="flex items-center gap-2 text-base font-black text-slate-50 transition hover:text-emerald-300 light:text-slate-950 light:hover:text-emerald-700 sm:text-lg"
          >
            <span
              className={`flex items-center justify-center overflow-hidden shadow-sm ${
                logoUrl && shouldShowLogo
                  ? "h-11 w-11 rounded-full bg-transparent sm:h-12 sm:w-12"
                  : "h-9 w-9 rounded-2xl bg-emerald-400 text-slate-950 shadow-emerald-950/30 light:bg-emerald-600 light:text-white"
              }`}
            >
              {logoUrl && shouldShowLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => setFailedLogoUrl(logoUrl)}
                />
              ) : (
                <Trophy size={18} aria-hidden="true" />
              )}
            </span>
            <span className="max-w-[12rem] truncate sm:max-w-[18rem]">
              {title}
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link
              href="/dashboard/groups"
              className="rounded-full px-3 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-emerald-300 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-emerald-700"
            >
              Palpites
            </Link>
            <Link
              href="/dashboard/leaderboard"
              className="rounded-full px-3 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-emerald-300 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-emerald-700"
            >
              Classificacao
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
