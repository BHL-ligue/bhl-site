import {db,node} from './bhl-news-db.js?v=journalists1';
let teamRequest;
export function articleTeams(){return teamRequest||(teamRequest=db.from('bhl_teams').select('team_id,team_name').order('team_name').then(({data,error})=>{if(error){teamRequest=null;throw error}return data||[]}))}
export function articleTags(article){const holder=node('div',undefined,'article-tags');if(!article.team_tags?.length)return holder;articleTeams().then(teams=>{for(const id of article.team_tags){const team=teams.find(t=>t.team_id===id);const link=node('a',team?.team_name||id);link.href='bhl-nouvelles.html?team='+encodeURIComponent(id);holder.append(link)}}).catch(()=>{});return holder}
