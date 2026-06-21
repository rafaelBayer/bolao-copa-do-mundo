"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function savePreference(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/dashboard; max-age=31536000; samesite=lax`;
}

export function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    savePreference("bolao_profile_tab", "admin");
    savePreference("bolao_admin_section", "home");
    router.replace("/dashboard/profile");
  }, [router]);

  return null;
}
