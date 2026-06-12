import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "REDACTED_SUPABASE_URL";

const supabaseAnonKey = "PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);