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
let bhlExtendedDirectoryRequest;
function bhlExtendedDirectory(){
 return bhlExtendedDirectoryRequest||(bhlExtendedDirectoryRequest=fetch('data/nhl-player-directory.json',{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('Répertoire LNH élargi non publié');return r.json()})
  .catch(()=>({players:{}})));
}
async function bhlExtendedDirectoryId(name,expectedTeam){
 const data=await bhlExtendedDirectory();
 const candidates=Object.entries(data.players||{}).filter(([id,p])=>
  norm(p.name)===norm(name)&&(!expectedTeam||String(p.team||'').toUpperCase()===expectedTeam));
 return candidates.length===1?Number(candidates[0][0]):null;
}
const bhlNhlLookupCache=new Map();
async function bhlLookupOfficialId(player,id){
 const directory=await bhlIdentityDirectory().catch(()=>({players:{}}));
 const entry=directory.players?.[String(id||'')];
 if(entry?.status==='confirmed'&&Number(entry.nhlId))return Number(entry.nhlId);
 const name=String(player.name||entry?.fantraxName||'').trim();
 if(!name)return null;
 const cacheKey=String(id||name);
 if(!bhlNhlLookupCache.has(cacheKey)){
  bhlNhlLookupCache.set(cacheKey,(async()=>{
   const expected=nhlAbbrev(entry?.nhlTeam||player.nhlTeam).toUpperCase();
   const indexed=await bhlExtendedDirectoryId(name,expected);
   if(indexed)return indexed;
   const url='https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q='+encodeURIComponent(name);
   const results=await nhlJson(url);
   const rows=Array.isArray(results)?results:(results?.data||[]);
   const candidates=rows.filter(row=>{
    const label=row.name||row.fullName||row.playerName||[row.firstName,row.lastName].filter(Boolean).join(' ');
    return norm(label)===norm(name)&&Number(row.playerId||row.id)>0;
   });
   const unique=[...new Map(candidates.map(row=>[Number(row.playerId||row.id),row])).values()];
   if(unique.length!==1)return null;
   const nhlId=Number(unique[0].playerId||unique[0].id);
   const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing');
   const full=[profile.firstName?.default,profile.lastName?.default].filter(Boolean).join(' ');
   if(norm(full)!==norm(name))return null;
   const actual=String(profile.currentTeamAbbrev||'').toUpperCase();
   if(expected&&actual&&expected!==actual)return null;
   return nhlId;
  })().catch(error=>{bhlNhlLookupCache.delete(cacheKey);throw error}));
 }
 return bhlNhlLookupCache.get(cacheKey);
}
async function bhlCurrentOfficialStats(player,id){
 const nhlId=await bhlLookupOfficialId(player,id);
 if(!nhlId)return null;
 const goalie=!!player.goalie;
 const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing');
 const season='20262027';
 const result=await historicalFantasy(nhlId,season,goalie,true,'');
 const totals=(profile.seasonTotals||[]).filter(x=>String(x.season)===season&&String(x.leagueAbbrev).toUpperCase()==='NHL'&&Number(x.gameTypeId)===2);
 const gp=totals.reduce((sum,x)=>sum+Number(x.gamesPlayed||0),0);
 if(result.fpts===null||!gp)return null;
 return {stats:{...result.v,GP:gp,FPts:Math.round(result.fpts*100)/100,'FP/G':Math.round(result.fpts/gp*100)/100},nhlTeam:String(profile.currentTeamAbbrev||player.nhlTeam||''),goalie};
}
const bhlUsageCache=new Map();
async function bhlSeasonUsage(nhlId,season,team,goalie=false,gamesPlayed=null){
 if(goalie)return {TOI:'N/D',TOIPP:'N/D',TOIPK:'N/D'};
 const key=[nhlId,season,team,gamesPlayed].join(':');
 if(!bhlUsageCache.has(key)){
  bhlUsageCache.set(key,(async()=>{
   const [toi,pp,pk]=await Promise.all([
    nhlSeasonReport('skater','timeonice',nhlId,season,team).catch(()=>null),
    nhlSeasonReport('skater','powerplay',nhlId,season,team).catch(()=>null),
    nhlSeasonReport('skater','penaltykill',nhlId,season,team).catch(()=>null)
   ]);
   const gp=Number(gamesPlayed)||Number(historicalNumber(toi,['gamesPlayed','games'])||0);
   const average=(report,fields)=>{
    const total=historicalNumber(report,fields);
    return gp>0&&total!==null?bhlTimeString(total/gp):'N/D';
   };
   return {TOI:average(toi,['timeOnIce','totalTimeOnIce']),
    TOIPP:average(pp,['ppTimeOnIce','timeOnIce']),
    TOIPK:average(pk,['shTimeOnIce','timeOnIce'])};
  })().catch(()=>({TOI:'N/D',TOIPP:'N/D',TOIPK:'N/D'})));
 }
 return bhlUsageCache.get(key);
}
function table(player,data){
 const s=player.stats;
 const cols=player.goalie?[['NHL','Équipe LNH'],['GP','PJ'],['W','V'],['GA','BA'],['SV','ARR'],['SHO','BL'],['G','B'],['A','A']]:[['NHL','Équipe LNH'],['GP','PJ'],['G','B'],['A','A'],['PTS','PTS'],['SOG','TIRS'],['Hit','HITS'],['Blk','BLOCS'],['Tk','TK'],['FOW','MÀJ']];
 cols.push(['TOIPP','PPTOI'],['TOIPK','PKTOI'],['TOI','TOI']);
 const values={...s,NHL:nhlAbbrev(player.nhlTeam),PTS:s.G==null||s.A==null?null:s.G+s.A};
 return '<div class="bhl-player-meta">'+'Équipe LNH : '+esc(nhlAbbrev(player.nhlTeam))+'</div><div class="bhl-player-totals"><div><span>FPTS</span><strong>'+fmt(s.FPts)+'</strong></div><div><span>FP/G</span><strong>'+fmt(s['FP/G'])+'</strong></div></div><h4>Statistiques — '+esc(data.period)+'</h4><div class="bhl-player-scroll"><table class="bhl-player-table"><thead><tr>'+cols.map(([key,label])=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody><tr>'+cols.map(([key])=>'<td>'+(key==='NHL'?esc(values[key]||'—'):key==='TOI'||key==='TOIPP'||key==='TOIPK'?esc(values[key]||'N/D'):fmt(values[key]))+'</td>').join('')+'</tr></tbody></table></div><p class="bhl-player-source">Source : export Fantrax du '+esc(data.exportDate)+'. Ces statistiques sont un instantané et ne sont pas actualisées automatiquement.</p><p class="bhl-player-legend">'+(player.goalie?'V : victoires · BA : buts accordés · ARR : arrêts · BL : blanchissages · B : buts · A : passes.':'B : buts · A : passes · PTS : buts + passes · TK : takeaways · MÀJ : mises au jeu gagnées.')+'</p>';
}
async function bhlPlayerForOfficial(id,name){
 const key=String(id||'').replaceAll('*','');
 const [details,directory]=await Promise.all([
  load().catch(()=>({players:{}})),
  bhlIdentityDirectory().catch(()=>({players:{}}))
 ]);
 const fromDetails=details.players?.[key]||Object.values(details.players||{}).find(p=>norm(p.name)===norm(name));
 if(fromDetails)return {player:fromDetails,id:key};
 const entry=directory.players?.[key]||Object.entries(directory.players||{}).find(([_,p])=>norm(p.fantraxName)===norm(name))?.[1];
 if(!entry)return null;
 const resolvedId=key||Object.keys(directory.players||{}).find(k=>directory.players[k]===entry);
 return {player:{name:entry.fantraxName||name,nhlTeam:entry.nhlTeam||'',goalie:entry.position==='G',stats:{}},id:resolvedId};
}
async function fill(target,id,name){
 target.innerHTML='<p role="status">Chargement des statistiques officielles LNH…</p>';
 try{
  const resolved=await bhlPlayerForOfficial(id,name);
  if(!target.isConnected)return;
  if(!resolved){
   target.innerHTML='<p>Statistiques LNH indisponibles : identité du joueur non trouvée dans les alignements BHL.</p>';
   return;
  }
  const official=await bhlCurrentOfficialStats(resolved.player,resolved.id);
  if(!target.isConnected)return;
  if(!official){
   target.innerHTML='<p>FPTS et FP/G LNH en attente : identité LNH non confirmée, statistiques incomplètes ou saison sans match. Aucun ancien total Fantrax ne sera présenté comme un calcul BHL.</p>';
   return;
  }
  target.innerHTML=table(official,{period:'Saison régulière 2026-27'});
  if(!official.goalie){
   const nhlId=await bhlLookupOfficialId(resolved.player,resolved.id);
   const usage=await bhlSeasonUsage(nhlId,'20262027','',false,official.stats.GP);
   if(target.isConnected){const cells=target.querySelectorAll('.bhl-player-table tbody tr td');
    ['TOIPP','TOIPK','TOI'].forEach((key,i)=>{if(cells[cells.length-3+i])cells[cells.length-3+i].textContent=usage[key]});}
  }
  const source=target.querySelector('.bhl-player-source');
  if(source)source.textContent='Source : statistiques officielles LNH, FPTS et FP/G calculés selon le barème BHL. Actualisation à chaque ouverture de la fiche.';
 }catch(error){
  console.warn('Calcul officiel LNH indisponible',error);
  if(target.isConnected)target.innerHTML='<p>Statistiques officielles LNH temporairement indisponibles. Aucun ancien total Fantrax affiché.</p>';
 }
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
 // NHL landing team names can be localized (e.g. "Montréal Canadiens").
 // Resolve explicit abbreviations first, then accent-insensitive full names.
 const candidates=[season.teamAbbrev,season.teamAbbrev?.default,season.teamName?.default,
  season.teamName?.fr,season.teamName,season.teamCommonName?.default,
  season.teamCommonName?.fr,season.teamCommonName,season.teamPlaceName?.default,
  season.teamPlaceName?.fr];
 for(const candidate of candidates){
  if(typeof candidate!=='string')continue;
  const value=candidate.trim(),upper=value.toUpperCase();
  if(/^[A-Z]{2,3}$/.test(upper))return upper;
  const canonical=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const mapped=nhlTeamCodes[value.toLowerCase()]||nhlTeamCodes[canonical];
  if(mapped)return mapped;
  // Match the official Montreal franchise regardless of accent or locale.
  if(canonical==='montreal canadiens'||canonical==='canadiens de montreal')return 'MTL';
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
     const excluded=/pct|percentage|average|pergame|per60|rate|ratio|plusminus|^(playerId|seasonId|gameTypeId|teamId|gameId|gameDate)$/i;
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
function bhlNhlIdentityKey(value){
 let name=String(value||'').normalize('NFKC');
 name=name.replace(/&#(?:0*39|x0*27);|&apos;/gi,"'").replace(/&(?:amp;)?#(?:0*39|x0*27);/gi,"'");
 name=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return name.replace(/[^a-z0-9]/g,'');
}
const BHL_NHL_IDS_COMPACT=Object.fromEntries(Object.entries(BHL_NHL_IDS).map(([name,id])=>[bhlNhlIdentityKey(name),id]));
function bhlResolvedNhlId(name){
 const key=bhlNhlIdentityKey(name);
 const shared=window.BHLNhlPlayerIds||{};
 const known=BHL_NHL_IDS_COMPACT[key]||Object.entries(shared).find(([n])=>bhlNhlIdentityKey(n)===key)?.[1];
 if(known)return Number(known);
 // Common Fantrax display forms: surname, first name; punctuation/HTML entities are ignored.
 if(key==='oreillyryan'||key==='ryanoreilly')return 8475158;
 if(key==='millerkandre'||key==='kandremiller')return 8480817;
 return 0;
}
async function historicNhl(name,target,fantraxId){
 target.textContent='Chargement de toutes les saisons LNH en carrière…';
 try{
  const directory=await bhlIdentityDirectory();
  const entry=directory.players?.[String(fantraxId||'')];
  const id=Number(entry?.status==='confirmed'?entry.nhlId:0);
  if(!Number.isInteger(id)||id<=0){
   target.textContent='Identité LNH non confirmée pour ce joueur. Historique indisponible pour éviter une confusion entre homonymes.';
   return;
  }
  const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+id+'/landing');
  if(!target.isConnected)return;
  const goalie=String(profile.position||profile.positionCode||'').toUpperCase()==='G';
  const center=String(profile.position||profile.positionCode||'').toUpperCase()==='C';
  const seasons=(profile.seasonTotals||[]).filter(x=>String(x.leagueAbbrev).toUpperCase()==='NHL'&&Number(x.gameTypeId)===2).sort((a,b)=>Number(b.season)-Number(a.season));
  if(!seasons.length){target.textContent='Aucune saison régulière LNH trouvée pour ce joueur.';return}
  const columns=(goalie?['Saison','Équipe','FP/G','FPTS','PJ','V','BA','ARR','BL','B','A','PTS']:['Saison','Équipe','FP/G','FPTS','PJ','B','A','PTS','TIRS','HITS','BLOCS','TK','MÀJ']).concat(['PPTOI','PKTOI','TOI']);
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
   values.push('…','…','…');
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
     const usage=await bhlSeasonUsage(id,String(season.season),teamCode,goalie,gp);
     if(row.isConnected)['TOIPP','TOIPK','TOI'].forEach((key,j)=>{row.cells[row.cells.length-3+j].textContent=usage[key]});
    }catch(e){if(row.isConnected){row.cells[2].textContent='N/D';row.cells[3].textContent='N/D';row.title=e.message;row.cells[3].title=e.message;row.cells[3].style.cursor='help';const detail=document.createElement('small');detail.style.display='block';detail.style.fontSize='10px';detail.style.fontWeight='normal';detail.textContent='ⓘ';detail.title=e.message;row.cells[3].append(detail);if(!target.querySelector('.bhl-historical-error')){const error=document.createElement('p');error.className='bhl-historical-error';error.style.fontSize='12px';error.style.color='#9b1c1c';error.textContent='Diagnostic LNH : '+e.message;target.append(error)}}}
   }
  }
  await Promise.all(Array.from({length:Math.min(3,seasons.length)},worker));
 }catch(e){if(target.isConnected)target.textContent='Impossible de charger les statistiques historiques : '+e.message}
}
function tradeHistory(name,target){
 target.textContent='Chargement des transactions BHL…';
 if(!window.BHLTrades?.load){target.textContent='Historique des transactions non disponible sur cette page.';return}
 const historicalLogos={
  'cleveland barons':'cleveland-barons.png','winnipeg jets':'winnipeg-jets.png',
  'detroit cougars':'detroit-cougars.png','vegas golden knights':'vegas-golden-knights.png',
  'montreal maroons':'montreal-maroons.png','edmonton oilers':'edmonton-oilers.png'
 };
 const teamLogo=team=>{
  const key=norm(team);
  if(historicalLogos[key])return historicalLogos[key];
  const row=(window.BHLTrades.teams||[]).find(t=>norm(t[1])===key);
  return row?.[2]||'';
 };
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
 const org=(name)=>{
  const wrap=el('span','bhl-trade-org');
  const logo=teamLogo(name);
  if(logo){const img=el('img','bhl-trade-logo');img.src='logos/'+logo;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();wrap.append(img)}
  wrap.append(el('span','',name||'Équipe inconnue'));return wrap;
 };
 window.BHLTrades.load().then(trades=>{
  if(!target.isConnected)return;
  const key=norm(name),events=[];
  for(const t of trades){for(const m of t.moves||[]){if(m.position&&norm(m.asset)===key)events.push({t,m})}}
  events.sort((a,b)=>String(b.t.date||'').localeCompare(String(a.t.date||''))||Number(b.t.id)-Number(a.t.id));
  const unique=new Set(events.map(e=>String(e.t.id)));
  const displayed=new Set();
  target.replaceChildren();
  const container=el('div','bhl-trade-history');
  const heading=el('div','bhl-trade-summary');
  const count=el('strong','bhl-trade-count',String(unique.size));
  heading.append(count,el('span','','Échange'+(unique.size>1?'s':'')+' dans l’historique BHL'));
  container.append(heading);
  if(!events.length){container.append(el('p','bhl-trade-empty','Aucun échange enregistré pour ce joueur.'));target.append(container);return}
  const list=el('div','bhl-trade-timeline');
  for(const {t,m} of events){
   if(displayed.has(String(t.id)))continue;
   displayed.add(String(t.id));
   const card=el('article','bhl-trade-entry');
   const head=el('div','bhl-trade-entry-head');
   const date=el('span','bhl-trade-date',t.dateText||t.date||'Date inconnue');
   const id=el('span','bhl-trade-id','ÉCHANGE Nº '+t.id);
   head.append(date,id);
   if(t.season)head.append(el('span','bhl-trade-season',t.season));
   const route=el('div','bhl-trade-route');
   const from=el('div','bhl-trade-end');from.append(el('small','','DE'),org(m.from));
   const arrow=el('span','bhl-trade-arrow','→');arrow.setAttribute('aria-label','vers');
   const to=el('div','bhl-trade-end');to.append(el('small','','VERS'),org(m.to));
   route.append(from,arrow,to);
   card.append(head,route);
   const allMoves=t.moves||[];
   if(allMoves.length){
    const detail=el('div','bhl-trade-full');
    detail.append(el('div','bhl-trade-full-title','TRANSACTION COMPLÈTE'));
    const groups=new Map();
    for(const move of allMoves){
     const direction=(move.from||'Équipe inconnue')+' → '+(move.to||'Équipe inconnue');
     if(!groups.has(direction))groups.set(direction,{from:move.from,to:move.to,assets:[]});
     if(move.asset&&!groups.get(direction).assets.includes(move.asset))groups.get(direction).assets.push(move.asset);
    }
    for(const group of groups.values()){
     const line=el('div','bhl-trade-full-group');
     const teamLine=el('div','bhl-trade-full-teams');
     teamLine.append(el('strong','',group.from||'Équipe inconnue'),el('span','',' → '),el('strong','',group.to||'Équipe inconnue'));
     line.append(teamLine,el('div','bhl-trade-full-assets',group.assets.join(' · ')||'Détails non disponibles'));
     detail.append(line);
    }
    card.append(detail);
   }
   list.append(card);
  }
  container.append(list);target.append(container);
 }).catch(()=>{if(target.isConnected)target.textContent='Transactions temporairement indisponibles.'});
}

const BHL_TROPHY_API='https://script.google.com/macros/s/AKfycbyhz6nFb1gR_JiNF6VLl_8q-nUjo7OkbB9hNqSzZVdc4n_hZhUKQ3aTu3YqGTJCrjARiQ/exec';
const BHL_TROPHY_LOGOS={'COUPE BELIVEAU':'coupe-beliveau.png','SCOTTY BOWMAN':'scotty-bowman.png','SAM POLLOCK':'sam-pollock.png','YVAN COURNOYER':'yvan-cournoyer.png','SERGE SAVARD':'serge-savard.png','ANDREI MARKOV':'andrei-markov.png','SAKU KOIVU':'saku-koivu.png','CLAUDE LEMIEUX':'claude-lemieux.png','HOWIE MORENZ':'howie-morenz.png','PATRICK ROY':'patrick-roy.png','GUY LAFLEUR':'guy-lafleur.png','CAREY PRICE':'carey-price.png','DOUG HARVEY':'doug-harvey.png','EMILE BUTCH BOUCHARD':'emile-butch-bouchard.png','GEORGE VEZINA':'george-vezina.png','GUY CARBONNEAU':'guy-carbonneau.png','HENRI RICHARD':'henri-richard.png','JACQUES DEMERS':'jacques-demers.png','JACQUES PLANTE':'jacques-plante.png','JOHNNY GAUDREAU':'johnny-gaudreau.png','JOSE THEODORE':'jose-theodore.png','KEN DRYDEN':'ken-dryden.png','LARRY ROBINSON':'larry-robinson.png','MAURICE RICHARD':'maurice-richard.png','STEPHANE RICHER':'stephane-richer.png','YANIC PERREAULT':'yanic-perreault.png'};
let bhlHonoursPromise=null;
function bhlTrophyNorm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function bhlTrophyNameKey(value){return bhlTrophyNorm(value).replace(/\s+/g,'')}
function bhlTrophyRows(){
 if(bhlHonoursPromise)return bhlHonoursPromise;
 bhlHonoursPromise=new Promise((resolve,reject)=>{
  const callback='bhlHonours_'+Math.random().toString(36).slice(2),script=document.createElement('script');
  const timer=setTimeout(()=>finish(Error('Délai de connexion dépassé')),20000);
  function finish(error,data){clearTimeout(timer);delete window[callback];script.remove();error?reject(error):resolve(data)}
  window[callback]=data=>{
   const rows=data?.data?.rows;
   if(!data?.ok||!Array.isArray(rows))return finish(Error(data?.error||'Réponse TROPHYLIST invalide'));
   finish(null,rows);
  };
  script.onerror=()=>finish(Error('Connexion aux trophées impossible'));
  script.src=BHL_TROPHY_API+'?sheet=TROPHYLIST&callback='+callback;
  document.head.appendChild(script);
 }).catch(error=>{bhlHonoursPromise=null;throw error});
 return bhlHonoursPromise;
}
function bhlTrophyRecords(rows){
 const records=[];
 for(const row of rows.slice(1)){
  if(!Array.isArray(row))continue;
  const cells=row.map(v=>String(v??'').trim());
  let trophy=cells[4]||cells[2]||cells[3]||'';
  let season=cells[5]||cells[3]||cells[4]||'';
  const team=cells[8]||cells[6]||'';
  const person=cells[9]||cells[7]||'';
  if(!/^\d{4}\s*[-–]\s*\d{2,4}$/.test(season)){
   const match=cells.find(v=>/^\d{4}\s*[-–]\s*\d{2,4}$/.test(v));
   if(match)season=match;
  }
  const finalist=cells.some(v=>bhlTrophyNorm(v).startsWith('FINALISTE'));
  if(finalist||!trophy||!person||!season||!team)continue;
  // Only individual player honours. Team championships, medals and GM honours
  // are not attributed automatically to every player on a roster.
  const key=bhlTrophyNorm(trophy);
  if(/^(FINALE BHL|COUPE BELIVEAU|COUPE BHL|COUPE DU MONDE|CONFRONTATION 4 NATIONS|JEUX OLYMPIQUES|CHAMPIONNAT MONDIAL JUNIOR|OR |ARGENT |BRONZE )/.test(key))continue;
  records.push({trophy,season,team,person});
 }
 return records;
}
let bhlCupPromise=null;
function bhlCupRows(){
 if(bhlCupPromise)return bhlCupPromise;
 bhlCupPromise=new Promise((resolve,reject)=>{
  const callback='bhlCup_'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');let finished=false;
  const timer=setTimeout(()=>done(new Error('Délai dépassé')),16000);
  function done(err,rows){if(finished)return;finished=true;clearTimeout(timer);delete window[callback];script.remove();err?reject(err):resolve(rows)}
  window[callback]=result=>{
   if(!result?.ok||!Array.isArray(result?.data?.rows))return done(new Error(result?.error||'Source BELIVEAUCUPNAMES non autorisée'));
   done(null,result.data.rows);
  };
  script.onerror=()=>done(new Error('Source BELIVEAUCUPNAMES inaccessible'));
  script.src=BHL_TROPHY_API+'?sheet=BELIVEAUCUPNAMES&callback='+callback;
  document.head.append(script);
 }).catch(error=>{bhlCupPromise=null;throw error});
 return bhlCupPromise;
}
function bhlCupWinners(rows,name){
 const key=bhlTrophyNameKey(name),seen=new Set(),result=[];
 for(const row of rows.slice(1)){
  if(!Array.isArray(row))continue;
  const [season,team,player,role]=row.map(value=>String(value??'').trim());
  if(!season||!team||bhlTrophyNameKey(player)!==key||/^(DG|DIRECTEUR GENERAL)$/.test(bhlTrophyNorm(role)))continue;
  const id=bhlTrophyNameKey(season)+'|'+bhlTrophyNameKey(team);
  if(seen.has(id))continue;seen.add(id);result.push({season,team});
 }
 return result.sort((a,b)=>b.season.localeCompare(a.season));
}
function bhlShowCupWinners(target,winners){
 const heading=document.createElement('div');heading.className='bhl-honours-intro';
 const title=document.createElement('div');title.className='bhl-honours-heading';title.textContent='Championnats · Coupe Béliveau';
 const count=document.createElement('div');count.className='bhl-honours-count';count.textContent=winners.length+' titre'+(winners.length!==1?'s':'');
 heading.append(title,count);target.append(heading);
 if(!winners.length){const empty=document.createElement('p');empty.className='bhl-honours-empty';empty.textContent='Aucune Coupe Béliveau répertoriée pour ce joueur.';target.append(empty);return}
 const grid=document.createElement('div');grid.className='bhl-honours-grid';
 for(const win of winners){
  const card=document.createElement('article');card.className='bhl-honour-card';
  const art=document.createElement('div');art.className='bhl-honour-art';
  const img=document.createElement('img');img.src='trophies/coupe-beliveau.png';img.alt='Coupe Béliveau';img.loading='lazy';img.onerror=()=>{img.remove();art.textContent='🏆'};art.append(img);
  const info=document.createElement('div');info.className='bhl-honour-info';
  const year=document.createElement('span');year.className='bhl-honour-season';year.textContent=win.season;
  const trophy=document.createElement('strong');trophy.textContent='Champion de la Coupe Béliveau';
  const team=document.createElement('small');team.textContent=win.team;
  info.append(year,trophy,team);card.append(art,info);grid.append(card);
 }
 target.append(grid);
}

let bhlWeeklyHonoursRequest;
function bhlWeeklyHonours(){
 return bhlWeeklyHonoursRequest||(bhlWeeklyHonoursRequest=fetch('data/bhl-weekly-stars.json',{cache:'no-store'})
  .then(response=>{if(!response.ok)throw Error('Palmarès hebdomadaire indisponible');return response.json()})
  .catch(error=>{bhlWeeklyHonoursRequest=null;throw error}));
}
async function bhlShowWeeklyHonours(name,fantraxId,target){
 const section=document.createElement('section');
 section.className='bhl-weekly-player-honours';
 target.append(section);
 try{
  const data=await bhlWeeklyHonours();
  if(!section.isConnected)return;
  const matches=(data.periods||[]).filter(period=>period.complete).flatMap(period=>
   (period.players||[]).filter(player=>fantraxId
    ?String(player.id)===String(fantraxId)
    :bhlTrophyNameKey(player.name)===bhlTrophyNameKey(name))
    .map(player=>({period,player}))
  ).sort((a,b)=>Number(b.period.period)-Number(a.period.period));
  const intro=document.createElement('div');intro.className='bhl-honours-intro';
  const title=document.createElement('div');title.className='bhl-honours-heading';title.textContent='Joueurs de la semaine';
  const count=document.createElement('div');count.className='bhl-honours-count';
  count.textContent=matches.length+' sélection'+(matches.length!==1?'s':'');
  intro.append(title,count);section.append(intro);
  if(!matches.length){
   const empty=document.createElement('p');empty.className='bhl-honours-empty';
   empty.textContent='Aucune sélection parmi les périodes complétées cette saison.';
   section.append(empty);return;
  }
  const grid=document.createElement('div');grid.className='bhl-honours-grid';
  for(const {period,player} of matches){
   const card=document.createElement('article');card.className='bhl-honour-card';
   const art=document.createElement('div');art.className='bhl-honour-art';
   art.textContent='⭐';
   const info=document.createElement('div');info.className='bhl-honour-info';
   const date=document.createElement('span');date.className='bhl-honour-season';
   date.textContent='Période '+period.period+' · '+period.start+' au '+period.end;
   const label=document.createElement('strong');label.textContent='Joueur de la semaine · '+player.slot;
   const team=document.createElement('small');team.textContent=player.team+' · '+Number(player.fpts).toLocaleString('fr-CA')+' FPTS · '+Number(player.fpg).toLocaleString('fr-CA')+' FP/G';
   info.append(date,label,team);card.append(art,info);grid.append(card);
  }
  section.append(grid);
  const source=document.createElement('p');source.className='bhl-honours-source';
  const link=document.createElement('a');link.href='bhl-fantrax.html#honours';link.textContent='Voir les joueurs de la semaine ↗';
  source.append(link);section.append(source);
 }catch(error){
  if(section.isConnected)section.textContent='Sélections hebdomadaires temporairement indisponibles.';
 }
}

async function playerHonours(name,target,fantraxId){
 const traditional=document.createElement('div');
 const weekly=document.createElement('div');
 target.replaceChildren(traditional,weekly);
 bhlShowWeeklyHonours(name,fantraxId,weekly);
 target=traditional;
 target.textContent='Recherche des honneurs dans le palmarès BHL…';
 try{
  const [trophyData,cupData]=await Promise.allSettled([bhlTrophyRows(),bhlCupRows()]);
  if(!target.isConnected)return;
  if(trophyData.status==='rejected'&&cupData.status==='rejected')throw Error('Les sources TROPHYLIST et BELIVEAUCUPNAMES sont indisponibles');
  const rows=trophyData.status==='fulfilled'?trophyData.value:[];
  target.replaceChildren();
  if(cupData.status==='fulfilled')bhlShowCupWinners(target,bhlCupWinners(cupData.value,name));
  else {const note=document.createElement('p');note.className='bhl-honours-empty';note.textContent='Championnats non disponibles : BELIVEAUCUPNAMES doit être autorisé dans Apps Script.';target.append(note)}
  const key=bhlTrophyNameKey(name);
  const matches=bhlTrophyRecords(rows).filter(r=>bhlTrophyNameKey(r.person)===key);
  const unique=[...new Map(matches.map(r=>[[bhlTrophyNameKey(r.trophy),r.season,r.team].join('|'),r])).values()]
   .sort((a,b)=>String(b.season).localeCompare(String(a.season)));
  const intro=document.createElement('div');intro.className='bhl-honours-intro';
  const title=document.createElement('div');title.className='bhl-honours-heading';title.textContent='Palmarès individuel';
  const summary=document.createElement('div');summary.className='bhl-honours-count';summary.textContent=unique.length+' honneur'+(unique.length>1?'s':'')+' BHL';
  intro.append(title,summary);target.append(intro);
  if(!unique.length){
   const empty=document.createElement('p');empty.className='bhl-honours-empty';
   empty.textContent='Aucun trophée individuel remporté trouvé dans TROPHYLIST pour ce joueur.';
   target.append(empty);return;
  }
  const grid=document.createElement('div');grid.className='bhl-honours-grid';
  for(const r of unique){
   const card=document.createElement('article');card.className='bhl-honour-card';
   const art=document.createElement('div');art.className='bhl-honour-art';
   const file=BHL_TROPHY_LOGOS[bhlTrophyNorm(r.trophy)];
   if(file){const img=document.createElement('img');img.src='trophies/'+file;img.alt='';img.loading='lazy';img.onerror=()=>{img.remove();art.textContent='🏆'};art.append(img)}
   else art.textContent='🏆';
   const info=document.createElement('div');info.className='bhl-honour-info';
   const season=document.createElement('span');season.className='bhl-honour-season';season.textContent=r.season;
   const trophy=document.createElement('strong');trophy.textContent=r.trophy;
   const team=document.createElement('small');team.textContent=r.team;
   info.append(season,trophy,team);card.append(art,info);grid.append(card);
  }
  target.append(grid);
  const source=document.createElement('p');source.className='bhl-honours-source';
  const link=document.createElement('a');link.href='bhl-trophees.html';link.textContent='Consulter le palmarès officiel BHL ↗';
  source.append('Source : TROPHYLIST · Gagnants individuels seulement · ',link);target.append(source);
 }catch(error){if(target.isConnected)target.textContent='Honneurs temporairement indisponibles : '+error.message}
}

let bhlAdvancedRequest;
function bhlAdvancedDirectory(){
 return bhlAdvancedRequest||(bhlAdvancedRequest=fetch('data/nhl-advanced-stats.json',{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('Statistiques avancées non publiées');return r.json()})
  .catch(error=>{bhlAdvancedRequest=null;throw error}));
}
async function bhlAdvancedPlayer(name,target,fantraxId){
 target.innerHTML='<p>Chargement des statistiques avancées LNH…</p>';
 try{
  const [resolved,directory]=await Promise.all([bhlPlayerForOfficial(fantraxId,name),bhlAdvancedDirectory()]);
  if(!target.isConnected)return;
  if(!resolved){target.textContent='Identité LNH indisponible.';return}
  const id=await bhlLookupOfficialId(resolved.player,resolved.id);
  if(!target.isConnected)return;
  if(!id){target.textContent='Identité LNH non confirmée.';return}
  const labels=directory.metrics||{FPTS:'FPTS',PTS:'PTS',G:'B',A:'A',SOG:'TIRS',HIT:'HITS',BLK:'BLOCS',TK:'TK'};
  const seasonLabels={current:'Saison en cours · 2026-2027',last3:'Trois dernières saisons · 2024-2027'};
  const shell=document.createElement('div');
  shell.innerHTML='<div class="bhl-advanced-controls"><label>Période<select data-advanced-period><option value="current">Saison en cours (2026-2027)</option><option value="last3">3 dernières saisons (2024-2027)</option></select></label><label>Affichage<select data-advanced-mode><option value="per60">Total par 60</option><option value="total">Total</option></select></label></div><div data-advanced-content></div>';
  target.replaceChildren(shell);
  const periodSelect=shell.querySelector('[data-advanced-period]');
  const modeSelect=shell.querySelector('[data-advanced-mode]');
  const content=shell.querySelector('[data-advanced-content]');
  function draw(){
   const period=periodSelect.value,mode=modeSelect.value;
   const dataset=directory.datasets?.[period];
   if(!dataset){
    content.innerHTML='<p>Les nouvelles données multi-saisons sont en attente de synchronisation. Relancez le workflow Statistiques avancées LNH.</p>';
    return;
   }
   const player=dataset.players?.[String(id)];
   if(!player){content.innerHTML='<p>Ce joueur n’a pas disputé de match LNH dans la période sélectionnée, ou son temps de jeu n’est pas disponible.</p>';return}
   const metrics=Object.entries(labels);
   const html=metrics.map(([key,label])=>{
    const value=mode==='per60'?player.rates?.[key]:player.totals?.[key];
    const pct=player.percentiles?.[mode]?.[key];
    const formatted=value==null?'N/D':Number(value).toLocaleString('fr-CA',{minimumFractionDigits:mode==='per60'?2:0,maximumFractionDigits:2});
    const percentile=pct==null?'N/D':Math.round(pct)+'e';
    const bar=pct==null?0:Math.max(0,Math.min(100,Number(pct)));
    return '<div class="bhl-advanced-stat"><div class="bhl-advanced-stat-head"><strong>'+esc(label)+(mode==='per60'?'/60':'')+'</strong><b>'+esc(formatted)+'</b><span>'+esc(percentile)+' percentile</span></div>'+
      '<div class="bhl-advanced-track"><div style="width:'+bar+'%"></div></div></div>';
   }).join('');
   content.innerHTML='<div class="bhl-advanced-intro"><h4>'+esc(seasonLabels[period])+' · '+(mode==='per60'?'Production par 60 minutes':'Totaux cumulés')+'</h4><p>'+esc(dataset.population)+' patineurs LNH ayant disputé au moins 1 match dans la période sélectionnée · '+esc(player.gp)+' matchs pour ce joueur. Les percentiles sont recalculés pour ce filtre.</p></div>'+
    (dataset.fptsProvisional?'<p class="bhl-player-source" style="color:#9b1c1c"><strong>FPTS provisoires :</strong> des mises au jeu gagnées sont manquantes dans les rapports LNH et comptées à zéro. Les FPTS et leurs percentiles peuvent être sous-estimés.</p>':'')+
    '<div class="bhl-advanced-grid">'+html+'</div>'+
    '<p class="bhl-player-source">Source : statistiques officielles LNH · Saison régulière · '+(mode==='per60'?'Statistiques cumulées ÷ temps de glace cumulé × 60.':'Totaux cumulés de la période.')+' Population : joueurs ayant au moins 1 match et du temps de glace connu.</p>';
  }
  periodSelect.addEventListener('change',draw);
  modeSelect.addEventListener('change',draw);
  draw();
 }catch(error){
  if(target.isConnected)target.textContent='Statistiques avancées temporairement indisponibles.';
 }
}
function addSections(dialog,name,fantraxId){
 const stats=dialog.querySelector('.bhl-player-stats');if(!stats)return;
 const tabs=document.createElement('div');tabs.className='bhl-unified-tabs';
 const panel=document.createElement('div');panel.className='bhl-unified-panel';
 stats.before(tabs);stats.after(panel);
 const items=[['stats','Statistiques'],['advanced','Stats avancées'],['nhl','Historique LNH'],['trades','Transactions BHL'],['ownership','Appartenance BHL'],['honours','Honneurs']];
 let active='stats'; const rendered=new Map();
 const select=id=>{
  active=id;stats.hidden=id!=='stats';panel.hidden=id==='stats';
  for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-selected',String(b.dataset.tab===id));
  if(id!=='stats'){if(!rendered.has(id)){const section=document.createElement('section');rendered.set(id,section);panel.append(section);if(id==='nhl')historicNhl(name,section,fantraxId);else if(id==='advanced')bhlAdvancedPlayer(name,section,fantraxId);else if(id==='ownership')import('./bhl-ownership.js?v=1').then(m=>m.renderOwnership(name,section,fantraxId)).catch(()=>{section.textContent='Historique d’appartenance temporairement indisponible.';});else if(id==='honours')playerHonours(name,section,fantraxId);else tradeHistory(name,section)}for(const [key,section] of rendered)section.hidden=key!==id;}
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
  if(player?.position&&pos?.isConnected)pos.textContent='Position LNH : '+player.position;
   try{
    const response=await fetch('data/fantrax.json',{cache:'no-store'});
    if(response.ok){
     const live=await response.json();
     const rosterPlayers=(live.teams||[]).flatMap(team=>team.players||[]);
     const rosterPlayer=id
      ?rosterPlayers.find(p=>String(p.id)===String(id))
      :rosterPlayers.filter(p=>norm(p.name)===norm(name)).length===1
       ?rosterPlayers.find(p=>norm(p.name)===norm(name)):null;
     if(rosterPlayer&&pos?.isConnected&&dialog.isConnected){
      const eligible=Array.isArray(rosterPlayer.eligiblePositions)&&rosterPlayer.eligiblePositions.length
       ?rosterPlayer.eligiblePositions.join(', '):rosterPlayer.position;
      if(eligible)pos.textContent='Position Fantrax : '+eligible;
     }
    }
   }catch(error){console.warn('Position Fantrax indisponible',error)}
 }catch(e){}
 try{
  const directory=await bhlIdentityDirectory();
  const entry=directory.players?.[String(id||'')];
  const nhlId=Number(entry?.status==='confirmed'?entry.nhlId:0);
  if(!nhlId)return;
  const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing');
  if(!dialog.isConnected)return;
  const position=profile.position||profile.positionCode;
  if(position&&!pos.textContent.trim())pos.textContent='Position LNH : '+position;
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
const BHL_PROFILE_TEAMS={
 'anaheim mighty ducks':['#532A44','anaheim-mightyducks.png'],'atlanta thrashers':['#5c88da','atlanta-thrashers.png'],'boston bruins':['#ffb81c','boston-bruins.png'],'cleveland barons':['#b5a36a','cleveland-barons.png'],'california golden seals':['#007f00','california-goldenseals.png'],'chicago blackhawks':['#cf0a2c','chicago-blackhawks.png'],'colorado avalanche':['#6f263d','colorado-avalanche.png'],'detroit red wings':['#ce1126','detroit-redwings.png'],'florida panthers':['#c8102e','florida-panthers.png'],'hartford whalers':['#046A38','hartford-whalers.png'],'minnesota north stars':['#009639','minnesota-northstars.png'],'montreal canadiens':['#af1e2d','montreal-canadiens.png'],'nashville predators':['#ffb81c','nashville-predators.png'],'new york rangers':['#0038a8','newyork-rangers.png'],'ottawa senators':['#DA1A32','ottawa-senators.png'],'edmonton oilers':['#ff4c00','edmonton-oilers.png'],'quebec nordiques':['#005eb8','quebec-nordiques.png'],'toronto maple leafs':['#00205b','toronto-mapleleafs.png'],'vegas golden knights':['#B4975A','vegas-golden-knights.png'],'winnipeg jets':['#041e42','winnipeg-jets.png']};
const bhlTeamKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
let bhlRosterLookupRequest;
function bhlRosterLookup(){
 return bhlRosterLookupRequest||(bhlRosterLookupRequest=fetch('data/fantrax.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Alignements BHL indisponibles');return r.json()}).then(data=>{
  const byId=new Map(),byName=new Map(),ambiguous=new Set();
  for(const team of data.teams||[])for(const player of team.players||[]){
   const id=String(player.id||'');
   if(id)byId.set(id,team.name);
   const key=norm(player.name);
   if(key){
    if(byName.has(key))ambiguous.add(key);
    else byName.set(key,team.name);
   }
  }
  for(const key of ambiguous)byName.delete(key);
  return {byId,byName};
 }).catch(error=>{bhlRosterLookupRequest=null;throw error}));
}
function bhlApplyTeamIdentity(dialog,team){
 const profile=BHL_PROFILE_TEAMS[bhlTeamKey(team)];
 if(!profile||!dialog.isConnected)return false;
 const identity=dialog.querySelector('.bhl-player-team-identity');
 const img=identity?.querySelector('img');
 if(!identity||!img)return false;
 img.src='logos/'+profile[1];
 img.onerror=()=>{img.hidden=true};
 img.hidden=false;
 identity.querySelector('span').textContent=team;
 identity.hidden=false;
 dialog.style.setProperty('--profile-accent',profile[0]);
 return true;
}
function bhlResolvePlayerId(id,name,source){
 if(id)return String(id);
 if(norm(name)!=='eliaspettersson')return id;
 const team=bhlTeamKey(source?.dataset?.bhlTeam||source?.closest?.('[data-bhl-team],[data-team-name]')?.dataset?.bhlTeam||source?.closest?.('[data-team-name]')?.dataset?.teamName||document.querySelector('.teamchip.active')?.title||'');
 if(team==='quebec nordiques')return '048x9';
 if(team==='montreal canadiens')return '060v8';
 return id;
}
function bhlSpecificNhlId(id,name){
 if(norm(name)==='eliaspettersson'&&String(id)==='048x9')return 8480012;
 return 0;
}
let bhlIdentityDirectoryRequest;
function bhlIdentityDirectory(){
 return bhlIdentityDirectoryRequest||(bhlIdentityDirectoryRequest=fetch('data/player-identity-map.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Répertoire indisponible');return r.json()}).catch(e=>{bhlIdentityDirectoryRequest=null;throw e}));
}
const BHL_NHL_ID_BY_FANTRAX={'03rgk':8478851,'048x9':8480012,'060v8':8483678};
const BHL_NHL_NAME_ALIASES={'alexcarrier':'Alexandre Carrier'};
function bhlOfficialNhlId(id,name){
 // An explicit Fantrax ID must never inherit an unrelated same-name NHL ID.
 if(id)return BHL_NHL_ID_BY_FANTRAX[String(id)]||0;
 return 0;
}
function bhlOfficialNhlName(name){return BHL_NHL_NAME_ALIASES[norm(name)]||name}
function bhlTimeString(value){
 if(value===null||value===undefined||value==='')return 'N/D';
 if(typeof value==='string'&&/^\d+:\d\d$/.test(value))return value;
 const seconds=Number(value);
 if(!Number.isFinite(seconds)||seconds<0)return 'N/D';
 const whole=Math.round(seconds);
 return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');
}
async function bhlCurrentNhlUsage(dialog,fantraxId){
 try{
  const directory=await bhlIdentityDirectory();
  const entry=directory.players?.[String(fantraxId||'')];
  if(entry?.status!=='confirmed'||!entry.nhlId)return;
  const season='20262027',nhlId=Number(entry.nhlId);
  const [toi,pp,pk]=await Promise.all([
   nhlSeasonReport('skater','timeonice',nhlId,season,'').catch(()=>null),
   nhlSeasonReport('skater','powerplay',nhlId,season,'').catch(()=>null),
   nhlSeasonReport('skater','penaltykill',nhlId,season,'').catch(()=>null)
  ]);
  if(!dialog.isConnected)return;
  const stats=dialog.querySelector('.bhl-player-stats');
  if(!stats)return;
  const box=document.createElement('div');
  box.className='bhl-player-totals';
  const fields=[
   ['TOI',historicalNumber(toi,['timeOnIce','totalTimeOnIce'])],
   ['TOIPP',historicalNumber(pp,['ppTimeOnIce','timeOnIce'])],
   ['TOIPK',historicalNumber(pk,['shTimeOnIce','timeOnIce'])]
  ];
  // NHL REST reports express these season totals in seconds.
  box.innerHTML=fields.map(([label,value])=>'<div><span>'+label+'</span><strong>'+bhlTimeString(value)+'</strong></div>').join('');
  const title=document.createElement('h4');title.textContent='Temps de jeu — saison 2026-2027';
  stats.append(title,box);
 }catch(error){console.warn('Temps de jeu LNH indisponible',error)}
}

async function bhlResolveUniqueDirectoryId(name,source){
 const directory=await bhlIdentityDirectory();
 const matches=Object.entries(directory.players||{}).filter(([,entry])=>norm(entry.fantraxName)===norm(name)||Array.isArray(entry.aliases)&&entry.aliases.some(alias=>norm(alias)===norm(name)));
 if(matches.length===1)return matches[0][0];
 const team=bhlTeamKey(source?.dataset?.bhlTeam||source?.closest?.('[data-bhl-team],[data-team-name]')?.dataset?.bhlTeam||source?.closest?.('[data-team-name]')?.dataset?.teamName||'');
 if(team){
  const matching=matches.filter(([,entry])=>bhlTeamKey(entry.bhlTeam)===team);
  if(matching.length===1)return matching[0][0];
 }
 return null;
}
function openUnresolvedPlayer(name,source){
 // Preserve access to historical players, but do not guess a Fantrax ID.
 const previous=document.querySelector('.bhl-player-dialog');
 if(previous)previous.close();
 const dialog=document.createElement('dialog');
 dialog.className='bhl-player-dialog';
 dialog.innerHTML='<button class="bhl-player-close" type="button" aria-label="Fermer">×</button><div class="bhl-player-hero"><div class="bhl-player-hero-copy"><p>IDENTITÉ À CONFIRMER</p><h3></h3><p>Plusieurs joueurs peuvent porter ce nom, ou ce joueur ne figure pas encore dans le répertoire. Aucune identité LNH ou BHL n’a été attribuée automatiquement.</p></div></div>';
 dialog.querySelector('h3').textContent=name;
 dialog.querySelector('button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);dialog.showModal();
}
function open(id,name,source){
 id=bhlResolvePlayerId(id,name,source);
 if(!id){
  bhlResolveUniqueDirectoryId(name,source).then(resolved=>{
   if(resolved)open(resolved,name,source);
   else openUnresolvedPlayer(name,source);
  }).catch(()=>openUnresolvedPlayer(name,source));
  return;
 }
 const previous=document.querySelector('.bhl-player-dialog');if(previous)previous.close();
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='bhl-player-dialog';dialog.setAttribute('aria-label','Fiche de '+name);
 dialog.innerHTML='<button class="bhl-player-close" type="button" aria-label="Fermer la fiche">×</button><div class="bhl-player-hero" data-bhl-nhl-name="'+esc(name)+'"><div class="bhl-player-photo"><img class="bhl-nhl-photo" hidden alt=""></div><div class="bhl-player-hero-copy"><p>FICHE DU JOUEUR</p><h3>'+esc(name)+'</h3><div class="bhl-player-position"></div><div class="bhl-player-size"></div><div class="bhl-player-birth"></div><div class="bhl-player-team-identity" hidden><img class="bhl-player-bhl-logo" alt="Logo de l’équipe BHL"><span class="bhl-player-team-label"></span></div><a class="bhl-nhl-link" hidden target="_blank" rel="noopener noreferrer">Profil NHL ↗</a></div></div><section class="bhl-player-stats"></section>';
 document.body.append(dialog);dialog.showModal();
 // Show the BHL team's identity only when the originating roster/team is known.
 const origin=source?.closest?.('[data-team-name],[data-bhl-team],.bhl-lineup-card,.bhl-roster-card');
 const activeChip=document.querySelector('.teamchip.active');
 const logo=origin?.querySelector?.('.teamlogo')||activeChip?.querySelector?.('.teamlogo');
 const identity=dialog.querySelector('.bhl-player-team-identity');
 const selectedTeam=source?.dataset?.bhlTeam||origin?.dataset?.teamName||origin?.dataset?.bhlTeam||activeChip?.title||activeChip?.getAttribute('aria-label')||'';
 const rootColor=getComputedStyle(document.documentElement).getPropertyValue('--team-color').trim();
 const localColor=origin?getComputedStyle(origin).getPropertyValue('--team-color').trim():'';
 const mappedColor=selectedTeam&&typeof window.teamColor==='function'?window.teamColor(selectedTeam):'';
 const teamProfile=BHL_PROFILE_TEAMS[bhlTeamKey(selectedTeam)];
 const color=teamProfile?.[0]||localColor||mappedColor||rootColor;
 if(/^#[0-9a-f]{3,8}$/i.test(color)||/^rgb\(/i.test(color))dialog.style.setProperty('--profile-accent',color);
 const knownNhlId=bhlOfficialNhlId(id,name);
 if(knownNhlId){
  const official=dialog.querySelector('.bhl-nhl-link');
  official.href='https://www.nhl.com/player/'+knownNhlId;
  official.hidden=false;
 }
 populatePlayerBio(dialog,id,name);
 // Current Fantrax roster is authoritative across Teams, Draft and Transactions.
 // Historical/source identity is a fallback only for unrostered players.
 bhlIdentityDirectory().then(directory=>{
  if(!dialog.isConnected)return;
  const entry=directory.players?.[String(id||'')];
  if(entry?.bhlTeam)bhlApplyTeamIdentity(dialog,entry.bhlTeam);
  // Only manually reviewed mappings may override the NHL identity.
  if(entry?.nhlId&&entry.status==='confirmed'){
   const nhlId=Number(entry.nhlId);
   const link=dialog.querySelector('.bhl-nhl-link');
   if(link){link.href='https://www.nhl.com/player/'+nhlId;link.hidden=false}
   nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing').then(profile=>{
    if(!dialog.isConnected)return;
    const img=dialog.querySelector('.bhl-nhl-photo');
    if(img&&profile.headshot){img.src=profile.headshot;img.hidden=false}
   }).catch(()=>{});
  }
 }).catch(error=>console.warn('Répertoire joueurs indisponible',error));
 bhlRosterLookup().then(rosters=>{
  if(!dialog.isConnected)return;
  const current=(id&&rosters.byId.get(String(id)))||(!id&&rosters.byName.get(norm(name)));
  if(current)bhlApplyTeamIdentity(dialog,current);
  else if(selectedTeam)bhlApplyTeamIdentity(dialog,selectedTeam);
 }).catch(error=>console.warn('Identité BHL indisponible',error));
 if(logo?.getAttribute('src')||teamProfile?.[1]){
  const image=identity.querySelector('img');image.src=teamProfile?.[1]?'logos/'+teamProfile[1]:logo.getAttribute('src');
  image.onerror=()=>{identity.hidden=true};
  const teamName=selectedTeam||activeChip?.textContent?.trim()||'Équipe BHL';
  identity.querySelector('span').textContent=teamName;
  identity.hidden=false;
 }
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus()},{once:true});
 fill(dialog.querySelector('.bhl-player-stats'),id,name);
 addSections(dialog,name,id);
 // Time-on-ice now appears in the existing statistics table.
 if(bhlOfficialNhlId(id,name)){
  const nhlId=bhlOfficialNhlId(id,name);
  nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing').then(profile=>{
   if(!dialog.isConnected)return;
   const img=dialog.querySelector('.bhl-nhl-photo');
   if(img&&profile.headshot){img.src=profile.headshot;img.hidden=false}
   const link=dialog.querySelector('.bhl-nhl-link');if(link){link.href='https://www.nhl.com/player/'+nhlId;link.hidden=false}
  }).catch(()=>{});
 }
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
window.BHLPlayerStats={open,table,officialStats:async(id,name)=>{
 const resolved=await bhlPlayerForOfficial(id,name);
 if(!resolved)return null;
 const result=await bhlCurrentOfficialStats(resolved.player,resolved.id);
 return result?{fpts:result.stats.FPts,fpg:result.stats['FP/G'],gp:result.stats.GP,nhlTeam:result.nhlTeam}:null;
},officialIdentity:async(id,name)=>{
 const resolved=await bhlPlayerForOfficial(id,name);
 if(!resolved)return null;
 const nhlId=await bhlLookupOfficialId(resolved.player,resolved.id);
 if(!nhlId)return null;
 const profile=await nhlJson('https://api-web.nhle.com/v1/player/'+nhlId+'/landing');
 return {nhlId,headshot:profile.headshot||'',nhlTeam:profile.currentTeamAbbrev||''};
}};
})();
