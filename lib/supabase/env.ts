type SupabaseTarget = "default" | "syo" | "public";

function optionalEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function currentTarget(): SupabaseTarget {
  const target = (
    optionalEnv("NEXT_PUBLIC_SUPABASE_TARGET") ??
    optionalEnv("SUPABASE_TARGET")
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
    ? optionalEnv(`NEXT_PUBLIC_${targetPrefix}_SUPABASE_URL`) ??
      optionalEnv(`${targetPrefix}_SUPABASE_URL`)
    : optionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = targetPrefix
    ? optionalEnv(`NEXT_PUBLIC_${targetPrefix}_SUPABASE_ANON_KEY`) ??
      optionalEnv(`${targetPrefix}_SUPABASE_ANON_KEY`)
    : optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
      optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !publishableKey) {
    throw new Error(
      `Missing Supabase public env for target: ${target}.`,
    );
  }

  return { url, publishableKey };
}
