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
function load(){if(cache)return Promise.resolve(cache);if(!loading)loading=liveTrades().catch(()=>localTrades()).then(d=>(cache=d,cache)).catch(e=>{loading=null;throw e});return loading;}

function participants(t){return [...new Set(t.moves.flatMap(m=>[m.fromOrg,m.toOrg]).filter(Boolean))]}
function date(t){if(!t.date)return t.dateText||'Date inconnue';const [y,m,d]=t.date.split('-');return `${d}/${m}/${y}`}
function logo(id){const t=teamById[id];return t?`<img class="tr-team-logo" src="logos/${escape(t[2])}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
function teamName(id){return teamById[id]?.[1]||id}
function card(t){let ids=participants(t);return `<article class="tr-card"><div class="tr-card-head"><div><span class="tr-number">TRANSACTION Nº ${escape(t.id)}</span> <span class="tr-date">${escape(date(t))} · ${escape(t.season||'')}</span></div>${ids.length>2?'<span class="tr-three">Échange à '+ids.length+' équipes</span>':''}</div><div class="tr-columns">${ids.map(id=>{let received=t.moves.filter(m=>m.toOrg===id);const historicName=received[0]?.to||t.moves.find(m=>m.fromOrg===id)?.from||teamName(id);return `<section class="tr-side"><h4>${historicalLogo(historicName,id)}<span>${escape(historicName)}</span></h4><div class="tr-received">Reçoit</div>${received.length?`<ul>${received.map(m=>`<li><strong>${escape(m.asset)}</strong>${m.position?` <small>(${escape(m.position)})</small>`:''}<span class="tr-from">de ${historicalLogo(m.from,m.fromOrg)}${escape(m.from)}</span></li>`).join('')}</ul>`:'<p class="tr-empty">Aucun élément reçu indiqué</p>'}</section>`}).join('')}</div></article>`}
function mount(el,options={}){if(!el)return;let page=1,perPage=20,data=[],query='',season='',team=options.team||'',state={};const compact=!!options.team;
 el.innerHTML=`<div class="tr-filters"><input class="tr-search" type="search" aria-label="Rechercher une transaction, un joueur ou une équipe" placeholder="Rechercher un joueur, une équipe ou un nº…"><select class="tr-season" aria-label="Saison"><option value="">Toutes les saisons</option></select>${compact?'':`<select class="tr-team" aria-label="Équipe"><option value="">Toutes les équipes</option>${teams.map(t=>`<option value="${escape(t[0])}">${escape(t[1])}</option>`).join('')}</select>`}</div><div class="tr-count" aria-live="polite">Chargement des transactions…</div><div class="tr-results"></div><div class="tr-pages"></div>`;
 const $=s=>el.querySelector(s);function draw(){let list=data.filter(t=>(!season||t.season===season)&&(!team||participants(t).includes(team))&&(!query||[t.id,t.season,...t.moves.flatMap(m=>[m.asset,m.from,m.to,m.position])].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)));const max=Math.max(1,Math.ceil(list.length/perPage));page=Math.min(page,max);$('.tr-count').textContent=`${list.length} transaction${list.length>1?'s':''}${team?' pour cette organisation':''}`;$('.tr-results').innerHTML=list.slice((page-1)*perPage,page*perPage).map(card).join('')||'<div class="tr-noresults">Aucune transaction trouvée.</div>';$('.tr-pages').innerHTML=max>1?`<button type="button" data-dir="-1" ${page===1?'disabled':''}>Précédent</button><span>Page ${page} sur ${max}</span><button type="button" data-dir="1" ${page===max?'disabled':''}>Suivant</button>`:'';$('.tr-pages').querySelectorAll('button').forEach(b=>b.onclick=()=>{page+=Number(b.dataset.dir);draw();el.scrollIntoView({block:'start',behavior:'smooth'})})}
 $('.tr-search').oninput=e=>{query=e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();page=1;draw()};$('.tr-season').onchange=e=>{season=e.target.value;page=1;draw()};if(!compact)$('.tr-team').onchange=e=>{team=e.target.value;page=1;draw()};
 load().then(t=>{if(!el.isConnected)return;data=t;const seasons=[...new Set(t.map(x=>x.season).filter(Boolean))].sort().reverse();$('.tr-season').insertAdjacentHTML('beforeend',seasons.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join(''));draw()}).catch(e=>{$('.tr-count').textContent='Impossible de charger les transactions : '+e.message});}
window.BHLTrades={mount,load,teams};
})();
