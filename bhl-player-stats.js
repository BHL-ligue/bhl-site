/* Player statistics from administrator-provided Fantrax exports. */
(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const nhlAbbrev=v=>{
 const raw=String(v||'').trim(),up=raw.toUpperCase();
 if(/^[A-Z]{2,3}$/.test(up))return up;
 const codes={'MONTREAL CANADIENS':'MTL','MONTRÉAL CANADIENS':'MTL','BOSTON BRUINS':'BOS','COLUMBUS BLUE JACKETS':'CBJ','COLORADO AVALANCHE':'COL','PITTSBURGH PENGUINS':'PIT','WASHINGTON CAPITALS':'WSH','TORONTO MAPLE LEAFS':'TOR','OTTAWA SENATORS':'OTT','NEW YORK RANGERS':'NYR','NEW YORK ISLANDERS':'NYI','NEW JERSEY DEVILS':'NJD','LOS ANGELES KINGS':'LAK','SAN JOSE SHARKS':'SJS','TAMPA BAY LIGHTNING':'TBL','VEGAS GOLDEN KNIGHTS':'VGK','ST. LOUIS BLUES':'STL','ST LOUIS BLUES':'STL','WINNIPEG JETS':'WPG','CHICAGO BLACKHAWKS':'CHI','DETROIT RED WINGS':'DET','MINNESOTA WILD':'MIN','DALLAS STARS':'DAL','NASHVILLE PREDATORS':'NSH','EDMONTON OILERS':'EDM','CALGARY FLAMES':'CGY','VANCOUVER CANUCKS':'VAN','SEATTLE KRAKEN':'SEA','ANAHEIM DUCKS':'ANA','PHILADELPHIA FLYERS':'PHI','CAROLINA HURRICANES':'CAR','FLORIDA PANTHERS':'FLA','BUFFALO SABRES':'BUF','UTAH MAMMOTH':'UTA','ARIZONA COYOTES':'ARI'};
 return codes[up]||raw;
};
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('fr-CA',{maximumFractionDigits:2}):'—';
let request;
function load(){return request||(request=fetch('data/fantrax-player-details.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Statistiques indisponibles');return r.json()}).catch(e=>{request=null;throw e}))}
function table(player,data){
 const s=player.stats;
 const cols=player.goalie?[['NHL','Équipe LNH'],['GP','PJ'],['W','V'],['GA','BA'],['SV','ARR'],['SHO','BL'],['G','B'],['A','A']]:[['NHL','Équipe LNH'],['GP','PJ'],['G','B'],['A','A'],['PTS','PTS'],['SOG','TIRS'],['Hit','HITS'],['Blk','BLOCS'],['Tk','TK'],['FOW','MÀJ']];
 const values={...s,NHL:nhlAbbrev(player.nhlTeam),PTS:s.G==null||s.A==null?null:s.G+s.A};
 return '<div class="bhl-player-meta">'+'Équipe LNH : '+esc(nhlAbbrev(player.nhlTeam))+'</div><div class="bhl-player-totals"><div><span>FPTS</span><strong>'+fmt(s.FPts)+'</strong></div><div><span>FP/G</span><strong>'+fmt(s['FP/G'])+'</strong></div></div><h4>Statistiques — '+esc(data.period)+'</h4><div class="bhl-player-scroll"><table class="bhl-player-table"><thead><tr>'+cols.map(([key,label])=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody><tr>'+cols.map(([key])=>'<td>'+fmt(values[key])+'</td>').join('')+'</tr></tbody></table></div><p class="bhl-player-source">Source : export Fantrax du '+esc(data.exportDate)+'. Ces statistiques sont un instantané et ne sont pas actualisées automatiquement.</p><p class="bhl-player-legend">'+(player.goalie?'V : victoires · BA : buts accordés · ARR : arrêts · BL : blanchissages · B : buts · A : passes.':'B : buts · A : passes · PTS : buts + passes · TK : takeaways · MÀJ : mises au jeu gagnées.')+'</p>';
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

const historicalWeights={G:3,A:2.5,SOG:.3,Hit:.1,Blk:.2,Tk:.1,FOW:.05,W:4,GA:-1,SV:.2,SHO:4};
const historicalNumber=(obj,keys)=>{for(const key of keys){const n=obj?.[key];if(n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n)))return Number(n)}return null};
const nhlTeamCodes={
 'boston bruins':'BOS','colorado avalanche':'COL','columbus blue jackets':'CBJ','minnesota wild':'MIN',
 'san jose sharks':'SJS','new york rangers':'NYR','new york islanders':'NYI','new jersey devils':'NJD',
 'montreal canadiens':'MTL','toronto maple leafs':'TOR','ottawa senators':'OTT','buffalo sabres':'BUF',
 'detroit red wings':'DET','tampa bay lightning':'TBL','florida panthers':'FLA','carolina hurricanes':'CAR',
 'washington capitals':'WSH','pittsburgh penguins':'PIT','philadelphia flyers':'PHI','chicago blackhawks':'CHI',
 'st louis blues':'STL','st. louis blues':'STL','nashville predators':'NSH','dallas stars':'DAL',
 'winnipeg jets':'WPG','utah mammoth':'UTA','utah hockey club':'UTA','arizona coyotes':'ARI',
 'phoenix coyotes':'PHX','edmonton oilers':'EDM','calgary flames':'CGY','vancouver canucks':'VAN',
 'seattle kraken':'SEA','vegas golden knights':'VGK','los angeles kings':'LAK','anaheim ducks':'ANA',
 'atlanta thrashers':'ATL'
};
function nhlSeasonTeamCode(season){
 // The landing API often provides teamCommonName ("Bruins") alongside
 // teamName ("Boston Bruins"). Never prefer the short name over the full name.
 const candidates=[season.teamAbbrev,season.teamName?.default,season.teamName,
  season.teamCommonName?.default,season.teamCommonName,season.teamPlaceName?.default];
 for(const candidate of candidates){
  if(typeof candidate!=='string')continue;
  const value=candidate.trim(),upper=value.toUpperCase();
  if(/^[A-Z]{2,3}$/.test(upper))return upper;
  const mapped=nhlTeamCodes[value.toLowerCase()];
  if(mapped)return mapped;
 }
 return '';
}
const historicalReportCache=new Map();
async function nhlSeasonReport(type,report,id,season,team){
 const key=[type,report,id,season,team||''].join(':');
 if(!historicalReportCache.has(key)){
  historicalReportCache.set(key,(async()=>{
   const base='https://api.nhle.com/stats/rest/en/'+type+'/'+report+'?cayenneExp='+encodeURIComponent('playerId='+id+' and seasonId='+season+' and gameTypeId=2');
   const aliases={UTA:['UTA','ARI'],ARI:['ARI','PHX'],PHX:['PHX','ARI'],SJS:['SJS','SJ'],NJD:['NJD','NJ'],TBL:['TBL','TB'],LAK:['LAK','LA'],CBJ:['CBJ','CLB']};
   const accepted=team?(aliases[team]||[team]):null;
   const code=row=>String(row.teamAbbrevs||row.teamAbbrev||row.team||row.teamCode||'').trim().toUpperCase();
   let failures=[];
   // Try team-level totals before aggregate season totals. Do not use a
   // combined season row for a player traded during the season.
   for(const mode of ['&isAggregate=false&isGame=false','&isAggregate=true&isGame=false','&isAggregate=false&isGame=true']){
    try{
     const response=await nhlJson(base+mode+'&limit=200');
     const rows=Array.isArray(response.data)?response.data:[];
     if(!rows.length){failures.push(mode+': aucune ligne');continue}
     if(mode.includes('isGame=true')&&Number(response.total)>rows.length){failures.push('Rapport de matchs incomplet');continue}
     const selected=accepted?rows.filter(row=>accepted.includes(code(row))):rows;
     if(!selected.length){failures.push(mode+': équipes reçues '+[...new Set(rows.map(code))].join(','));continue}
     if(selected.length===1)return selected[0];
     const excluded=/pct|percentage|average|pergame|per60|rate|ratio|timeonice|plusminus|^(playerId|seasonId|gameTypeId|teamId|gameId|gameDate)$/i;
     const merged={};
     for(const row of selected)for(const [field,value] of Object.entries(row)){
      if(typeof value!=='number'||excluded.test(field))continue;
      merged[field]=(merged[field]||0)+value;
     }
     return merged;
    }catch(e){failures.push(mode+': '+e.message)}
   }
   throw Error(report+' '+season+' '+(team||'')+' : '+failures.join(' | '));
  })());
 }
 return historicalReportCache.get(key);
}
async function historicalFantasy(id,season,goalie,center,team){
 const stat=(obj,keys)=>historicalNumber(obj,keys);
 if(goalie){
  const d=await nhlSeasonReport('goalie','summary',id,season,team);
  const v={W:stat(d,['wins']),GA:stat(d,['goalsAgainst']),SV:stat(d,['saves']),SHO:stat(d,['shutouts']),G:stat(d,['goals']),A:stat(d,['assists'])};
  return {v,fpts:Object.values(v).some(x=>x===null)?null:Object.entries(v).reduce((sum,[k,n])=>sum+n*historicalWeights[k],0)};
 }
 // Each report is optional independently: a missing faceoff report must not
 // erase goals, shots, hits and other successfully retrieved categories.
 const [summary,realtime,faceoffs]=await Promise.all([
  nhlSeasonReport('skater','summary',id,season,team),
  nhlSeasonReport('skater','realtime',id,season,team).catch(()=>null),
  center?nhlSeasonReport('skater','faceoffwins',id,season,team).catch(()=>null):Promise.resolve(null)
 ]);
 const v={
  G:stat(summary,['goals']),
  A:stat(summary,['assists']),
  SOG:stat(summary,['shots','shotsOnGoal']),
  Hit:stat(realtime,['hits']),
  Blk:stat(realtime,['blockedShotAttempts','blockedShots']),
  Tk:stat(realtime,['takeaways']),
  FOW:center?stat(faceoffs,['faceoffWins','faceoffsWon','totalFaceoffWins','faceoffsWonTotal','totalFaceoffsWon'])??stat(summary,['faceoffWins','faceoffsWon']):0
 };
 const complete=Object.values(v).every(x=>x!==null);
 return {v,fpts:complete?Object.entries(v).reduce((sum,[k,n])=>sum+n*historicalWeights[k],0):null};
}
const BHL_NHL_IDS={'ryan nugent hopkins':8476454,'k andre miller':8480817,'jack hughes':8481559,'ryan o reilly':8475158};
function bhlResolvedNhlId(name){
 const key=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/&(?:#39|apos);/gi,"'").replace(/[\u2018\u2019\u02bc\u0060]/g,"'")
  .replace(/[^a-zA-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
 const known=BHL_NHL_IDS[key]||window.BHLNhlPlayerIds?.[key];
 if(known)return Number(known);
 // Restrict aliases to exact given-name/surname combinations; never match Hughes by surname alone.
 if(/^(?:ryan )?o reilly(?: ryan)?$/.test(key)||/^ryan o reilly(?: \d+)?$/.test(key))return 8475158;
 if(/^k andre miller(?: \d+)?$/.test(key))return 8480817;
 return 0;
}
async function historicNhl(name,target){
 target.textContent='Chargement de toutes les saisons LNH en carrière…';
 const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 try{
  const result=bhlResolvedNhlId(name)?[]:await nhlJson('https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q='+encodeURIComponent(name));
  const players=Array.isArray(result)?result:(result.data||[]);
  const match=players.find(p=>normalized(p.name||p.fullName||p.playerName)===normalized(name)||normalized(String(p.name||'').split(',').reverse().join(' '))===normalized(name));
  const id=Number(bhlResolvedNhlId(name)||match?.playerId||match?.id);
  if(!Number.isInteger(id)||id<=0)throw Error('Joueur non trouvé dans la base LNH');
  const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+id+'/landing');
  if(!target.isConnected)return;
  const goalie=String(profile.position||profile.positionCode||'').toUpperCase()==='G';
  const center=String(profile.position||profile.positionCode||'').toUpperCase()==='C';
  const seasons=(profile.seasonTotals||[]).filter(x=>String(x.leagueAbbrev).toUpperCase()==='NHL'&&Number(x.gameTypeId)===2).sort((a,b)=>Number(b.season)-Number(a.season));
  if(!seasons.length){target.textContent='Aucune saison régulière LNH trouvée pour ce joueur.';return}
  const columns=goalie?['Saison','Équipe','FP/G','FPTS','PJ','V','BA','ARR','BL','B','A','PTS']:['Saison','Équipe','FP/G','FPTS','PJ','B','A','PTS','TIRS','HITS','BLOCS','TK','MÀJ'];
  const keys=goalie?['W','GA','SV','SHO','G','A']:['G','A','SOG','Hit','Blk','Tk','FOW'];
  const wrap=document.createElement('div');wrap.className='bhl-player-scroll';
  const tableEl=document.createElement('table');tableEl.className='bhl-player-table';
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  for(const col of columns){const th=document.createElement('th');th.textContent=col;headRow.append(th)}head.append(headRow);tableEl.append(head);
  const body=document.createElement('tbody'),rows=[];
  for(const x of seasons){
   const season=String(x.season),row=document.createElement('tr');
   const team=nhlSeasonTeamCode(x)||'—';
   const basic=goalie?[x.wins,x.goalsAgainst,x.saves,x.shutouts,x.goals,x.assists]:[x.goals,x.assists,x.shots??x.shotsOnGoal,x.hits,x.blockedShots,x.takeaways,x.faceoffsWon];
   const values=[season.slice(0,4)+'-'+season.slice(6),team,'…','…',x.gamesPlayed,...basic.map(value=>value??'…')];
   values.splice(goalie?11:7,0,x.points??((x.goals!=null&&x.assists!=null)?Number(x.goals)+Number(x.assists):'…'));
   for(const value of values){const td=document.createElement('td');td.textContent=value??'—';row.append(td)}
   body.append(row);rows.push(row);
  }
  tableEl.append(body);wrap.append(tableEl);target.replaceChildren(wrap);
  const note=document.createElement('p');note.className='bhl-player-source';note.textContent='Source : LNH, toutes les saisons régulières en carrière. FP/G et FPTS sont recalculés par équipe selon le barème BHL (sans répéter les totaux de saison). N/D indique une statistique absente ou un calcul non vérifiable.';target.append(note);
  let cursor=0;
  async function worker(){
   while(cursor<seasons.length){
    const i=cursor++,row=rows[i],season=seasons[i],gp=Number(season.gamesPlayed);
    try{
     const displayTeam=typeof season.teamName==='object'?(season.teamName.default||''):String(season.teamName||'');
     const teamCode=nhlSeasonTeamCode(season)||nhlTeamCodes[displayTeam.trim().toLowerCase()]||'';
     if(!teamCode){throw Error('Code équipe absent : '+JSON.stringify({teamAbbrev:season.teamAbbrev,teamName:season.teamName}))}
     const {v,fpts}=await historicalFantasy(id,String(season.season),goalie,center,teamCode);
     if(!row.isConnected)continue;
     row.cells[2].textContent=fpts!==null&&gp>0?fmt(Math.round(fpts/gp*100)/100):'N/D';
     row.cells[3].textContent=fpts!==null?fmt(Math.round(fpts*100)/100):'N/D';
     keys.forEach((key,j)=>row.cells[5+j+(goalie?(j>=6?1:0):(j>=2?1:0))].textContent=v[key]===null?'N/D':fmt(v[key]));
     if(v.G!==null&&v.A!==null)row.cells[goalie?11:7].textContent=fmt(v.G+v.A);
    }catch(e){if(row.isConnected){row.cells[2].textContent='N/D';row.cells[3].textContent='N/D';row.title=e.message;row.cells[3].title=e.message;row.cells[3].style.cursor='help';const detail=document.createElement('small');detail.style.display='block';detail.style.fontSize='10px';detail.style.fontWeight='normal';detail.textContent='ⓘ';detail.title=e.message;row.cells[3].append(detail);if(!target.querySelector('.bhl-historical-error')){const error=document.createElement('p');error.className='bhl-historical-error';error.style.fontSize='12px';error.style.color='#9b1c1c';error.textContent='Diagnostic LNH : '+e.message;target.append(error)}}}
   }
  }
  await Promise.all(Array.from({length:Math.min(3,seasons.length)},worker));
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

function formatNhlHeight(inches){
 const n=Number(inches);if(!Number.isFinite(n)||n<40||n>90)return '';
 return Math.floor(n/12)+"'"+String(n%12).padStart(2,'0')+'″';
}
async function populatePlayerBio(dialog,id,name){
 const pos=dialog.querySelector('.bhl-player-position'),size=dialog.querySelector('.bhl-player-size'),birth=dialog.querySelector('.bhl-player-birth');
 try{
  const data=await load();
  const player=(id&&data.players[id])||Object.values(data.players).find(p=>norm(p.name)===norm(name));
  if(player?.position&&pos?.isConnected)pos.textContent='Position : '+player.position;
 }catch(e){}
 try{
  const query=bhlResolvedNhlId(name)?[]:await nhlJson('https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q='+encodeURIComponent(name));
  const players=Array.isArray(query)?query:(query.data||[]);
  const found=players.find(p=>norm(p.name||p.fullName||p.playerName)===norm(name)||norm(String(p.name||'').split(',').reverse().join(' '))===norm(name));
  const nhlId=Number(bhlResolvedNhlId(name)||found?.playerId||found?.id);if(!nhlId)return;
  const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing');
  if(!dialog.isConnected)return;
  const position=profile.position||profile.positionCode;
  if(position&&!pos.textContent.trim())pos.textContent='Position : '+position;
  const height=formatNhlHeight(profile.heightInInches);
  const weight=Number(profile.weightInPounds);
  const parts=[height,Number.isFinite(weight)&&weight>0?weight+' lb':''].filter(Boolean);
  if(parts.length)size.textContent=parts.join(' · ');
  const raw=String(profile.birthDate||'');
  if(birth&&/^\d{4}-\d{2}-\d{2}$/.test(raw)){
   const [y,m,d]=raw.split('-').map(Number),today=new Date();
   const age=today.getFullYear()-y-((today.getMonth()+1<m||(today.getMonth()+1===m&&today.getDate()<d))?1:0);
   const date=new Date(Date.UTC(y,m-1,d));
   birth.textContent=age+' ans · '+new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
  }
 }catch(e){}
}
function bhlPortraitById(dialog,name){
 const id=bhlResolvedNhlId(name);
 if(!id)return false;
 const img=dialog.querySelector('.bhl-player-hero .bhl-nhl-photo');
 if(!img)return false;
 const teamById={8476454:'EDM',8480817:'CAR',8481559:'NJD'};
 const team=teamById[id]||'NHL';
 const urls=[
  'https://assets.nhle.com/mugs/nhl/20262027/'+team+'/'+id+'.png',
  'https://assets.nhle.com/mugs/nhl/20252026/'+team+'/'+id+'.png',
  'https://assets.nhle.com/mugs/nhl/20252026/NHL/'+id+'.png',
  'https://assets.nhle.com/mugs/nhl/20242025/NHL/'+id+'.png'
 ];
 let index=0;
 img.alt='Portrait LNH de '+name;
 img.onload=()=>{if(dialog.isConnected){img.hidden=false;dialog.querySelector('.bhl-player-hero')?.classList.add('bhl-has-portrait')}};
 img.onerror=()=>{index++;if(index<urls.length)img.src=urls[index];else img.hidden=true};
 img.src=urls[0];
 const link=dialog.querySelector('.bhl-nhl-link');
 if(link){link.href='https://www.nhl.com/player/'+id;link.hidden=false}
 // Use the landing profile headshot as another verified source.
 nhlJson('https://api-web.nhle.com/v1/player/'+id+'/landing').then(profile=>{
  if(!dialog.isConnected||!profile?.headshot||!/^https:\/\//.test(profile.headshot))return;
  // Prefer the NHL's actual headshot, with the season URLs as fallbacks.
  urls.unshift(profile.headshot);
  index=0;img.src=urls[0];
 }).catch(()=>{});
 return true;
}
function open(id,name,source){
 const previous=document.querySelector('.bhl-player-dialog');if(previous)previous.close();
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='bhl-player-dialog';dialog.setAttribute('aria-label','Fiche de '+name);
 dialog.innerHTML='<button class="bhl-player-close" type="button" aria-label="Fermer la fiche">×</button><div class="bhl-player-hero" data-bhl-nhl-name="'+esc(name)+'"><div class="bhl-player-photo"><img class="bhl-nhl-photo" hidden alt=""></div><div class="bhl-player-hero-copy"><p>FICHE DU JOUEUR</p><h3>'+esc(name)+'</h3><div class="bhl-player-position"></div><div class="bhl-player-size"></div><div class="bhl-player-birth"></div><div class="bhl-player-team-identity" hidden><img class="bhl-player-bhl-logo" alt="Logo de l’équipe BHL"><span class="bhl-player-team-label"></span></div><a class="bhl-nhl-link" hidden target="_blank" rel="noopener noreferrer">Profil NHL ↗</a></div></div><section class="bhl-player-stats"></section>';
 document.body.append(dialog);dialog.showModal();
 // Show the BHL team's identity only when the originating roster/team is known.
 const origin=source?.closest?.('[data-team-name],[data-bhl-team],.bhl-lineup-card,.bhl-roster-card');
 const activeChip=document.querySelector('.teamchip.active');
 const logo=origin?.querySelector?.('.teamlogo')||activeChip?.querySelector?.('.teamlogo');
 const identity=dialog.querySelector('.bhl-player-team-identity');
 const selectedTeam=origin?.dataset?.teamName||origin?.dataset?.bhlTeam||activeChip?.title||activeChip?.getAttribute('aria-label')||'';
 const rootColor=getComputedStyle(document.documentElement).getPropertyValue('--team-color').trim();
 const localColor=origin?getComputedStyle(origin).getPropertyValue('--team-color').trim():'';
 const mappedColor=selectedTeam&&typeof window.teamColor==='function'?window.teamColor(selectedTeam):'';
 const color=localColor||mappedColor||rootColor;
 if(/^#[0-9a-f]{3,8}$/i.test(color)||/^rgb\(/i.test(color))dialog.style.setProperty('--profile-accent',color);
 const knownNhlId=bhlResolvedNhlId(name);
 if(knownNhlId){
  const official=dialog.querySelector('.bhl-nhl-link');
  official.href='https://www.nhl.com/player/'+knownNhlId;
  official.hidden=false;
 }
 populatePlayerBio(dialog,id,name);
 if(logo?.getAttribute('src')){
  const image=identity.querySelector('img');image.src=logo.getAttribute('src');
  image.onerror=()=>{identity.hidden=true};
  const teamName=origin?.dataset?.teamName||origin?.dataset?.bhlTeam||activeChip?.textContent?.trim()||'Équipe BHL';
  identity.querySelector('span').textContent=teamName;
  identity.hidden=false;
 }
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus()},{once:true});
 fill(dialog.querySelector('.bhl-player-stats'),id,name);
 addSections(dialog,name);
 if(!bhlPortraitById(dialog,name)&&typeof window.bhlNhlApplyPortraits==='function')window.bhlNhlApplyPortraits(dialog);
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-bhl-player-id]');
 if(!button)return;
 e.preventDefault();open(button.dataset.bhlPlayerId,button.dataset.bhlPlayerName||button.textContent.trim(),button);
});
// Compatibilité avec les anciennes fiches portrait utilisées dans les pages historiques.
if(typeof window.bhlPortraitModal==='function'){
 window.bhlPortraitModal=function(name){open(null,name)};
}
window.BHLPlayerStats={open,table};
})();