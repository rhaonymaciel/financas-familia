import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uafsssk felsrrwwvccpe.supabase.co'
const SUPABASE_KEY = 'sb_publishable_4ipUif_fj7tm-o5DnYOpFg_wjfXvzln'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
