import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

// Retry transient network failures. Browsers (Safari especially) drop idle
// keep-alive sockets, so the first request after a pause can throw
// "TypeError: Load failed" / "Failed to fetch" even though the server is fine.
// fetch() only THROWS on network-level errors — HTTP 4xx/5xx come back as a
// normal Response — so this never retries a real server error, only a dropped
// connection where the request never reached the server.
const fetchWithRetry: typeof fetch = async (input, init) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithRetry },
})
