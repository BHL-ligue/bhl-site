(()=>{
'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('fr-CA',{maximumFractionDigits:2,minimumFractionDigits:2});
const defs=[
 ['start-fpts-skaters','Plus de FPTS en un départ · Patineurs','fpts','starts','skater'],
 ['start-fpts-goalies','Plus de FPTS en un départ · Gardiens','fpts','starts','goalie'],
 ['start-goals','Plus de buts en un départ','goals','starts','desc'],
 ['start-assists','Plus de passes en un départ','assists','starts','desc'],
 ['start-shots','Plus de tirs en un départ','SOG','starts','desc'],
 ['start-hits','Plus de mises en échec en un départ','Hit','starts','desc'],
 ['start-blocks','Plus de tirs bloqués en un départ','Blk','starts','desc'],
 ['start-saves','Plus d’arrêts en un départ','SV','starts','desc'],
 ['start-wins','Plus de victoires en un départ','W','starts','desc'],
 ['career-fpts-skaters','Plus de FPTS en carrière · Patineurs','fpts','career','skater'],
 ['career-fpts-goalies','Plus de FPTS en carrière · Gardiens','fpts','career','goalie'],
 ['career-starts','Plus de départs en carrière','starts','career','desc'],
 ['career-gp','Plus de matchs NHL en étant partant','gp','career','desc'],
 ['career-goals','Plus de buts en carrière','goals','career','desc'],
 ['career-assists','Plus de passes en carrière','assists','career','desc'],
 ['career-average-skaters','Meilleure moyenne FPTS par départ · Patineurs (min. 20)','average','career','skater'],
 ['career-average-goalies','Meilleure moyenne FPTS par départ · Gardiens (min. 20)','average','career','goalie'],
 ['season-fpts-skaters','Plus de FPTS en une saison · Patineurs','fpts','season','skater'],
 ['season-fpts-goalies','Plus de FPTS en une saison · Gardiens','fpts','season','goalie'],
 ['season-starts','Plus de départs en une saison','starts','season','desc'],
 ['season-goals','Plus de buts en une saison','goals','season','desc'],
 ['season-assists','Plus de passes en une saison','assists','season','desc'],
 ['season-average-skaters','Meilleure moyenne FPTS par départ en une saison · Patineurs (min. 10)','average','season','skater'],
 ['season-average-goalies','Meilleure moyenne FPTS par départ en une saison · Gardiens (min. 10)','average','season','goalie'],
 ['career-teams','Plus d’équipes BHL représentées','teams','career','desc'],
 ['career-seasons','Plus de saisons BHL disputées','seasons','career','desc']
];
let starts=[],aggregates=[],ready=false,periodDurations={};
function recordsRows(source,scope){
 const map=new Map();
 for(const r of source){
  if(!r.name||r.name==='Identité non résolue')continue;
  const key=String(r.id)+'|'+(r.kind==='goalie'||r.positionGroup==='goalie'?'goalie':'skater')+'|'+(scope==='season'?r.season:'');
  if(!map.has(key))map.set(key,{id:r.id,name:r.name,kind:r.kind==='goalie'||r.positionGroup==='goalie'?'goalie':'skater',season:scope==='season'?r.season:'',fpts:0,starts:0,gp:0,goals:0,assists:0,teamSet:new Set(),seasonSet:new Set(),review:false});
  const x=map.get(key);
  x.fpts+=Number(r.fpts)||0;x.starts+=Number(r.starts)||0;x.gp+=Number(r.gp)||0;
  x.goals+=Number(r.goals)||0;x.assists+=Number(r.assists)||0;
  x.teamSet.add(r.team);x.seasonSet.add(r.season);
  x.review=x.review||Boolean(r.reviewStarts||r.missingStarts);
 }
 return [...map.values()].map(x=>({...x,average:x.starts?x.fpts/x.starts:0,teams:x.teamSet.size,seasons:x.seasonSet.size}));
}
function value(r,field,scope){return scope==='starts'?(field in r?Number(r[field])||0:Number(r.stats?.[field])||0):Number(r[field])||0}
function portrait(id,name){
 const wrap=document.createElement('span');wrap.className='record-person';
 const avatar=document.createElement('span');avatar.className='player-avatar';avatar.textContent=name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
 const label=document.createElement('span');label.textContent=name;
 wrap.append(avatar,label);
 if(typeof window.BHLRecordPortrait==='function')window.BHLRecordPortrait(avatar,id,name);
 return wrap;
}
function render(){
 const root=$('records-content');if(!root)return;
 root.replaceChildren();
 const phase=$('record-phase').value,season=$('record-season').value,position=$('record-position').value,duration=$('record-duration').value;
 const allowed=r=>{const days=periodDurations[String(r.season)]?.[String(r.period)];return duration==='all'||(Number.isFinite(days)&&(duration==='regular'?days<=7:days>7))};
 const allStarts=starts.filter(r=>allowed(r)&&(phase==='all'||r.phase===phase)&&(!season||r.season===season)&&(position==='all'||(position==='goalie'?r.kind==='goalie':position==='defense'?r.position==='D':r.kind!=='goalie'&&r.position!=='D')));
 const allAggregates=(duration==='all'?aggregates:allStarts.map(r=>({...r,starts:1,positionGroup:r.kind==='goalie'?'goalie':r.position==='D'?'defense':'forward'}))).filter(r=>(phase==='all'||r.phase===phase)&&(!season||r.season===season)&&(position==='all'||r.positionGroup===position));
 const status=$('record-filter-status');
 if(status){
  const excluded=starts.filter(r=>!allowed(r)).length;
  const matched=allStarts.length;
  status.textContent=duration==='all'?'Toutes les durées de périodes · '+matched+' départs':duration==='regular'?'Périodes de 7 jours ou moins · '+matched+' départs retenus · '+excluded+' départs exclus':'Périodes de plus de 7 jours · '+matched+' départs retenus';
 }
 const career=recordsRows(allAggregates,'career'),seasonRows=recordsRows(allAggregates,'season');
 for(const [id,title,field,scope,group] of defs){
  if(group==='skater'&&position==='goalie'||group==='goalie'&&position!=='all'&&position!=='goalie')continue;
  const section=document.createElement('section');section.className='record-section';
  const h=document.createElement('h3');h.textContent=title;section.append(h);
  if(scope==='starts'&&!ready){const msg=document.createElement('p');msg.className='muted';msg.textContent='Données par départ en préparation : une reconstruction des archives est nécessaire.';section.append(msg);root.append(section);continue}
  const source=scope==='starts'?allStarts:scope==='career'?career:seasonRows;
  let ranked=source.filter(r=>r.name&&r.name!=='Identité non résolue'&&value(r,field,scope)>0&&(group!=='skater'||r.kind!=='goalie')&&(group!=='goalie'||r.kind==='goalie'));
  if(field==='average')ranked=ranked.filter(r=>r.starts>=(scope==='career'?20:10));
  ranked.sort((a,b)=>value(b,field,scope)-value(a,field,scope)||String(a.name).localeCompare(String(b.name),'fr'));
  ranked=ranked.slice(0,10);
  if(!ranked.length){const msg=document.createElement('p');msg.className='muted';msg.textContent='Aucune donnée disponible pour ces filtres.';section.append(msg);root.append(section);continue}
  const table=document.createElement('table');table.className='record-table';
  const thead=document.createElement('thead');const head=document.createElement('tr');
  for(const label of ['#','Joueur','Contexte','Total']){const th=document.createElement('th');th.textContent=label;head.append(th)}thead.append(head);table.append(thead);
  const body=document.createElement('tbody');
  for(const [i,r] of ranked.entries()){
   const tr=document.createElement('tr');
   const rank=document.createElement('td');rank.className='rank';rank.textContent=String(i+1);
   const name=document.createElement('td');name.append(portrait(r.id,r.name));
   const context=document.createElement('td');context.className='record-context';context.textContent=scope==='starts'?r.season+' · '+(r.phase==='playoffs'?'Séries':'Saison')+' · P'+r.period+' · '+r.team:scope==='season'?r.season:'Carrière BHL';
   const val=document.createElement('td');val.className='num';val.textContent=field==='teams'||field==='seasons'||field==='starts'||field==='gp'?String(value(r,field,scope)):fmt(value(r,field,scope));
   tr.append(rank,name,context,val);body.append(tr);
  }
  table.append(body);const scroll=document.createElement('div');scroll.className='scroll';scroll.append(table);section.append(scroll);root.append(section);
 }
}
async function init(){
 const source=await fetch('data/production/scorers.json',{cache:'no-store'}).then(r=>r.json());
 aggregates=source.rows||[];
 const seasons=[...new Set(aggregates.map(r=>r.season))].sort().reverse();
 for(const s of seasons)$('record-season').append(new Option(s,s));
 try{const response=await fetch('data/production/period-durations.json',{cache:'no-store'});if(response.ok)periodDurations=(await response.json()).seasons||{}}catch(e){console.warn('Period durations unavailable',e)}
 try{const response=await fetch('data/production/starts.json',{cache:'no-store'});if(response.ok){const data=await response.json();if(Array.isArray(data.rows)){starts=data.rows;ready=true}}}catch(e){console.warn('BHL records per-start archive unavailable',e)}
 render();
}
for(const id of ['record-phase','record-season','record-position','record-duration'])$(id)?.addEventListener('change',render);
init().catch(e=>{$('records-content').textContent='Impossible de charger les records : '+e.message});
})();
