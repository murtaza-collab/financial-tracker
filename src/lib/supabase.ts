import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

// Retry transient network failures — but ONLY for reads. Browsers (Safari
// especially) drop idle keep-alive sockets, so the first request after a pause
// can throw "TypeError: Load failed" / "Failed to fetch".
//
// We must NEVER auto-retry writes (POST/PATCH/PUT/DELETE): a write can commit
// on the server and then lose its response on a dropped connection, so retrying
// silently duplicates the row. Only GET/HEAD are safe to retry. A failed write
// surfaces its error and the user re-submits deliberately.
const fetchWithRetry: typeof fetch = async (input, init) => {
  const method = (init?.method || 'GET').toUpperCase();
  const safeToRetry = method === 'GET' || method === 'HEAD';
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (!safeToRetry) throw err; // writes: fail fast, never duplicate
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithRetry },
})
