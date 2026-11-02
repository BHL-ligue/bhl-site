/* Historique des transactions BHL — données extraites de l'onglet TRADES. */
(function(){
const teams=[['ANAHEIM','Anaheim Mighty Ducks','anaheim-mightyducks.png'],['ATLANTA','Atlanta Thrashers','atlanta-thrashers.png'],['CLEVELAND','Boston Bruins','boston-bruins.png'],['CALIFORNIE','California Golden Seals','california-goldenseals.png'],['CHICAGO','Chicago Blackhawks','chicago-blackhawks.png'],['COLORADO','Colorado Avalanche','colorado-avalanche.png'],['DETROIT','Detroit Red Wings','detroit-redwings.png'],['FLORIDA','Florida Panthers','florida-panthers.png'],['HARTFORD','Hartford Whalers','hartford-whalers.png'],['MINNESOTA','Minnesota North Stars','minnesota-northstars.png'],['MONTREAL','Montréal Canadiens','montreal-canadiens.png'],['NASHVILLE','Nashville Predators','nashville-predators.png'],['NEWYORK','New York Rangers','newyork-rangers.png'],['OTTAWA','Ottawa Senators','ottawa-senators.png'],['QUÉBEC','Québec Nordiques','quebec-nordiques.png'],['TORONTO','Toronto Maple Leafs','toronto-mapleleafs.png']];
const teamById=Object.fromEntries(teams.map(x=>[x[0],x]));
let cache=null,loading=null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Inscrire ici l'URL /exec du déploiement Apps Script TRADES.
const TRADES_API_URL='https://script.google.com/macros/s/AKfycbwZZgbPadyd8tOK7zsi8CRW3oRs9XdEMHU-A_j0gwovtacw-lAz2wRhrbVBLJPHeLjc/exec';
// Logos historiques déjà présents dans le dossier logos/ du site.
const historical={
 'anaheim mighty ducks':['ANAHEIM','anaheim-mightyducks.png'],
 'atlanta thrashers':['ATLANTA','atlanta-thrashers.png'],
 'cleveland barons':['CLEVELAND','cleveland-barons.png'],
 'boston bruins':['CLEVELAND','boston-bruins.png'],
 'california golden seals':['CALIFORNIE','california-goldenseals.png'],
 'chicago blackhawks':['CHICAGO','chicago-blackhawks.png'],
 'winnipeg jets':['COLORADO','winnipeg-jets.png'],
 'colorado avalanche':['COLORADO','colorado-avalanche.png'],
 'detroit cougars':['DETROIT','detroit-cougars.png'],
 'detroit red wings':['DETROIT','detroit-redwings.png'],
 'florida panthers':['FLORIDA','florida-panthers.png'],
 'vegas golden knights':['FLORIDA','vegas-goldenknights.png'],
 'hartford whalers':['HARTFORD','hartford-whalers.png'],
 'minnesota north stars':['MINNESOTA','minnesota-northstars.png'],
 'montreal maroons':['MONTREAL','montreal-maroons.png'],
 'montreal canadiens':['MONTREAL','montreal-canadiens.png'],
 'nashville predators':['NASHVILLE','nashville-predators.png'],
 'new york rangers':['NEWYORK','newyork-rangers.png'],
 'edmonton oilers':['OTTAWA','edmonton-oilers.png'],
 'ottawa senators':['OTTAWA','ottawa-senators.png'],
 'quebec nordiques':['QUÉBEC','quebec-nordiques.png'],
 'toronto maple leafs':['TORONTO','toronto-mapleleafs.png']
};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function identity(name){return historical[normalize(name)]||null}
function historicalLogo(name,id){const h=identity(name),file=h?.[1]||teamById[id]?.[2];return file?`<img class="tr-team-logo" src="logos/${escape(file)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
function toDate(raw){
 const s=String(raw||'').trim();if(!s)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const d=new Date(s);if(!Number.isNaN(d.getTime()))return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 return '';
}
function parseTrades(rows){
 const grouped=new Map();
 for(const r of rows){
  if(!Array.isArray(r))continue;
  const asset=String(r[2]||'').trim(),from=String(r[5]||'').trim(),to=String(r[6]||'').trim();
  const rawId=String(r[10]||r[1]||'').trim();
  if(!asset||!from||!to||!/^\d+(?:\.\d+)?$/.test(rawId))continue;
  const id=String(parseInt(rawId,10)); // 29.1, 29.2 et 29.3 = une transaction
  const dateText=String(r[8]||'').trim(),season=String(r[11]||'').trim();
  if(!grouped.has(id))grouped.set(id,{id,date:toDate(dateText),dateText,season,moves:[]});
  const g=grouped.get(id),fromOrg=identity(from)?.[0]||'',toOrg=identity(to)?.[0]||'';
  const move={asset,position:String(r[4]||'').trim(),from,to,fromOrg,toOrg};
  if(!g.moves.some(x=>x.asset===asset&&x.from===from&&x.to===to))g.moves.push(move);
 }
 return [...grouped.values()].sort((a,b)=>b.date.localeCompare(a.date)||Number(b.id)-Number(a.id));
}
function liveTrades(){return new Promise((resolve,reject)=>{
 const cb='bhlTradesCb_'+Date.now()+'_'+Math.floor(Math.random()*100000);
 const script=document.createElement('script');let done=false;
 const timer=setTimeout(()=>finish(Error('Délai API dépassé')),18000);
 function finish(err,data){if(done)return;done=true;clearTimeout(timer);delete window[cb];script.remove();err?reject(err):resolve(data)}
 window[cb]=data=>{
  if(!data||!data.ok)return finish(Error(data?.error||'Réponse TRADES invalide'));
  const trades=Array.isArray(data.trades)?data.trades:parseTrades(data.data?.rows||data.rows||[]);
  if(!trades.length)return finish(Error('Aucune transaction dans la réponse TRADES'));
  finish(null,trades);
 };
 script.onerror=()=>finish(Error('API inaccessible'));
 script.src=TRADES_API_URL+'?callback='+encodeURIComponent(cb)+'&_='+Date.now();
 document.head.appendChild(script);
})}
function localTrades(){return fetch('bhl-trades-data.json').then(r=>{if(!r.ok)throw Error('Fichier local introuvable');return r.json()}).then(d=>d.trades||[])}
function load(){if(cache)return Promise.resolve(cache);if(!loading)loading=liveTrades().catch(()=>localTrades()).then(d=>(cache=reconcileOrganizations(d),cache)).catch(e=>{loading=null;throw e});return loading;}

// Reconstituer les organisations à partir des noms historiques, y compris pour
// le fichier JSON de secours dont certains identifiants peuvent être périmés.
// Cette normalisation est appliquée aussi bien aux données API qu'au JSON local.
function reconcileOrganizations(trades){
 return (Array.isArray(trades)?trades:[]).map(t=>({
  ...t,
  moves:(Array.isArray(t.moves)?t.moves:[]).map(m=>({
   ...m,
   fromOrg:identity(m.from)?.[0]||m.fromOrg||'',
   toOrg:identity(m.to)?.[0]||m.toOrg||''
  }))
 }));
}
function participants(t){return [...new Set(t.moves.flatMap(m=>[identity(m.from)?.[0]||m.fromOrg,identity(m.to)?.[0]||m.toOrg]).filter(Boolean))]}
const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DAYS=['dim','lun','mar','mer','jeu','ven','sam'];
const ENMONTH={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function date(t){
 const raw=String(t.date||'').trim(), src=String(t.dateText||'').trim();
 let y,m,d;
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) [y,m,d]=raw.split('-').map(Number);
 else {
  const match=src.match(/^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if(match){m=ENMONTH[match[1].toLowerCase()]+1;d=Number(match[2]);y=Number(match[3]);}
  else {const numeric=src.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(numeric){d=Number(numeric[1]);m=Number(numeric[2]);y=Number(numeric[3]);}}
 }
 if(y&&m>=1&&m<=12&&d>=1&&d<=31){
  const utc=new Date(Date.UTC(y,m-1,d));
  if(utc.getUTCFullYear()===y&&utc.getUTCMonth()===m-1&&utc.getUTCDate()===d){
   const tm=src.match(/,?\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
   let time='';if(tm){let hour=Number(tm[1])%12+(tm[3].toUpperCase()==='PM'?12:0);time=` à ${String(hour).padStart(2,'0')} h ${tm[2]}`;}
   return `${DAYS[utc.getUTCDay()]} ${d} ${MONTHS[m-1]} ${y}${time}`;
  }
 }
 return src.replace(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/gi,v=>({sun:'dim',mon:'lun',tue:'mar',wed:'mer',thu:'jeu',fri:'ven',sat:'sam'})[v.toLowerCase()]);
}
// Couleurs historiques utilisées pour les bandeaux des équipes.
const historicColors={
 'anaheim mighty ducks':'#532a65','atlanta thrashers':'#245b8e','cleveland barons':'#9a1d32',
 'boston bruins':'#222222','california golden seals':'#087b69','chicago blackhawks':'#b20e25',
 'winnipeg jets':'#17477e','colorado avalanche':'#6f263d','detroit cougars':'#b20d22',
 'detroit red wings':'#ce1126','florida panthers':'#9b1c32','vegas golden knights':'#b4975a','hartford whalers':'#087b61',
 'minnesota north stars':'#08783e','montreal maroons':'#692238','montreal canadiens':'#af1e2d',
 'nashville predators':'#8c6610','new york rangers':'#14539b','edmonton oilers':'#174d91',
 'ottawa senators':'#a31d27','quebec nordiques':'#155ca0','toronto maple leafs':'#174a83'
};
const orgColors={ANAHEIM:'#532a65',ATLANTA:'#245b8e',CLEVELAND:'#222222',CALIFORNIE:'#087b69',CHICAGO:'#b20e25',COLORADO:'#6f263d',DETROIT:'#ce1126',FLORIDA:'#9b1c32',HARTFORD:'#087b61',MINNESOTA:'#08783e',MONTREAL:'#af1e2d',NASHVILLE:'#8c6610',NEWYORK:'#14539b',OTTAWA:'#a31d27','QUÉBEC':'#155ca0',TORONTO:'#174a83'};
function colorFor(name,id){return historicColors[normalize(name)]||orgColors[id]||'#cc0000'}
function logo(id){const t=teamById[id];return t?`<img class="tr-team-logo" src="logos/${escape(t[2])}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
function teamName(id){return teamById[id]?.[1]||id}
function card(t){
 const ids=participants(t);
 return `<article class="tr-card"><div class="tr-card-head"><div><span class="tr-number">TRANSACTION Nº ${escape(t.id)}</span><span class="tr-date" style="display:block;margin:3px 0 0">${escape(date(t))} · ${escape(t.season||'')}</span></div>${ids.length>2?'<span class="tr-three">Échange à '+ids.length+' équipes</span>':''}</div><div class="tr-columns">${ids.map(id=>{
  const received=t.moves.filter(m=>m.toOrg===id);
  const historicName=received[0]?.to||t.moves.find(m=>m.fromOrg===id)?.from||teamName(id);
  return `<section class="tr-side" style="--tr-side-color:#bfc4ca"><div class="tr-side-title" style="background:#bfc4ca!important;color:#20252b!important"><div class="tr-side-name">${historicalLogo(historicName,id)}<span>${escape(historicName)}</span></div><span class="tr-received">REÇOIT</span></div><div class="tr-side-body">${received.length?`<ul>${received.map(m=>`<li>${m.position?`<img class="tr-trade-thumb" hidden data-trade-portrait="${escape(m.asset)}" alt=""><button type="button" class="tr-player-link" data-player="${escape(m.asset)}" aria-label="Voir les transactions de ${escape(m.asset)}">${escape(m.asset)}</button>`:`<strong>${escape(m.asset)}</strong>`}${m.position?` <small>(${escape(m.position)})</small>`:''}<span class="tr-from">de ${escape(m.from)}</span></li>`).join('')}</ul>`:'<p class="tr-empty">Aucun élément reçu indiqué</p>'}</div></section>`
 }).join('')}</div></article>`
}
// Chaque numero de transaction compte une seule fois pour chaque paire
// d'organisations participantes. Un echange a trois clubs compte pour les trois paires.
function pairStats(trades){
 const pairs=new Map();
 for(const t of trades){
  const ids=participants(t).filter(id=>teamById[id]);
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   if(ids[i]===ids[j])continue;
   const pair=[ids[i],ids[j]].sort();const key=pair.join('|');
   pairs.set(key,(pairs.get(key)||0)+1);
  }
 }
 return pairs;
}
function pairCount(pairs,a,b){return pairs.get([a,b].sort().join('|'))||0}
function rankingRows(pairs,selected){
 const rows=teams.filter(t=>t[0]!==selected).map(t=>({id:t[0],count:pairCount(pairs,selected,t[0])}));
 return rows.filter(r=>r.count>0).sort((a,b)=>b.count-a.count||teamName(a.id).localeCompare(teamName(b.id),'fr'));
}
function renderRanking(rows,heading){
 const max=rows[0]?.count||1;
 return `<div class="tr-stats-ranking"><h4>${escape(heading)}</h4>${rows.length?rows.map((r,i)=>`<div class="tr-stats-row"><span class="tr-stats-rank">${i+1}.</span>${logo(r.id)}<span class="tr-stats-name">${escape(teamName(r.id))}<span class="tr-stats-bar" style="width:${Math.round(r.count/max*100)}%"></span></span><strong>${r.count}</strong></div>`).join(''):'<p>Aucune transaction commune trouvée.</p>'}</div>`;
}
function initStats(el,data,compact,org){
 const target=el.querySelector('.tr-stats');if(!target)return;
 const pairs=pairStats(data);
 const total=data.length;
 if(compact){
  const rows=rankingRows(pairs,org);
  target.innerHTML=`<div class="tr-stats-head"><h3>Partenaires de transactions</h3><p>Organisations avec lesquelles ${escape(teamName(org))} a échangé le plus, franchises historiques incluses.</p></div><div class="tr-stats-metrics"><strong>${data.filter(t=>participants(t).includes(org)).length}</strong><span>transactions de cette organisation</span></div>${renderRanking(rows,'Classement des partenaires')}`;
 }else{
  const ranked=[...pairs].map(([key,count])=>({ids:key.split('|'),count})).sort((a,b)=>b.count-a.count||a.ids.join('').localeCompare(b.ids.join('')));
  target.innerHTML=`<div class="tr-stats-head"><h3>Statistiques des échanges entre organisations</h3><p>Chaque transaction est comptée une seule fois par paire, même si plusieurs joueurs sont échangés. Les anciennes franchises sont regroupées avec leur organisation actuelle.</p></div><div class="tr-stats-metrics"><strong>${total}</strong><span>transactions distinctes dans l'historique</span></div><div class="tr-stats-compare"><label>Première organisation<select class="tr-stats-a">${teams.map(t=>`<option value="${escape(t[0])}">${escape(t[1])}</option>`).join('')}</select></label><label>Deuxième organisation<select class="tr-stats-b">${teams.map(t=>`<option value="${escape(t[0])}">${escape(t[1])}</option>`).join('')}</select></label></div><div class="tr-stats-total" aria-live="polite"></div><div class="tr-stats-top"><h4>Duos ayant effectué le plus d'échanges</h4>${ranked.slice(0,12).map((r,i)=>`<div class="tr-stats-pair"><span>${i+1}. ${logo(r.ids[0])}${escape(teamName(r.ids[0]))} <span class="tr-stats-sep">×</span> ${logo(r.ids[1])}${escape(teamName(r.ids[1]))}</span><strong>${r.count}</strong></div>`).join('')}</div>`;
  const a=target.querySelector('.tr-stats-a'),b=target.querySelector('.tr-stats-b');
  if(ranked.length){a.value=ranked[0].ids[0];b.value=ranked[0].ids[1]}
  else{a.value=teams[0][0];b.value=teams[1][0]}
  const update=()=>{const count=a.value===b.value?0:pairCount(pairs,a.value,b.value);target.querySelector('.tr-stats-total').innerHTML=`<strong>${count}</strong> transaction${count>1?'s':''} entre ces deux organisations`;};
  a.addEventListener('change',update);b.addEventListener('change',update);update();
 }
}
// Historique individuel construit à partir des transactions disponibles.
function playerMoves(data,name){
 const key=normalize(name),events=[];
 for(const t of data){
  const moves=t.moves.filter(m=>m.position&&normalize(m.asset)===key);
  if(!moves.length)continue;
  for(const m of moves)events.push({t,m});
 }
 return events.sort((a,b)=>(a.t.date||'').localeCompare(b.t.date||'')||Number(a.t.id)-Number(b.t.id));
}

const trPortraitCache=new Map();
function trPortraitNorm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
async function trPortraitJson(url){
 for(const proxy of ['https://proxy.cors.dev/','https://corsproxy.io/?']){
  try{const response=await fetch(proxy.includes('corsproxy.io')?proxy+encodeURIComponent(url):proxy+url,{signal:AbortSignal.timeout(11000)});if(response.ok)return response.json()}catch(e){}
 }
 throw Error('Service NHL indisponible');
}
function trPortrait(name){
 const key=trPortraitNorm(name);if(!key)return Promise.resolve(null);
 if(trPortraitCache.has(key))return trPortraitCache.get(key);
 const promise=(async()=>{
  const results=await trPortraitJson('https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q='+encodeURIComponent(name));
  const list=Array.isArray(results)?results:(results?.data||[]);
  const match=list.find(p=>{const n=p.name||p.fullName||p.playerName;return trPortraitNorm(n)===key||trPortraitNorm(String(n).split(',').reverse().join(' '))===key});
  const id=Number(match?.playerId||match?.id);if(!Number.isInteger(id)||id<=0)return null;
  const profile=await trPortraitJson('https://api-web.nhle.com/v1/player/'+id+'/landing');
  const team=String(profile?.currentTeamAbbrev||'').replace(/[^A-Z]/g,'');
  const urls=[profile?.headshot,...(team?['20262027','20252026','20242025'].map(season=>'https://assets.nhle.com/mugs/nhl/'+season+'/'+team+'/'+id+'.png'):[])].filter(x=>typeof x==='string'&&x.startsWith('https://'));
  return {urls,profile:'https://www.nhl.com/player/'+id};
 })().catch(()=>null);
 trPortraitCache.set(key,promise);return promise;
}
function trPortraitImg(img,name){
 trPortrait(name).then(data=>{
  if(!data||!img.isConnected)return;
  let index=0;
  img.onload=()=>{img.hidden=false};
  img.onerror=()=>{index++;if(index<data.urls.length)img.src=data.urls[index];else img.hidden=true};
  if(data.urls.length)img.src=data.urls[0];
 });
}
function trPortraitModal(name,details=''){
 const old=document.querySelector('.tr-portrait-overlay');if(old)old.remove();
 const overlay=document.createElement('div');overlay.className='tr-portrait-overlay';
 overlay.innerHTML='<div class="tr-portrait-dialog" role="dialog" aria-modal="true" tabindex="-1"><button type="button" class="tr-portrait-close" aria-label="Fermer">×</button><div class="tr-portrait-hero"><img class="tr-portrait-large" hidden alt=""><h3></h3><a class="tr-portrait-profile" hidden target="_blank" rel="noopener noreferrer">Fiche officielle NHL.com ↗</a></div><div class="tr-portrait-details"></div></div>';
 overlay.querySelector('h3').textContent=name;
 overlay.querySelector('.tr-portrait-details').textContent=details;
 document.body.appendChild(overlay);
 const close=()=>{overlay.remove();document.removeEventListener('keydown',key)};
 const key=e=>{if(e.key==='Escape')close()};
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.tr-portrait-close'))close()});
 document.addEventListener('keydown',key);
 overlay.querySelector('.tr-portrait-dialog').focus();
 trPortrait(name).then(data=>{if(!data||!overlay.isConnected)return;
  const img=overlay.querySelector('.tr-portrait-large');let i=0;
  img.onload=()=>{img.hidden=false};img.onerror=()=>{i++;if(i<data.urls.length)img.src=data.urls[i];else img.hidden=true};
  if(data.urls.length)img.src=data.urls[0];
  const link=overlay.querySelector('.tr-portrait-profile');link.href=data.profile;link.hidden=false;
 });
}
function trPortraitFill(root){
 if(!root)return;
 root.querySelectorAll('img[data-trade-portrait]').forEach(img=>trPortraitImg(img,img.dataset.tradePortrait));
}

function showPlayerHistory(el,data,name){
 const events=playerMoves(data,name);
 if(!events.length)return;
 const old=el.querySelector('.tr-player-overlay');if(old)old.remove();
 const overlay=document.createElement('div');overlay.className='tr-player-overlay';
 const orgs=[];
 for(const {m} of events){
  for(const [org,label] of [[m.fromOrg,m.from],[m.toOrg,m.to]]){
   if(org&&!orgs.some(x=>x.org===org))orgs.push({org,label});
  }
 }
 const last=events[events.length-1]?.m;
 overlay.innerHTML=`<section class="tr-player-dialog" role="dialog" aria-modal="true" aria-label="Historique des transactions de ${escape(name)}" tabindex="-1"><div class="tr-player-head"><div><span class="tr-player-eyebrow">HISTORIQUE DES TRANSACTIONS</span><h3>${escape(name)}</h3></div><button class="tr-player-close" type="button" aria-label="Fermer">×</button></div><div class="tr-player-content"><div class="tr-player-metric"><strong>${new Set(events.map(e=>String(e.t.id))).size}</strong><span>fois échangé${events.length>1?'':' '} dans la BHL</span></div><h4>Organisations dans son parcours d'échanges</h4><div class="tr-player-orgs">${orgs.map(o=>`<span class="tr-player-org">${logo(o.org)}${escape(teamName(o.org))}</span>`).join('')}</div><h4>Historique des échanges</h4><ol class="tr-player-events">${events.map(({t,m})=>`<li><div class="tr-player-event-date">${escape(date(t))} · Transaction nº ${escape(t.id)}</div><div class="tr-player-route">${historicalLogo(m.from,m.fromOrg)}<span>${escape(m.from)}</span><span aria-hidden="true">→</span>${historicalLogo(m.to,m.toOrg)}<strong>${escape(m.to)}</strong></div></li>`).join('')}</ol><p class="tr-player-note">Historique basé uniquement sur les transactions enregistrées dans la BHL. Il ne constitue pas nécessairement la liste complète des équipes du joueur.</p></div></section>`;
 document.body.appendChild(overlay);
 const portraitCircle=document.createElement('div');portraitCircle.className='tr-portrait-circle';
 const portrait=document.createElement('img');portrait.className='tr-trade-portrait';portrait.hidden=true;portrait.alt='Photo officielle NHL de '+name;
 portraitCircle.appendChild(portrait);
 overlay.querySelector('.tr-player-head>div').prepend(portraitCircle);
 trPortraitImg(portrait,name);
 trPortrait(name).then(info=>{if(!info||!overlay.isConnected)return;const a=document.createElement('a');a.href=info.profile;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Fiche NHL.com ↗';a.className='tr-nhl-profile';overlay.querySelector('.tr-player-head>div').append(a)});
 const dialog=overlay.querySelector('.tr-player-dialog'),close=()=>{overlay.remove();document.removeEventListener('keydown',onKey);};
 const onKey=e=>{if(e.key==='Escape')close();};
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.tr-player-close'))close()});
 document.addEventListener('keydown',onKey);dialog.focus();
}
function injectPlayerStyles(){
 if(!document.getElementById('bhl-trade-photo-style')){const style=document.createElement('style');style.id='bhl-trade-photo-style';style.textContent=".tr-trade-thumb{width:42px;height:42px;object-fit:contain;object-position:center bottom;vertical-align:middle;margin-right:10px;background:#fff;border:1px solid #e2e6eb;border-radius:50%;box-shadow:0 2px 6px #15223814}.tr-trade-thumb[hidden],.tr-trade-portrait[hidden]{display:none!important}.tr-player-head>div:first-child{display:grid;grid-template-columns:112px minmax(0,1fr);column-gap:20px;align-items:center;min-width:0;flex:1}.tr-portrait-circle{grid-column:1;grid-row:1 / span 4;width:112px;height:112px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:50%;background:#fff;border:4px solid #ffffffb8;box-shadow:0 5px 20px #0003;flex:none}.tr-trade-portrait{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center bottom;float:none;margin:0}.tr-player-eyebrow,.tr-player-head h3,.tr-nhl-profile{grid-column:2;min-width:0}.tr-player-head h3{overflow-wrap:anywhere}.tr-nhl-profile{display:inline-block;margin-top:9px;color:#fff!important;font-size:12px;text-decoration:underline;text-underline-offset:3px}.tr-player-head{align-items:flex-start}.tr-player-head:after{content:\"\";display:block;clear:both}@media(max-width:480px){.tr-player-head{padding:16px!important;gap:8px}.tr-player-head>div:first-child{grid-template-columns:78px minmax(0,1fr);gap:12px}.tr-portrait-circle{width:78px;height:78px;border-width:3px}.tr-player-head h3{font-size:19px!important}.tr-player-eyebrow{font-size:9px!important}.tr-nhl-profile{font-size:11px}.tr-trade-thumb{width:36px;height:36px;margin-right:6px}}";document.head.appendChild(style)}
 if(document.getElementById('bhl-player-history-style'))return;
 const style=document.createElement('style');style.id='bhl-player-history-style';
 style.textContent=`.tr-player-link{appearance:none;background:none;border:0;padding:0;color:#ad1728;font:inherit;font-weight:700;cursor:pointer;text-align:left;text-decoration:underline;text-decoration-color:#d8a3aa;text-underline-offset:3px}.tr-player-link:hover,.tr-player-link:focus-visible{color:#74101b;text-decoration-color:currentColor}.tr-player-overlay{position:fixed;inset:0;z-index:99999;background:rgba(17,24,39,.65);display:flex;justify-content:center;align-items:center;padding:16px}.tr-player-dialog{width:min(640px,100%);max-height:min(85vh,800px);overflow:auto;background:white;border-radius:14px;box-shadow:0 15px 55px #0005;color:#20252b;outline:0}.tr-player-head{background:#cc0000;color:white;padding:18px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.tr-player-head h3{margin:5px 0 0;font-size:24px;color:white}.tr-player-eyebrow{font-size:11px;letter-spacing:.08em;font-weight:700}.tr-player-close{border:0;background:#ffffff2a;color:white;font-size:28px;line-height:1;cursor:pointer;border-radius:7px;width:36px;height:36px}.tr-player-content{padding:20px 22px}.tr-player-content h4{font-size:15px;margin:22px 0 12px}.tr-player-metric{display:flex;align-items:center;gap:12px;background:#f4f5f7;padding:13px 16px;border-radius:9px}.tr-player-metric strong{font-size:30px;color:#cc0000}.tr-player-orgs{display:flex;flex-wrap:wrap;gap:8px}.tr-player-org{display:inline-flex;align-items:center;gap:6px;background:#f4f5f7;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700}.tr-player-org .tr-team-logo,.tr-player-route .tr-team-logo{width:25px;height:25px;object-fit:contain}.tr-player-events{list-style:none;margin:0;padding:0}.tr-player-events li{border-bottom:1px solid #e5e7eb;padding:12px 0}.tr-player-event-date{font-size:12px;color:#687280;margin-bottom:7px}.tr-player-route{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:13px}.tr-player-route strong{font-weight:700}.tr-player-note{color:#687280;font-size:12px;line-height:1.5;margin-top:18px}@media(max-width:600px){.tr-player-content{padding:15px}.tr-player-head{padding:15px}.tr-player-head h3{font-size:20px}}`;
 document.head.appendChild(style);
}
function injectStatsStyles(){
 if(document.getElementById('bhl-trade-statistics-style'))return;
 const style=document.createElement('style');style.id='bhl-trade-statistics-style';
 style.textContent=`.tr-stats{background:#fff;border:1px solid #e1e4e8;border-radius:13px;padding:20px;margin:0 0 22px;box-shadow:0 2px 6px #19283b08}.tr-stats-head h3{margin:0 0 5px;font-size:20px}.tr-stats-head p{color:#66717d;font-size:13px;margin:0 0 16px}.tr-stats-metrics{display:flex;gap:12px;align-items:center;padding:13px 15px;background:#f4f5f7;border-radius:9px;margin-bottom:18px}.tr-stats-metrics strong{font-size:26px;color:#cc0000}.tr-stats-metrics span{font-size:13px}.tr-stats-ranking h4,.tr-stats-top h4{margin:12px 0;font-size:15px}.tr-stats-row{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid #eef0f2}.tr-stats-row .tr-team-logo,.tr-stats-pair .tr-team-logo{width:26px;height:26px;object-fit:contain;vertical-align:middle}.tr-stats-rank{width:24px;color:#687280;font-size:12px}.tr-stats-name{flex:1;min-width:0;font-size:13px}.tr-stats-bar{display:block;background:var(--team-color,#cc0000);height:4px;border-radius:3px;max-width:100%;margin-top:5px}.tr-stats-row strong,.tr-stats-pair strong{font-size:15px;min-width:30px;text-align:right}.tr-stats-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tr-stats-compare label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700}.tr-stats-compare select{width:100%;min-width:0;border:1px solid #d6dce2;border-radius:8px;padding:10px;background:white;color:#222;font:inherit}.tr-stats-total{margin:13px 0 18px;background:#fff4f4;padding:13px;border-radius:9px;font-size:14px}.tr-stats-total strong{font-size:23px;color:#cc0000;margin-right:6px}.tr-stats-pair{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #eef0f2;padding:9px 0;font-size:13px}.tr-stats-pair>span{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.tr-stats-sep{color:#87909c;padding:0 4px}@media(max-width:600px){.tr-stats{padding:14px}.tr-stats-compare{grid-template-columns:1fr}.tr-stats-head h3{font-size:17px}.tr-stats-pair{font-size:12px}}`;
 document.head.appendChild(style);
}
function injectNeutralSideStyle(){
 if(document.getElementById('bhl-trades-neutral-side-style'))return;
 const style=document.createElement('style');
 style.id='bhl-trades-neutral-side-style';
 style.textContent='.tr-card .tr-side .tr-side-title{background:#bfc4ca!important;color:#20252b!important}.tr-side .tr-side-title .tr-side-name,.tr-side .tr-side-title .tr-side-name span,.tr-side .tr-side-title .tr-received{color:#20252b!important;opacity:1!important}';
 document.head.appendChild(style);
}
function injectTransactionPolish(){
 if(document.getElementById('bhl-transaction-polish'))return;
 const style=document.createElement('style');
 style.id='bhl-transaction-polish';
 style.textContent=`
 .tr-card{border:1px solid #dfe3e8!important;border-radius:15px!important;box-shadow:0 3px 12px rgba(25,40,59,.065)!important;overflow:hidden;transition:box-shadow .18s ease,transform .18s ease;margin-bottom:18px!important}
 .tr-card:hover{box-shadow:0 7px 20px rgba(25,40,59,.11)!important}
 .tr-card-head{padding:16px 20px!important;min-height:74px;gap:14px}
 .tr-number{font-size:14px;letter-spacing:.045em;font-weight:900}
 .tr-date{font-size:12px!important;line-height:1.5;opacity:.86;margin-top:4px!important}
 .tr-three{font-size:11px!important;padding:6px 10px!important}
 .tr-side{min-width:0;padding:0!important;border-color:#e7e9ed!important}
 .tr-side-title{padding:12px 17px!important;min-height:61px;display:flex;align-items:center;justify-content:space-between;gap:10px}
 .tr-side-name{display:flex;align-items:center;gap:10px;min-width:0;font-weight:800;line-height:1.3}
 .tr-side-name span{overflow-wrap:anywhere}
 .tr-team-logo{width:34px!important;height:34px!important;flex-shrink:0}
 .tr-received{flex-shrink:0;letter-spacing:.09em;font-size:10px!important}
 .tr-side-body{padding:7px 17px 13px}
 .tr-side-body ul{margin:0!important}
 .tr-side-body li{padding:11px 0!important;border-bottom:1px solid #eceef1!important;line-height:1.5}
 .tr-side-body li:last-child{border-bottom:0!important}
 .tr-from{margin-top:3px;font-size:11px!important}
 .tr-filters input:focus,.tr-filters select:focus{outline:2px solid #cc000055;outline-offset:1px;border-color:#cc0000}
 .tr-pages button:not(:disabled):hover{border-color:#cc0000;color:#cc0000}
 @media(max-width:600px){.tr-card-head{padding:13px 15px!important;min-height:65px}.tr-side-title{padding:10px 13px!important}.tr-side-body{padding:5px 13px 10px}.tr-number{font-size:13px}.tr-card{margin-bottom:14px!important}}
 @media(prefers-reduced-motion:reduce){.tr-card{transition:none}}
 `;
 document.head.appendChild(style);
}
function mount(el,options={}){if(!el)return;let page=1,perPage=20,data=[],query='',season='',team=options.team||'',state={};const compact=!!options.team;injectStatsStyles();injectNeutralSideStyle();injectPlayerStyles();injectTransactionPolish();
 // Utiliser la couleur exacte de la fiche ÉQUIPES, et non celle de la page générale.
 if(compact){
   el.classList.add('tr-embedded');
   if(!document.getElementById('bhl-trades-team-head-style')){
     const style=document.createElement('style');
     style.id='bhl-trades-team-head-style';
     style.textContent='.tr-embedded .tr-card-head{background:var(--team-color,#cc0000)!important;color:#fff!important;border-bottom:0!important}.tr-embedded .tr-card-head .tr-number,.tr-embedded .tr-card-head .tr-date{color:#fff!important}.tr-embedded .tr-card-head .tr-three{color:#fff!important;background:rgba(255,255,255,.18)!important}';
     document.head.appendChild(style);
   }
 }else{el.classList.add('tr-standalone');}

 el.innerHTML=`<section class="tr-stats" aria-label="Statistiques des transactions"><p>Chargement des statistiques…</p></section><div class="tr-filters"><input class="tr-search" type="search" aria-label="Rechercher une transaction, un joueur ou une équipe" placeholder="Rechercher un joueur, une équipe ou un nº…"><select class="tr-season" aria-label="Saison"><option value="">Toutes les saisons</option></select>${compact?'':`<select class="tr-team" aria-label="Équipe"><option value="">Toutes les équipes</option>${teams.map(t=>`<option value="${escape(t[0])}">${escape(t[1])}</option>`).join('')}</select>`}</div><div class="tr-count" aria-live="polite">Chargement des transactions…</div><div class="tr-results"></div><div class="tr-pages"></div>`;
 el.addEventListener('click',e=>{const btn=e.target.closest('.tr-player-link');if(btn&&el.contains(btn))showPlayerHistory(el,data,btn.dataset.player);});
 const $=s=>el.querySelector(s);function draw(){let list=data.filter(t=>(!season||t.season===season)&&(!team||participants(t).includes(team))&&(!query||[t.id,t.season,...t.moves.flatMap(m=>[m.asset,m.from,m.to,m.position])].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)));const max=Math.max(1,Math.ceil(list.length/perPage));page=Math.min(page,max);$('.tr-count').textContent=`${list.length} transaction${list.length>1?'s':''}${team?' pour cette organisation':''}`;$('.tr-results').innerHTML=list.slice((page-1)*perPage,page*perPage).map(card).join('')||'<div class="tr-noresults">Aucune transaction trouvée.</div>';trPortraitFill($('.tr-results'));$('.tr-pages').innerHTML=max>1?`<button type="button" data-dir="-1" ${page===1?'disabled':''}>Précédent</button><span>Page ${page} sur ${max}</span><button type="button" data-dir="1" ${page===max?'disabled':''}>Suivant</button>`:'';$('.tr-pages').querySelectorAll('button').forEach(b=>b.onclick=()=>{page+=Number(b.dataset.dir);draw();el.scrollIntoView({block:'start',behavior:'smooth'})})}
 $('.tr-search').oninput=e=>{query=e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();page=1;draw()};$('.tr-season').onchange=e=>{season=e.target.value;page=1;draw()};if(!compact)$('.tr-team').onchange=e=>{team=e.target.value;page=1;draw()};
 load().then(t=>{if(!el.isConnected)return;data=t;initStats(el,data,compact,team);const seasons=[...new Set(t.map(x=>x.season).filter(Boolean))].sort().reverse();$('.tr-season').insertAdjacentHTML('beforeend',seasons.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join(''));draw()}).catch(e=>{$('.tr-count').textContent='Impossible de charger les transactions : '+e.message});}
window.BHLTrades={mount,load,teams};
})();
