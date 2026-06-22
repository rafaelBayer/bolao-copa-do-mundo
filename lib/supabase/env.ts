function optionalPublicEnv(name: string) {
  const publicEnv: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };

  return publicEnv[name]?.trim() || undefined;
}

export function getSupabaseEnv() {
  const url = optionalPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    optionalPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    optionalPublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !publishableKey) {
    throw new Error("Missing Supabase public env.");
  }

  return { url, publishableKey };
}
