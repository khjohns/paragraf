import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iyetsvrteyzpirygxenu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ucd292VE5gDnTF6t_7fpqA_3KOn9n9Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
