import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './bhl-supabase.js';
const CLUBS={ANAHEIM:['Anaheim','anaheim-mightyducks.png','#532a44','#173c4b'],ATLANTA:['Atlanta','atlanta-thrashers.png','#0078a5','#172c4b'],CALIFORNIE:['Californie','california-goldenseals.png','#08745d','#e5ad33'],CHICAGO:['Chicago','chicago-blackhawks.png','#c8102e','#141414'],CLEVELAND:['Boston','boston-bruins.png','#ffb81c','#171717'],BOSTON:['Boston','boston-bruins.png','#ffb81c','#171717'],COLORADO:['Colorado','colorado-avalanche.png','#6f263d','#236192'],DETROIT:['Detroit','detroit-redwings.png','#ce1126','#881426'],FLORIDA:['Floride','florida-panthers.png','#c8102e','#041e42'],HARTFORD:['Hartford','hartford-whalers.png','#007a52','#12418d'],MINNESOTA:['Minnesota','minnesota-northstars.png','#087d4a','#e1b747'],MONTREAL:['Montréal','montreal-canadiens.png','#af1e2d','#192f6b'],NASHVILLE:['Nashville','nashville-predators.png','#ffb81c','#041e42'],NEWYORK:['New York','newyork-rangers.png','#0038a8','#ce1126'],OTTAWA:['Ottawa','ottawa-senators.png','#c52032','#181818'],QUEBEC:['Québec','quebec-nordiques.png','#005eb8','#cf142b'],TORONTO:['Toronto','toronto-mapleleafs.png','#003e7e','#092347'],VEGAS:['Vegas','vegas-golden-knights.png','#b4975a','#333f42'],EDMONTON:['Edmonton','edmonton-oilers.png','#ff4c00','#041e42'],MAROONS:['Maroons','montreal-maroons.png','#6d1f2a','#341119'],WINNIPEG:['Winnipeg','winnipeg-jets.png','#041e42','#7b303e']};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const club=id=>CLUBS[String(id).normalize('NFD').replace(/[\u0300-\u036f]/g,'')]||['BHL','BHLlogo.png','#cc0000','#182334'];
const slots=[['captain','C','Capitaine'],['assistant_1','A','Assistant 1'],['assistant_2','A','Assistant 2'],['assistant_3','A','Assistant 3']];
let teams=[],current=[],events=[],historyFailed=false,people=new Map(),view='current',busy=false,loaded=false,signature='';
const colors=id=>'--primary:'+club(id)[2]+';--secondary:'+club(id)[3];
const teamLogo=id=>'<img src="logos/'+esc(club(id)[1])+'" alt="">';
const teamName=id=>teams.find(t=>t.team_id===id)?.team_name||club(id)[0];
const teamMatch=id=>!$('team-filter').value||$('team-filter').value===id;
const roleMatch=role=>!$('role-filter').value||($('role-filter').value==='assistant'?role.startsWith('assistant'):role==='captain');
const nameMatch=(...names)=>!$('player-filter').value||names.some(name=>norm(name).includes(norm($('player-filter').value)));
const date=value=>new Date(value).toLocaleDateString('fr-CA',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Toronto'});
async function rest(table,fields,query=''){
 const response=await fetch(SUPABASE_URL+'/rest/v1/'+table+'?select='+fields+query,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY},cache:'no-store'});
 if(!response.ok)throw Error('Données temporairement indisponibles.');return response.json();
}
async function identities(){
 const results=await Promise.allSettled([fetch('data/player-identity-map.json').then(r=>r.json()),fetch('data/nhl-player-directory.json').then(r=>r.json())]);
 const registry=results[0].status==='fulfilled'?results[0].value.players||{}:{},directory=results[1].status==='fulfilled'?results[1].value.players||{}:{};
 const records=new Map();
 for(const [id,p] of Object.entries(directory)){const key=norm(p.name);if(!records.has(key))records.set(key,[]);records.get(key).push({id:Number(id),name:p.name,position:p.position,team:p.team});}
 for(const [key,matches]of records)if(matches.length===1)people.set(key,matches[0]);
 for(const p of Object.values(registry))if(p.status==='confirmed'&&p.nhlId){
  const item={id:Number(p.nhlId),name:p.nhlName||p.fantraxName,position:p.position,team:p.nhlTeam};
  for(const name of [p.fantraxName,p.nhlName,...p.aliases||[]])if(name)people.set(norm(name),item);
 }
}
function playerButton(name){return name?'<button type="button" class="leader-player" data-player="'+esc(name)+'">'+esc(name)+'</button>':'Non désigné';}
function leaderCard(t,row,[field,letter,label]){
 const name=row?.[field],person=people.get(norm(name)),meta=[person?.position,person?.team].filter(Boolean).join(' · ');
 const photo=person&&/^[A-Z]{2,3}$/.test(person.team||'')?'<img class="leader-photo" data-nhl-id="'+person.id+'" data-nhl-team="'+person.team+'" src="https://assets.nhle.com/mugs/nhl/20262027/'+person.team+'/'+person.id+'.png" alt="Portrait de '+esc(name)+'" loading="lazy">':'';
 const initials=name?name.split(/\s+/).map(x=>x[0]).slice(0,2).join(''):'—';
 return '<article class="leader-card '+(!name?'vacant':'')+'"><div class="portrait-stage"><img class="club-watermark" src="logos/'+esc(club(t.team_id)[1])+'" alt=""><span class="role-medallion">'+letter+'</span><div class="portrait-circle"><span class="portrait-placeholder"'+(photo?' hidden':'')+'>'+esc(initials)+'</span>'+photo+'</div></div><div class="leader-info"><span class="leader-role">'+label+'</span><h3>'+playerButton(name)+'</h3><span class="leader-meta">'+(meta?esc(meta):name?'Leadership BHL':'En attente de nomination')+'</span></div></article>';
}
function render(){
 const captains=current.filter(r=>r.captain).length,assistants=current.reduce((n,r)=>n+slots.slice(1).filter(([key])=>r[key]).length,0);
 $('metrics').innerHTML=[[teams.length,'organisations'],[captains,'capitaines désignés'],[assistants,'assistants désignés']].map(([n,label])=>'<div class="metric"><strong>'+n+'</strong><span>'+label+'</span></div>').join('');
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 if(view==='history'){renderHistory();return;}
 let count=0;
 const groups=teams.filter(t=>teamMatch(t.team_id)).map(t=>{
  const row=current.find(r=>r.team_id===t.team_id);
  const shown=slots.filter(([field])=>roleMatch(field)&&nameMatch(row?.[field]));count+=shown.length;
  if(!shown.length)return '';
  return '<section class="team-section" style="'+colors(t.team_id)+'"><header class="team-heading">'+teamLogo(t.team_id)+'<div><h2>'+esc(teamName(t.team_id))+'</h2><a href="bhl-equipes-connectees.html?team='+encodeURIComponent(t.team_id)+'">Voir l’organisation →</a></div></header><div class="leader-grid">'+shown.map(slot=>leaderCard(t,row,slot)).join('')+'</div></section>';
 });
 $('leadership-content').innerHTML=count?groups.join(''):'<p class="empty">Aucun joueur ne correspond à ces filtres.</p>';
 for(const image of document.querySelectorAll('.leader-photo'))image.onerror=()=>{
  if(!image.dataset.retried){image.dataset.retried='true';image.src='https://assets.nhle.com/mugs/nhl/20252026/'+image.dataset.nhlTeam+'/'+image.dataset.nhlId+'.png';}
  else{image.hidden=true;image.previousElementSibling.hidden=false;}
 };
}
function changes(){
 return events.flatMap(event=>(event.changes||[]).map((change,index)=>({...change,teamId:event.team_id,date:event.changed_at,id:event.history_id,index})))
 .filter(c=>teamMatch(c.teamId)&&roleMatch(c.role)&&nameMatch(c.before,c.after))
 .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.id-a.id||a.index-b.index);
}
function renderHistory(){
 const rows=changes();
 $('leadership-content').innerHTML='<h2 class="history-title">Historique des changements</h2><p class="history-note">'+(historyFailed?'L’historique est temporairement indisponible. Réessaie avec « Actualiser ».':rows.length+' nomination'+(rows.length>1?'s':'')+' ou changement'+(rows.length>1?'s':'')+' enregistré'+(rows.length>1?'s':'')+' · Du plus récent au plus ancien')+'</p>'+
 (rows.length?'<div class="history-list">'+rows.map(c=>{
  const label=slots.find(s=>s[0]===c.role)?.[2]||c.role;
  return '<article class="history-entry" style="'+colors(c.teamId)+'"><time class="history-date" datetime="'+esc(c.date)+'">'+esc(date(c.date))+'</time><div><div class="history-team">'+teamLogo(c.teamId)+esc(teamName(c.teamId))+'</div><span class="history-role">'+esc(label)+(c.before?' · Changement':' · Nomination')+'</span><div class="history-transition"><span class="former">'+(c.before?playerButton(c.before):'Poste vacant')+'</span><span class="arrow" aria-label="remplacé par">→</span><strong>'+ (c.after?playerButton(c.after):'Poste vacant')+'</strong></div></div></article>';
 }).join('')+'</div>':'<p class="empty">'+(historyFailed?'Impossible de charger l’historique.':events.length?'Aucun changement ne correspond à ces filtres.':'Aucun changement enregistré pour le moment.')+'</p>');
}
async function load(){
 if(busy)return;busy=true;$('refresh').disabled=true;
 try{
  const results=await Promise.allSettled([
   rest('bhl_teams','team_id,team_name','&order=team_name'),
   rest('bhl_team_leadership','team_id,captain,assistant_1,assistant_2,assistant_3,updated_at'),
   (async()=>{const rows=[];for(let offset=0;;offset+=1000){const page=await rest('bhl_public_leadership_history','history_id,team_id,changed_at,changes','&order=changed_at.desc,history_id.desc&limit=1000&offset='+offset);rows.push(...page);if(page.length<1000)return rows;}})()
  ]);
  if(results[0].status==='rejected'||results[1].status==='rejected')throw Error('Impossible de charger le leadership.');
  const nextTeams=results[0].value,nextCurrent=results[1].value;historyFailed=results[2].status==='rejected';
  const nextEvents=historyFailed?events:results[2].value;
  const nextSignature=JSON.stringify([nextTeams,nextCurrent,nextEvents,historyFailed]);
  teams=nextTeams;current=nextCurrent;events=nextEvents;
  if(!loaded){const selected=$('team-filter').value;$('team-filter').innerHTML='<option value="">Toutes les organisations</option>'+teams.map(t=>'<option value="'+esc(t.team_id)+'">'+esc(teamName(t.team_id))+'</option>').join('');$('team-filter').value=selected;}
  if(signature!==nextSignature){signature=nextSignature;render();}
  loaded=true;$('status').textContent='Actualisation automatique · Vérifié à '+new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit',timeZone:'America/Toronto'})+(historyFailed?' · Historique temporairement indisponible':'');
 }catch(error){$('status').textContent=error.message+(loaded?' Les dernières données reçues restent affichées.':' Réessaie avec « Actualiser ».');if(!loaded)$('leadership-content').innerHTML='<p class="empty">Le leadership est temporairement indisponible.</p>';}
 finally{busy=false;$('refresh').disabled=false;}
}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{view=button.dataset.view;render();history.replaceState(null,'','#'+view);});
$('team-filter').onchange=render;$('role-filter').onchange=render;$('player-filter').oninput=render;$('refresh').onclick=load;
$('leadership-content').onclick=event=>{const button=event.target.closest('[data-player]');if(!button)return;const name=button.dataset.player,person=people.get(norm(name));if(window.BHLPlayerStats)window.BHLPlayerStats.open(null,name,button);};
if(location.hash==='#history')view='history';
await identities();await load();
setInterval(()=>{if(!document.hidden)load();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
