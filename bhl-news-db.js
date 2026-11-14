import {hydrateInlineImages} from './bhl-news-images.js?v=inline1';
import {renderBody} from './bhl-news-format.js?v=team-banners1';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './bhl-supabase.js';
export const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
export const labels={draft:'Brouillon',pending:'En attente d’approbation',published:'Publié',rejected:'À revoir'};
export const publicFields='id,title,summary,category,article_date,season,reporter_name,media_name,published_at,cover_path,cover_alt,cover_caption,journalist_id,team_tags';
export function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
export function date(value){return value?new Date(value).toLocaleString('fr-CA',{dateStyle:'long',timeStyle:'short',timeZone:'America/Toronto'}):'';}
export function articleLink(id){return 'bhl-article.html?id='+encodeURIComponent(id);}
export function paragraphs(target,body,format='plain'){renderBody(target,body,format);hydrateInlineImages(db,target);}
