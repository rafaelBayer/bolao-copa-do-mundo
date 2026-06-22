"use client";

import Link from "next/link";
import type { AdminPanelSection } from "@/components/admin/AdminPanelContent";

type ProfileTab = "perfil" | "boloes" | "admin";

type ProfileNavItem = {
  id: ProfileTab;
  label: string;
};

type AdminNavItem = {
  id: AdminPanelSection;
  label: string;
};

type ProfileSettingsNavProps = {
  tabs: ProfileNavItem[];
  adminSections: AdminNavItem[];
  activeTab: ProfileTab;
  activeAdminSection: AdminPanelSection;
  showAdminMenu: boolean;
};

function savePreference(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/dashboard; max-age=31536000; samesite=lax`;
}

export function ProfileSettingsNav({
  tabs,
  adminSections,
  activeTab,
  activeAdminSection,
  showAdminMenu,
}: ProfileSettingsNavProps) {
  function rememberTab(tab: ProfileTab) {
    savePreference("bolao_profile_tab", tab);

    if (tab === "admin") {
      savePreference("bolao_admin_section", "home");
    }
  }

  function rememberAdminSection(section: AdminPanelSection) {
    savePreference("bolao_profile_tab", "admin");
    savePreference("bolao_admin_section", section);
  }

  function tabHref(tab: ProfileTab) {
    if (tab === "perfil") {
      return "/dashboard/profile?tab=perfil";
    }

    if (tab === "boloes") {
      return "/dashboard/profile?tab=boloes";
    }

    return "/dashboard/profile?tab=admin&section=home";
  }

  return (
    <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Link
            key={tab.id}
            href={tabHref(tab.id)}
            aria-current={isActive ? "page" : undefined}
            onClick={() => rememberTab(tab.id)}
            className={`shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-black transition ${
              isActive
                ? "bg-emerald-400/15 text-emerald-200 light:bg-emerald-50 light:text-emerald-700"
                : "text-slate-300 hover:bg-slate-800 hover:text-slate-50 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-950"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}

      {showAdminMenu ? (
        <div className="flex gap-1 border-l border-slate-800 pl-3 lg:mt-1 lg:flex-col lg:border-l-0 lg:border-t lg:pl-0 lg:pt-2 light:border-slate-200">
          {adminSections.map((section) => {
            const isActive = section.id === activeAdminSection;

            return (
              <Link
                key={section.id}
                href={`/dashboard/profile?tab=admin&section=${section.id}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => rememberAdminSection(section.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-left text-xs font-bold transition lg:ml-3 ${
                  isActive
                    ? "bg-slate-800 text-emerald-200 light:bg-slate-100 light:text-emerald-700"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
