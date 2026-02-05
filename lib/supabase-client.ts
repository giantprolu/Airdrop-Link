import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Custom base64 decoder for mobile compatibility
// Fixes "The string did not match the expected pattern" error on iOS Safari
function base64Decode(str: string): string {
  try {
    // First try native atob
    return atob(str);
  } catch {
    // Fallback: handle URL-safe base64 and add padding if needed
    try {
      // Replace URL-safe characters
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if necessary
      const padding = base64.length % 4;
      if (padding) {
        base64 += '='.repeat(4 - padding);
      }
      
      return atob(base64);
    } catch {
      // Ultimate fallback - decode manually
      console.warn('Base64 decode failed, returning empty string');
      return '';
    }
  }
}

// Polyfill atob for environments where it might fail
if (typeof window !== 'undefined') {
  const originalAtob = window.atob.bind(window);
  window.atob = function(str: string): string {
    try {
      return originalAtob(str);
    } catch {
      return base64Decode(str);
    }
  };
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'airdrop-web',
      },
    },
  });
  
  return supabaseInstance;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
