/* Noms sur la Coupe Béliveau — lecture en direct de BELIVEAUCUPNAMES */
(()=>{
 const API='https://script.google.com/macros/s/AKfycbyhz6nFb1gR_JiNF6VLl_8q-nUjo7OkbB9hNqSzZVdc4n_hZhUKQ3aTu3YqGTJCrjARiQ/exec';
 const BANNERS={'2019':'BannerMIN2019.png','2021':'BannerNSH2021.png','2022':'BannerMTL2022.png','2023':'BannerHAR2023.png','2024':'BannerANA2024.png','2025':'BannerDET2025.png','2026':'BannerOTT2026.png'};
 const TEAMS=[
  ['ANA','ANAHEIM','anaheim-mightyducks.png','#532a44','#173c4b'],
  ['ATL','ATLANTA','atlanta-thrashers.png','#0078a5','#172c4b'],
  ['CAL','CALIFORNIE','california-goldenseals.png','#08745d','#e5ad33'],
  ['CHI','CHICAGO','chicago-blackhawks.png','#c8102e','#141414'],
  ['BOS','BOSTON','boston-bruins.png','#ffb81c','#171717'],
  ['CLE','CLEVELAND','cleveland-barons.png','#d49b34','#4a2429'],
  ['COL','COLORADO','colorado-avalanche.png','#6f263d','#236192'],
  ['DET','DETROIT','detroit-redwings.png','#ce1126','#881426'],
  ['FLA','FLORIDA','florida-panthers.png','#c8102e','#041e42'],
  ['HAR','HARTFORD','hartford-whalers.png','#007a52','#12418d'],
  ['MIN','MINNESOTA','minnesota-northstars.png','#087d4a','#e1b747'],
  ['MTL','MONTREAL CANADIENS','montreal-canadiens.png','#af1e2d','#192f6b'],
  ['MAR','MONTREAL MAROONS','montreal-maroons.png','#6d1f2a','#341119'],
  ['NSH','NASHVILLE','nashville-predators.png','#ffb81c','#041e42'],
  ['NYR','NEW YORK','newyork-rangers.png','#0038a8','#ce1126'],
  ['OTT','OTTAWA','ottawa-senators.png','#c52032','#181818'],
  ['EDM','EDMONTON','edmonton-oilers.png','#ff4c00','#041e42'],
  ['QUE','QUEBEC','quebec-nordiques.png','#005eb8','#cf142b'],
  ['TOR','TORONTO','toronto-mapleleafs.png','#003e7e','#092347']
 ];
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=id=>document.getElementById(id);
 let loaded=false;
 function jsonp(){return new Promise((resolve,reject)=>{
  const cb='bhlCupList_'+Math.random().toString(36).slice(2),sc=document.createElement('script');let done=false;
  const timer=setTimeout(()=>finish(Error('Délai de connexion dépassé')),20000);
  function finish(err,rows){if(done)return;done=true;clearTimeout(timer);delete window[cb];sc.remove();err?reject(err):resolve(rows)}
  window[cb]=d=>{if(!d?.ok||!Array.isArray(d?.data?.rows))return finish(Error(d?.error||'Source BELIVEAUCUPNAMES indisponible'));finish(null,d.data.rows)};
  sc.onerror=()=>finish(Error('Impossible de joindre Google Sheets'));
  sc.src=API+'?sheet=BELIVEAUCUPNAMES&callback='+cb;document.head.append(sc);
 })}
 function teamInfo(team){
  const n=norm(team);
  const aliases={
   'MONTREAL':'MONTREAL CANADIENS','CANADIENS':'MONTREAL CANADIENS','CANADIENS DE MONTREAL':'MONTREAL CANADIENS',
   'MAROONS':'MONTREAL MAROONS','MAROONS DE MONTREAL':'MONTREAL MAROONS',
   'DETROIT RED WINGS':'DETROIT','RED WINGS DE DETROIT':'DETROIT',
   'NORTH STARS DU MINNESOTA':'MINNESOTA','MINNESOTA NORTH STARS':'MINNESOTA',
   'HARTFORD WHALERS':'HARTFORD','WHALERS DE HARTFORD':'HARTFORD',
   'NASHVILLE PREDATORS':'NASHVILLE','PREDATORS DE NASHVILLE':'NASHVILLE',
   'OTTAWA SENATORS':'OTTAWA','SENATEURS D OTTAWA':'OTTAWA',
   'ANAHEIM MIGHTY DUCKS':'ANAHEIM','MIGHTY DUCKS D ANAHEIM':'ANAHEIM',
   'NEW YORK RANGERS':'NEW YORK','RANGERS DE NEW YORK':'NEW YORK'
  };
  const canonical=aliases[n]||n;
  return TEAMS.find(t=>canonical===t[0]||canonical===t[1])||[null,null,null,'#cc0000','#292d37'];
 }
 function cupCategory(role){
  const r=norm(role);
  if(/\b(DG|DIRECTEUR GENERAL|DIRECTRICE GENERALE|GENERAL MANAGER|GERANT)\b/.test(r))return 0;
  if(/ESPOIR|PROSPECT|RELEVE|JUNIOR/.test(r))return 4;
  if(/GARDIEN|GOALIE|GOALTENDER|\\b(G|GK)\b/.test(r))return 3;
  if(/DEFENSE|DEFENSEUR|DEFENC|\\b(D|LD|RD)\b/.test(r))return 2;
  if(/ATTAQU|AVANT|FORWARD|CENTRE|AILIER|\\b(C|LW|RW|F|AG|AD)\b/.test(r))return 1;
  return 5;
 }
 const CATEGORY_NAMES=['Direction générale','Attaquants','Défenseurs','Gardiens','Espoirs','Autres membres'];
 function seasonEndYear(season){
  const m=String(season).match(/(20\\d{2})\\s*[-–/]\\s*(\\d{2,4})/);
  if(m){const y=Number(m[2]);return String(y<100?Math.floor(Number(m[1])/100)*100+y:y)}
  const years=String(season).match(/20\\d{2}/g);return years?years.at(-1):'';
 }
 function render(rows){
  const grouped=new Map();
  for(const row of rows.slice(1)){
   if(!Array.isArray(row))continue;
   const [season,team,player,role]=row.map(v=>String(v??'').trim());
   if(!season||!team||!player)continue;
   const key=season+'|'+norm(team);
   if(!grouped.has(key))grouped.set(key,{season,team,people:[],seen:new Set()});
   const g=grouped.get(key),id=norm(player);
   if(g.seen.has(id))continue;g.seen.add(id);g.people.push({player,role});
  }
  const groups=[...grouped.values()].sort((a,b)=>b.season.localeCompare(a.season)||a.team.localeCompare(b.team,'fr'));
  const count=groups.reduce((n,g)=>n+g.people.length,0);
  $('cup-count').textContent=groups.length+' équipes championnes · '+count+' noms gravés sur la coupe';
  const totals=new Map();
  for(const g of groups)for(const p of g.people){
   const id=norm(p.player);
   if(!totals.has(id))totals.set(id,{name:p.player,years:new Set(),teams:new Set(),roles:new Set()});
   const item=totals.get(id);item.years.add(g.season);item.teams.add(g.team);item.roles.add(p.role);
  }
  const ranking=[...totals.values()].map(p=>({...p,total:p.years.size})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'fr'));
  const leaders=ranking.filter(p=>p.total>1);
  const secondCup=new Map(ranking.map(p=>[norm(p.name),[...p.years].sort((a,b)=>Number(seasonEndYear(a))-Number(seasonEndYear(b))||a.localeCompare(b))[1]||null]));
  $('cup-records').innerHTML='<div class="cup-records-heading"><div><span class="cup-eyebrow">LÉGENDES DE LA COUPE</span><h2>Les noms les plus gravés</h2><p>Classement cumulatif par nombre de saisons championnes, toutes équipes confondues.</p></div><div class="cup-record-total">'+ranking.length+' noms distincts</div></div>'+
   (leaders.length?'<div class="cup-leader-grid">'+leaders.map((p,i)=>'<div class="cup-leader-card"><div class="cup-leader-rank">'+(i+1)+'</div><div class="cup-leader-main"><strong>'+esc(p.name)+'</strong><small>'+esc([...p.years].sort().reverse().join(' · '))+'</small></div><div class="cup-leader-count"><b>'+p.total+'</b><span>COUPES</span></div></div>').join('')+'</div>':'<p class="cup-record-empty">Aucun nom n’apparaît sur plusieurs saisons pour le moment.</p>');
  $('cup-blocks').innerHTML=groups.map(g=>{
   const t=teamInfo(g.team),year=seasonEndYear(g.season);
   // Banners use the same championship assets as the team overview.
   const banner=BANNERS[year]||null;
   const logo=t[2]?'<img class="cup-team-logo" src="logos/'+esc(t[2])+'" alt="" onerror="this.hidden=true">':'';
   const art=banner?'<img class="cup-banner" src="banners/'+esc(banner)+'" alt="Bannière des champions '+esc(g.season)+'" onerror="this.hidden=true">':'';
   const byCategory=new Map();
   for(const person of g.people){const category=cupCategory(person.role);if(!byCategory.has(category))byCategory.set(category,[]);byCategory.get(category).push(person)}
   const people=[...byCategory.keys()].sort((a,b)=>a-b).map(category=>{
    const entries=byCategory.get(category).sort((a,b)=>a.player.localeCompare(b.player,'fr'));
    return '<section class="cup-roster-section"><div class="cup-roster-title"><span>'+esc(CATEGORY_NAMES[category])+'</span><small>'+entries.length+'</small></div><div class="cup-name-grid">'+entries.map(p=>'<div class="cup-name-item"><span class="cup-name-mark"></span><strong>'+esc(p.player)+'</strong>'+(secondCup.get(norm(p.player))===g.season?'<span class="cup-name-tally" title="Deuxième Coupe Béliveau remportée">🏆 2</span>':'')+'</div>').join('')+'</div></section>';
   }).join('');
   return '<article class="cup-block" style="--cup-primary:'+t[3]+';--cup-secondary:'+t[4]+'"><div class="cup-block-head">'+logo+'<div class="cup-team-title"><span>CHAMPIONS · '+esc(g.season)+'</span><h2>'+esc(g.team)+'</h2><small>'+g.people.length+' noms inscrits</small></div>'+art+'</div><div class="cup-roster">'+people+'</div></article>';
  }).join('')||'<p class="empty">Aucun nom trouvé dans BELIVEAUCUPNAMES.</p>';
 }
 async function activate(){
  $('cup-view').hidden=false;$('trophy-view').hidden=true;
  $('cup-tab').setAttribute('aria-selected','true');$('trophy-tab').setAttribute('aria-selected','false');
  if(loaded)return;
  $('cup-count').textContent='Chargement des noms sur la Coupe Béliveau…';
  try{render(await jsonp());loaded=true}catch(e){$('cup-count').textContent='Impossible de charger BELIVEAUCUPNAMES : '+e.message}
 }
 function initCupTabs(){
  if(!$('cup-tab')||$('cup-tab').dataset.cupReady)return;
  $('cup-tab').dataset.cupReady='1';
  window.bhlOpenCupNames=activate;
  $('cup-tab').addEventListener('click',activate);
  $('trophy-tab')?.addEventListener('click',()=>{$('cup-view').hidden=true;$('trophy-view').hidden=false;$('cup-tab').setAttribute('aria-selected','false');$('trophy-tab').setAttribute('aria-selected','true')});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCupTabs,{once:true});
 else initCupTabs();
})();
