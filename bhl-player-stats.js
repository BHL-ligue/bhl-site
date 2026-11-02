/* Player statistics from administrator-provided Fantrax exports. */
(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('fr-CA',{maximumFractionDigits:2}):'—';
let request;
function load(){return request||(request=fetch('data/fantrax-player-details.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Statistiques indisponibles');return r.json()}).catch(e=>{request=null;throw e}))}
function table(player,data){
 const s=player.stats;
 const cols=player.goalie?[['GP','PJ'],['W','V'],['GA','BA'],['SV','ARR'],['SHO','BL'],['G','B'],['A','A']]:[['GP','PJ'],['G','B'],['A','A'],['PTS','PTS'],['SOG','TIRS'],['Hit','HITS'],['Blk','BLOCS'],['Tk','TK'],['FOW','MÀJ']];
 const values={...s,PTS:s.G==null||s.A==null?null:s.G+s.A};
 return '<div class="bhl-player-meta">'+esc(player.position)+' · '+esc(player.nhlTeam)+'</div><div class="bhl-player-totals"><div><span>FPTS</span><strong>'+fmt(s.FPts)+'</strong></div><div><span>FP/G</span><strong>'+fmt(s['FP/G'])+'</strong></div><div><span>Matchs joués</span><strong>'+fmt(s.GP)+'</strong></div></div><h4>Statistiques — '+esc(data.period)+'</h4><div class="bhl-player-scroll"><table class="bhl-player-table"><thead><tr>'+cols.map(([key,label])=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody><tr>'+cols.map(([key])=>'<td>'+fmt(values[key])+'</td>').join('')+'</tr></tbody></table></div><p class="bhl-player-source">Source : export Fantrax du '+esc(data.exportDate)+'. Ces statistiques sont un instantané et ne sont pas actualisées automatiquement.</p><p class="bhl-player-legend">'+(player.goalie?'V : victoires · BA : buts accordés · ARR : arrêts · BL : blanchissages · B : buts · A : passes.':'B : buts · A : passes · PTS : buts + passes · TK : takeaways · MÀJ : mises au jeu gagnées.')+'</p>';
}
async function fill(target,id,name){
 target.innerHTML='<p role="status">Chargement des statistiques…</p>';
 try{
 const data=await load();
 const matches=id?[data.players[id]].filter(Boolean):Object.values(data.players).filter(p=>norm(p.name)===norm(name));
 if(!target.isConnected)return;
 target.innerHTML=matches.length===1?table(matches[0],data):'<p>Statistiques non disponibles pour ce joueur dans l’export actuel.</p>';
 }catch(e){if(target.isConnected)target.innerHTML='<p>Statistiques temporairement indisponibles. Réessaie plus tard.</p>'}
}


async function nhlJson(url){
 const attempts=[url,'https://corsproxy.io/?'+encodeURIComponent(url),'https://proxy.cors.dev/'+url];
 for(const endpoint of attempts){
  try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
   try{const response=await fetch(endpoint,{signal:controller.signal});if(response.ok)return await response.json()}
   finally{clearTimeout(timer)}
  }catch(e){}
 }
 throw Error('Le service de statistiques LNH ne répond pas');
}
async function historicNhl(name,target){
 target.textContent='Chargement des saisons LNH depuis 2010-2011…';
 const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 try{
  const result=await nhlJson('https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q='+encodeURIComponent(name));
  const players=Array.isArray(result)?result:(result.data||[]);
  const match=players.find(p=>normalized(p.name||p.fullName||p.playerName)===normalized(name)||normalized(String(p.name||'').split(',').reverse().join(' '))===normalized(name));
  const id=Number(match?.playerId||match?.id);
  if(!Number.isInteger(id)||id<=0)throw Error('Joueur non trouvé dans la base LNH');
  const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+id+'/landing');
  if(!target.isConnected)return;
  const seasons=(profile.seasonTotals||[]).filter(x=>String(x.leagueAbbrev).toUpperCase()==='NHL'&&Number(x.gameTypeId)===2&&Number(x.season)>=20102011).sort((a,b)=>Number(b.season)-Number(a.season));
  if(!seasons.length){target.textContent='Aucune saison régulière LNH depuis 2010-2011.';return}
  const wrap=document.createElement('div');wrap.className='bhl-player-scroll';
  const tableEl=document.createElement('table');tableEl.className='bhl-player-table';
  const head=document.createElement('thead');head.innerHTML='<tr><th>Saison</th><th>Équipe</th><th>PJ</th><th>B</th><th>A</th><th>PTS</th><th>FPTS</th><th>FP/G</th></tr>';tableEl.append(head);
  const body=document.createElement('tbody');
  for(const x of seasons){
   const season=String(x.season),row=document.createElement('tr');
   const team=typeof x.teamName==='object'?(x.teamName.default||x.teamAbbrev):x.teamName||x.teamAbbrev||'—';
   const vals=[season.slice(0,4)+'-'+season.slice(6),team,x.gamesPlayed,x.goals,x.assists,x.points,'—','—'];
   for(const v of vals){const cell=document.createElement('td');cell.textContent=v??'—';row.append(cell)}
   body.append(row);
  }
  tableEl.append(body);wrap.append(tableEl);target.replaceChildren(wrap);
  const note=document.createElement('p');note.className='bhl-player-source';note.textContent='Source : LNH, saisons régulières depuis 2010-2011. Les FPTS et FP/G historiques restent indisponibles tant que les catégories Fantrax requises ne sont pas toutes validées.';target.append(note);
 }catch(e){if(target.isConnected)target.textContent='Impossible de charger les statistiques historiques : '+e.message}
}
function tradeHistory(name,target){
 target.textContent='Chargement des transactions BHL…';
 if(!window.BHLTrades?.load){target.textContent='Historique des transactions non disponible sur cette page.';return}
 window.BHLTrades.load().then(trades=>{
  if(!target.isConnected)return;
  const key=norm(name),events=[];
  for(const t of trades){for(const m of t.moves||[]){if(m.position&&norm(m.asset)===key)events.push({t,m})}}
  const unique=new Set(events.map(e=>String(e.t.id)));
  target.replaceChildren();
  const summary=document.createElement('p');summary.textContent=unique.size+' transaction(s) BHL enregistrée(s).';target.append(summary);
  if(!events.length)return;
  const list=document.createElement('ol');
  for(const e of events.sort((a,b)=>String(b.t.date||'').localeCompare(String(a.t.date||'')))){
   const li=document.createElement('li');li.textContent=(e.t.date||e.t.dateText||'Date inconnue')+' · Transaction nº '+e.t.id+' : '+e.m.from+' → '+e.m.to;list.append(li);
  }target.append(list);
 }).catch(()=>{if(target.isConnected)target.textContent='Transactions temporairement indisponibles.'});
}
function addSections(dialog,name){
 const stats=dialog.querySelector('.bhl-player-stats');if(!stats)return;
 const tabs=document.createElement('div');tabs.className='bhl-unified-tabs';
 const panel=document.createElement('div');panel.className='bhl-unified-panel';
 stats.before(tabs);stats.after(panel);
 const items=[['stats','Statistiques'],['nhl','Historique LNH'],['trades','Transactions BHL']];
 let active='stats'; const rendered=new Map();
 const select=id=>{
  active=id;stats.hidden=id!=='stats';panel.hidden=id==='stats';
  for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-selected',String(b.dataset.tab===id));
  if(id!=='stats'){if(!rendered.has(id)){const section=document.createElement('section');rendered.set(id,section);panel.append(section);if(id==='nhl')historicNhl(name,section);else tradeHistory(name,section)}for(const [key,section] of rendered)section.hidden=key!==id;}
 };
 for(const [id,label] of items){const b=document.createElement('button');b.type='button';b.dataset.tab=id;b.textContent=label;b.onclick=()=>select(id);tabs.append(b)}
 select(active);
}

function open(id,name){
 const previous=document.querySelector('.bhl-player-dialog');if(previous)previous.close();
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='bhl-player-dialog';dialog.setAttribute('aria-label','Fiche de '+name);
 dialog.innerHTML='<button class="bhl-player-close" type="button" aria-label="Fermer la fiche">×</button><div class="bhl-player-hero" data-bhl-nhl-name="'+esc(name)+'"><div class="bhl-player-photo"><img class="bhl-nhl-photo" hidden alt=""></div><div><p>FICHE DU JOUEUR</p><h3>'+esc(name)+'</h3><a class="bhl-nhl-link" hidden target="_blank" rel="noopener noreferrer">Profil NHL ↗</a></div></div><section class="bhl-player-stats"></section>';
 document.body.append(dialog);dialog.showModal();
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus()},{once:true});
 fill(dialog.querySelector('.bhl-player-stats'),id,name);
 addSections(dialog,name);
 if(typeof window.bhlNhlApplyPortraits==='function')window.bhlNhlApplyPortraits(dialog);
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-bhl-player-id]');
 if(!button)return;
 e.preventDefault();open(button.dataset.bhlPlayerId,button.dataset.bhlPlayerName||button.textContent.trim());
});
// Compatibilité avec les anciennes fiches portrait utilisées dans les pages historiques.
if(typeof window.bhlPortraitModal==='function'){
 window.bhlPortraitModal=function(name){open(null,name)};
}
window.BHLPlayerStats={open,table};
})();