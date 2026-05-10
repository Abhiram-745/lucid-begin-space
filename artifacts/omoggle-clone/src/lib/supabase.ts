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

export type AuthResult = { userId: string | null; error?: string };

/**
 * Session for matchmaking + Realtime. Tries:
 * 1) existing session
 * 2) `signInAnonymously()` (best for quick matchmaking)
 * 3) one-time email+password `signUp` (works if Email is on and "Confirm email" is off)
 */
export async function ensureAuth(): Promise<AuthResult> {
  if (!supabase) {
    return {
      userId: null,
      error:
        "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to artifacts/omoggle-clone/.env and restart the dev server.",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  const anon = await supabase.auth.signInAnonymously();
  if (!anon.error && anon.data.user?.id) {
    return { userId: anon.data.user.id };
  }

  const id = crypto.randomUUID().replace(/-/g, "");
  const email = `unmoggle.${id.slice(0, 10)}.${Date.now()}@example.com`;
  const password = `U1${id}Xx!`.padEnd(12, "0").slice(0, 64);

  const signUp = await supabase.auth.signUp({ email, password });

  if (signUp.error) {
    return {
      userId: null,
      error: [
        anon.error && `Anonymous sign-in: ${anon.error.message}`,
        `Email sign-up fallback: ${signUp.error.message}`,
        "Open Supabase → Authentication → Providers: turn on Anonymous (easiest), or ensure Email is enabled and try again.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (signUp.data.session?.user?.id) {
    return { userId: signUp.data.session.user.id };
  }

  return {
    userId: null,
    error:
      "No session after sign-up (email confirmation is likely required). In Supabase: Authentication → Providers → Email → disable “Confirm email” for dev, or enable Anonymous sign-in instead.",
  };
}

export function getSupabaseProjectDashboardAuthUrl(): string | null {
  const m = supabaseUrl?.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
  if (!m) return null;
  return `https://supabase.com/dashboard/project/${m[1]}/auth/providers`;
}
