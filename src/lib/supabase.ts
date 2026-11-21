/**
 * DJIFFA ACADEMY - Supabase Browser Client & Cloud Helpers
 * Only uses public anon keys (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * Gracefully stays inactive (null) when not yet configured, preserving localStorage mode.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const stripQuotes = (v: string | undefined) => (v || '').trim().replace(/^["']|["']$/g, '').trim();
const supabaseUrl = stripQuotes(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = stripQuotes(import.meta.env.VITE_SUPABASE_ANON_KEY);
const isValidHttpUrl = /^https?:\/\/[^/\s]+/i.test(supabaseUrl);

export const isSupabaseConfigured = Boolean(isValidHttpUrl && supabaseAnonKey);

let supabaseInstance: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch {
    supabaseInstance = null;
  }
}

export const supabase: SupabaseClient | null = supabaseInstance;

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
