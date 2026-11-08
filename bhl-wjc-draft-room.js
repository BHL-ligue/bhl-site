import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './bhl-supabase.js';
import {initWjcDraftRoom} from './bhl-wjc-draft-room-view.js?v=1';
initWjcDraftRoom(createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY),document.getElementById('wjc-room'));
