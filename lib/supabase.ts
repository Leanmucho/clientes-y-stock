import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gnxycdniusjnvbmokgnx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7WBShv24CRSszilYmwGPJg_2OdOLYN7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
