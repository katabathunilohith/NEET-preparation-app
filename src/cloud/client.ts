import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Accepts the project URL even if pasted with a trailing slash or an API path (e.g. /rest/v1). */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?.trim()
  .replace(/\/(rest|auth)\/v1\/?.*$/, '')
  .replace(/\/+$/, '');
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** null when the app is built without Supabase settings → offline-only mode. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;

export const cloudEnabled = supabase !== null;
