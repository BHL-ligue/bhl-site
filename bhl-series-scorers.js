(()=>{
'use strict';
let playerIdentities={};
const photoCache=new Map();const photoQueue=[];let photoActive=0;function queuePhoto(task){photoQueue.push(task);runPhotoQueue()}function runPhotoQueue(){while(photoActive<5&&photoQueue.length){const task=photoQueue.shift();photoActive++;Promise.resolve().then(task).catch(()=>{}).finally(()=>{photoActive--;runPhotoQueue()})}}async function loadPortrait(avatar,id,name){
 if(!avatar.isConnected||!name||name==='Identité non résolue')return;
 const entry=playerIdentities[String(id)];
 let nhlId=entry?.status==='confirmed'?Number(entry.nhlId):0;
 if(!nhlId){try{const identity=await window.BHLPlayerStats?.officialIdentity?.(id,name);nhlId=Number(identity?.nhlId)||0}catch(e){}}
 if(!nhlId||!avatar.isConnected)return;
 // Same NHL seasonal portrait sources used by the BHL player profile.
 const team=String(entry?.nhlTeam||'NHL').toUpperCase();
 const sources=[
  'https://assets.nhle.com/mugs/nhl/20262027/'+team+'/'+nhlId+'.png',
  'https://assets.nhle.com/mugs/nhl/20252026/'+team+'/'+nhlId+'.png',
  'https://assets.nhle.com/mugs/nhl/20252026/NHL/'+nhlId+'.png',
  'https://assets.nhle.com/mugs/nhl/20242025/NHL/'+nhlId+'.png'
 ];
 const img=document.createElement('img');img.alt='';img.decoding='async';
 let index=0,done=false;
 img.onload=()=>{done=true;avatar.classList.add('has-photo')};
 img.onerror=()=>{index++;if(index<sources.length)img.src=sources[index];else if(!done){img.remove();avatar.classList.remove('has-photo')}};
 avatar.append(img);img.src=sources[0];
 // As on the player profile, the official NHL landing headshot takes priority.
 try{
  const response=await fetch('https://api-web.nhle.com/v1/player/'+nhlId+'/landing');
  if(response.ok){
   const profile=await response.json();
   if(profile.headshot&&/^https:\/\//.test(profile.headshot)&&avatar.isConnected){
    sources.unshift(profile.headshot);index=0;img.src=sources[0];
   }
  }
 }catch(e){}
}
const observePortrait=(avatar,id,name)=>{avatar.dataset.playerId=String(id);avatar.dataset.playerName=name;if(portraitObserver)portraitObserver.observe(avatar);else queuePhoto(()=>loadPortrait(avatar,id,name))};const portraitObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){portraitObserver.unobserve(entry.target);const el=entry.target;queuePhoto(()=>loadPortrait(el,el.dataset.playerId,el.dataset.playerName))}}},{rootMargin:'500px'}):null;

const LOGOS={
 'ANAHEIM MIGHTY DUCKS':'anaheim-mightyducks.png','ATLANTA THRASHERS':'atlanta-thrashers.png',
 'BOSTON BRUINS':'boston-bruins.png','CLEVELAND BARONS':'cleveland-barons.png',
 'CALIFORNIA GOLDEN SEALS':'california-goldenseals.png','CHICAGO BLACKHAWKS':'chicago-blackhawks.png',
 'COLORADO AVALANCHE':'colorado-avalanche.png','DETROIT RED WINGS':'detroit-redwings.png','DETROIT COUGARS':'detroit-cougars.png','COUGARS DE DETROIT':'detroit-cougars.png',
 'FLORIDA PANTHERS':'florida-panthers.png','HARTFORD WHALERS':'hartford-whalers.png',
 'MINNESOTA NORTH STARS':'minnesota-northstars.png','MONTREAL CANADIENS':'montreal-canadiens.png',
 'MONTREAL MAROONS':'montreal-maroons.png','NASHVILLE PREDATORS':'nashville-predators.png',
 'NEW YORK RANGERS':'newyork-rangers.png','OTTAWA SENATORS':'ottawa-senators.png','EDMONTON OILERS':'edmonton-oilers.png',
 'QUEBEC NORDIQUES':'quebec-nordiques.png','TORONTO MAPLE LEAFS':'toronto-mapleleafs.png',
 'VEGAS GOLDEN KNIGHTS':'vegas-golden-knights.png','WINNIPEG JETS':'winnipeg-jets.png'
};
const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('fr-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
// The cancelled 2019-20 third round remains in Fantrax's roster archive.
// Remove its zero-game selections from start totals, once per player.
const cancelled2020Starts={"01mzf":1,"02i6q":1,"03ee4":1,"02non":1,"031og":1,"01z7v":1,"02ybm":1,"003kg":1,"00qnu":1,"048x9":1,"01bvd":1,"04n4n":1,"03ril":1,"02un9":1,"03mn5":1,"02b42":1,"02yjw":1,"03yuc":1,"031oi":1,"003nc":1,"023wa":1,"003fj":1,"027i6":1,"02azb":1,"015pv":1,"005is":1,"01ztp":1,"003x7":1,"01zv1":1,"01f64":1,"01lkz":1,"02yjl":1,"03ra7":1,"01f6k":1,"02azm":1,"0222k":1,"03rip":1,"02ybl":1};
let dataset=[],excludeCancelled2020Starts=true;
function ranking(source,season){
 const grouped=new Map();
 for(const r of source){
  if(r.phase!=='playoffs'||(season&&r.season!==season)||!r.id||!r.name||r.name==='Identité non résolue')continue;
  const key=String(r.id)+'|'+String(r.kind||'');
  if(!grouped.has(key))grouped.set(key,{id:r.id,name:r.name,teams:new Set(),fpts:0,starts:0,cancelledStarts:0,gp:0,goals:0,assists:0});
  const p=grouped.get(key);p.teams.add(r.team);
  if(r.season==='2019-20'&&excludeCancelled2020Starts)p.cancelledStarts=cancelled2020Starts[String(r.id)]||0;
  for(const k of ['fpts','starts','gp','goals','assists'])p[k]+=Number(r[k])||0;
 }
 return [...grouped.values()].map(p=>({...p,starts:Math.max(0,p.starts-p.cancelledStarts)})).filter(p=>p.gp>0||p.fpts!==0).sort((a,b)=>Math.round(b.fpts*10000)-Math.round(a.fpts*10000)||a.name.localeCompare(b.name,'fr'));
}
function render(){
 const selectedSeason=$('season').value;if(!selectedSeason&&$('scorer-scope').value!=='all')return;
 const season=$('scorer-scope').value==='all'?'':selectedSeason;
 const rows=ranking(dataset,season),limit=$('scorer-limit').value,visible=limit==='all'?rows:rows.slice(0,Number(limit));
 const table=$('scorer-results').closest('table');table.style.setProperty('--scorer-team-width',visible.some(p=>p.teams.size>1)?'52px':'28px');
 portraitObserver?.disconnect();const body=$('scorer-results');body.replaceChildren();
 for(const [index,p] of visible.entries()){
  const tr=document.createElement('tr');
  const rank=rows.findIndex(r=>Math.round(r.fpts*10000)===Math.round(p.fpts*10000))+1;
  const values=[rank,'','',p.starts,p.gp,p.goals,p.assists,fmt(p.fpts),p.gp?fmt(p.fpts/p.gp):'—'];
  values.forEach((value,col)=>{
   const td=document.createElement('td');td.textContent=value;
   if(col===1){const button=document.createElement('button');button.type='button';button.className='scorer-player';button.dataset.bhlPlayerId=String(p.id);button.dataset.bhlPlayerName=p.name;button.title='Ouvrir la fiche de '+p.name;
    const avatar=document.createElement('span');avatar.className='scorer-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=p.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();const name=document.createElement('span');name.textContent=p.name;button.append(avatar,name);td.append(button);observePortrait(avatar,p.id,p.name);
   }
   if(col===2){const teams=document.createElement('span');teams.className='scorer-teams';for(const team of [...p.teams].sort((a,b)=>a.localeCompare(b,'fr'))){const file=LOGOS[norm(team)];if(file){const img=document.createElement('img');img.src='logos/'+file;img.alt=team;img.title=team;img.loading='lazy';teams.append(img)}else{const label=document.createElement('span');label.textContent=team;teams.append(label)}}td.append(teams)}
   tr.append(td);
  });body.append(tr);
 }
 if(!visible.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=9;td.textContent='Aucun pointeur disponible pour cette saison.';tr.append(td);body.append(tr)}
 $('scorer-status').textContent=visible.length+' sur '+rows.length+' joueurs · '+(season||'Toutes les saisons')+' · Classement par FPTS en séries';
}
async function start(){
 try{
  const response=await fetch('data/production/scorers.json',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.rows))throw Error();dataset=data.rows;excludeCancelled2020Starts=(data.coverage||[]).some(c=>c.season==='2019-20'&&c.phase==='playoffs'&&c.periods>=3);

  try{const r=await fetch('data/player-identity-map.json',{cache:'force-cache'});if(r.ok)playerIdentities=(await r.json()).players||{}}catch(e){}
  render();
 }catch(e){$('scorer-status').textContent='Impossible de charger les pointeurs. Rechargez la page pour réessayer.'}
}
$('scorer-scope').addEventListener('change',render);document.addEventListener('bhl:playoff-season',()=>{if(dataset.length)render()});document.addEventListener('bhl:playoff-scorers-open',()=>{if(dataset.length)render()});$('scorer-limit').addEventListener('change',render);start();
})();
