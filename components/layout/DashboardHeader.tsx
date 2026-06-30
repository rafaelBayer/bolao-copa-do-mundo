"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, ListChecks, Medal, Trophy } from "lucide-react";
import { UserMenu } from "./UserMenu";

type DashboardHeaderProps = {
  userLabel: string;
  userEmail?: string | null;
  avatarUrl?: string | null;
  brandTitle?: string | null;
  brandLogoUrl?: string | null;
};

export function DashboardHeader({
  userLabel,
  userEmail = null,
  avatarUrl = null,
  brandTitle = "Bolão da Copa",
  brandLogoUrl = null,
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const title = brandTitle?.trim() || "Bolão da Copa";
  const logoUrl = brandLogoUrl?.trim() || null;
  const shouldShowLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);
  const navItems = [
    {
      href: "/dashboard/groups",
      label: "Palpites",
      icon: ListChecks,
      isActive:
        pathname === "/dashboard/groups" || pathname.startsWith("/dashboard/groups/"),
    },
    {
      href: "/dashboard/leaderboard",
      label: "Classificação",
      icon: Medal,
      isActive: pathname === "/dashboard/leaderboard",
    },
    {
      href: "/dashboard/mata-mata",
      label: "Mata-mata",
      icon: GitBranch,
      isActive: pathname === "/dashboard/mata-mata",
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/82 backdrop-blur-xl light:border-slate-200/80 light:bg-white/85">
      <div className="mx-auto flex max-w-[1536px] items-center justify-between gap-3 px-3 py-3 sm:hidden">
        <Link
          href="/dashboard/groups"
          className="flex min-w-0 flex-1 items-center gap-2 text-base font-black text-slate-50 transition hover:text-emerald-300 light:text-slate-950 light:hover:text-emerald-700"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden shadow-sm ${
              logoUrl && shouldShowLogo
                ? "rounded-full bg-transparent"
                : "rounded-2xl bg-emerald-400 text-slate-950 shadow-emerald-950/30 light:bg-emerald-600 light:text-white"
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
          <span className="min-w-0 truncate">{title}</span>
        </Link>

        <UserMenu
          userLabel={userLabel}
          userEmail={userEmail}
          avatarUrl={avatarUrl}
        />
      </div>

      <nav
        className="mx-auto grid max-w-[1536px] gap-2 px-3 pb-3 sm:hidden"
        style={{
          gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition ${
                item.isActive
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 light:border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700"
                  : "border-slate-800 bg-slate-900/55 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200 light:border-slate-200 light:bg-slate-50 light:text-slate-600 light:hover:border-emerald-300 light:hover:text-emerald-700"
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-auto hidden max-w-[1536px] flex-wrap items-center justify-between gap-3 px-3 py-4 sm:flex sm:px-5 lg:px-8">
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.isActive ? "page" : undefined}
                className={`rounded-full px-3 py-2 transition ${
                  item.isActive
                    ? "bg-emerald-400/10 text-emerald-300 light:bg-emerald-50 light:text-emerald-700"
                    : "text-slate-300 hover:bg-slate-800 hover:text-emerald-300 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-emerald-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <UserMenu
            userLabel={userLabel}
            userEmail={userEmail}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </header>
  );
}
