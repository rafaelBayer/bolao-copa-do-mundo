type SupabaseTarget = "default" | "syo" | "public";

function optionalPublicEnv(name: string) {
  const publicEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_TARGET: process.env.NEXT_PUBLIC_SUPABASE_TARGET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SYO_SUPABASE_URL: process.env.NEXT_PUBLIC_SYO_SUPABASE_URL,
    NEXT_PUBLIC_SYO_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SYO_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_PUBLIC_SUPABASE_ANON_KEY,
  };

  return publicEnv[name]?.trim() || undefined;
}

function optionalServerEnv(name: string) {
  if (typeof window !== "undefined") {
    return undefined;
  }

  return process.env[name]?.trim() || undefined;
}

function currentTarget(): SupabaseTarget {
  const target = (
    optionalPublicEnv("NEXT_PUBLIC_SUPABASE_TARGET") ??
    optionalServerEnv("SUPABASE_TARGET")
  )?.toLowerCase();

  if (!target) {
    return "default";
  }

  if (target === "syo" || target === "public") {
    return target;
  }

  throw new Error(
    `Invalid SUPABASE_TARGET "${target}". Use "syo", "public" or leave it empty.`,
  );
}

export function getSupabaseEnv() {
  const target = currentTarget();
  const targetPrefix =
    target === "syo" ? "SYO" : target === "public" ? "PUBLIC" : null;
  const url = targetPrefix
    ? optionalPublicEnv(`NEXT_PUBLIC_${targetPrefix}_SUPABASE_URL`) ??
      optionalServerEnv(`${targetPrefix}_SUPABASE_URL`)
    : optionalPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = targetPrefix
    ? optionalPublicEnv(`NEXT_PUBLIC_${targetPrefix}_SUPABASE_ANON_KEY`) ??
      optionalServerEnv(`${targetPrefix}_SUPABASE_ANON_KEY`)
    : optionalPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
      optionalPublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !publishableKey) {
    throw new Error(
      `Missing Supabase public env for target: ${target}.`,
    );
  }

  return { url, publishableKey };
}
