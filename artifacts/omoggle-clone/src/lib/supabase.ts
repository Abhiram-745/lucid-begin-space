import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null;

/** Sign in anonymously if no session exists. Returns the user id, or null if anon auth is disabled. */
export async function ensureAuth(): Promise<string | null> {
  if (!supabase) return null;
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn("Anonymous auth failed — enable it in Supabase dashboard.", error.message);
    return null;
  }
  return data.user?.id ?? null;
}
