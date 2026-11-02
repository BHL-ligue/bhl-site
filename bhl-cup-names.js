/* Noms sur la Coupe Béliveau — lecture en direct de BELIVEAUCUPNAMES */
(()=>{
 const API='https://script.google.com/macros/s/AKfycbyhz6nFb1gR_JiNF6VLl_8q-nUjo7OkbB9hNqSzZVdc4n_hZhUKQ3aTu3YqGTJCrjARiQ/exec';
 const BANNERS={'2019':'BannerMIN2019.png','2021':'BannerNSH2021.png','2022':'BannerMTL2022.png','2023':'BannerHAR2023.png','2024':'BannerANA2024.png','2025':'BannerDET2025.png','2026':'BannerOTT2026.png'};
 const TEAMS=[
  ['ANA','ANAHEIM','anaheim-mightyducks.png','#c65a19','#173c4b'],
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
  ['MTL','MONTREAL','montreal-canadiens.png','#af1e2d','#192f6b'],
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
  const entry=TEAMS.find(t=>n===t[0]||n===t[1]||n.startsWith(t[1]+' ')||n.includes(' '+t[1]+' '));
  return entry||[null,null,null,'#cc0000','#292d37'];
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
  $('cup-blocks').innerHTML=groups.map(g=>{
   const t=teamInfo(g.team),year=(g.season.match(/\d{4}/g)||[]).at(-1)||'';
   const banner=BANNERS[year]&&BANNERS[year].toUpperCase().includes('BANNER'+(t[0]||'')+year)?BANNERS[year]:null;
   const logo=t[2]?'<img class="cup-team-logo" src="logos/'+esc(t[2])+'" alt="" onerror="this.style.display=\'none\'">':'';
   const art=banner?'<img class="cup-banner" src="banners/'+esc(banner)+'" alt="Bannière des champions '+esc(g.season)+'" onerror="this.style.display=\'none\'">':'<img class="cup-banner cup-banner-fallback" src="trophies/coupe-beliveau.png" alt="Coupe Béliveau" onerror="this.style.display=\'none\'">';
   const people=g.people.map((p,i)=>'<tr><td class="cup-index">'+(i+1)+'</td><td>'+esc(p.player)+'</td><td class="cup-role">'+esc(p.role||'Joueur')+'</td></tr>').join('');
   return '<article class="cup-block" style="--cup-primary:'+t[3]+';--cup-secondary:'+t[4]+'"><div class="cup-block-head">'+logo+'<div class="cup-team-title"><span>CHAMPIONS · '+esc(g.season)+'</span><h2>'+esc(g.team)+'</h2><small>'+g.people.length+' noms inscrits</small></div>'+art+'</div><div class="cup-table-wrap"><table class="cup-table"><thead><tr><th>#</th><th>Nom sur la coupe</th><th>Rôle</th></tr></thead><tbody>'+people+'</tbody></table></div></article>';
  }).join('')||'<p class="empty">Aucun nom trouvé dans BELIVEAUCUPNAMES.</p>';
 }
 async function activate(){
  $('cup-view').hidden=false;$('trophy-view').hidden=true;
  $('cup-tab').setAttribute('aria-selected','true');$('trophy-tab').setAttribute('aria-selected','false');
  if(loaded)return;
  $('cup-count').textContent='Chargement des noms sur la Coupe Béliveau…';
  try{render(await jsonp());loaded=true}catch(e){$('cup-count').textContent='Impossible de charger BELIVEAUCUPNAMES : '+e.message}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  $('cup-tab')?.addEventListener('click',activate);
  $('trophy-tab')?.addEventListener('click',()=>{$('cup-view').hidden=true;$('trophy-view').hidden=false;$('cup-tab').setAttribute('aria-selected','false');$('trophy-tab').setAttribute('aria-selected','true')});
 });
})();
