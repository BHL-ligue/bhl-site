(()=>{
'use strict';
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
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const logo=n=>LOGOS[norm(n)]?'<img src="logos/'+LOGOS[norm(n)]+'" alt="" loading="lazy">':'';
const fmt=n=>Number(n).toLocaleString('fr-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
let data,records=[];
function renderSeason(){
 const s=data.seasons.find(x=>x.season===$('season').value);if(!s)return;
 const url=new URL(location.href);url.searchParams.set('saison',s.season);history.replaceState(null,'',url);
 document.dispatchEvent(new CustomEvent('bhl:playoff-season',{detail:{season:s.season}}));
 $('season-result').innerHTML='<div class="season-heading '+(s.cancelled?'covid':'')+'"><strong>'+esc(s.cancelled?'2019-20 · Séries interrompues':s.season+' · '+s.champion)+'</strong><p>'+esc(s.cancelled?'Arrêt en deuxième ronde en raison de la COVID-19. Aucune troisième ronde et aucun champion.':'Champion de la Coupe Béliveau')+'</p></div>';
 const final=s.rounds.find(r=>r.number===3)?.matches[0];
 if(final&&!s.cancelled){const winner=final.teams.find(t=>t.id===final.winner),runner=final.teams.find(t=>t.id!==final.winner);if(winner&&runner)$('season-result').querySelector('p').innerHTML=logo(winner.name)+' '+esc(winner.name)+' · '+fmt(winner.score)+' — '+fmt(runner.score)+' · '+logo(runner.name)+' '+esc(runner.name)}
 const rounds=s.rounds.filter(r=>!s.cancelled||r.number<=2);
 if(!rounds.length){$('bracket').innerHTML='<p class="empty">Les affrontements de cette saison ne sont pas disponibles pour le moment. Le champion et sa bannière figurent dans les archives ci-dessous.</p>';return}
 // Arrange each previous round underneath its actual next-round opponent.
 const ordered=rounds.map(r=>({...r,matches:[...r.matches]}));
 for(let i=ordered.length-2;i>=0;i--){const next=ordered[i+1].matches.flatMap(m=>m.teams.map(t=>t.id));ordered[i].matches.sort((a,b)=>{const rank=m=>Math.min(...m.teams.map(t=>{const j=next.indexOf(t.id);return j<0?999:j}));return rank(a)-rank(b)})}
 const date=d=>d?new Date(d).toLocaleDateString('fr-CA',{day:'numeric',month:'short'}):'';
 $('bracket').innerHTML='<div class="bracket">'+ordered.map(r=>'<section class="round"><h3>'+esc(r.number===3?'Finale · Coupe Béliveau':'Ronde '+r.number)+'</h3><p class="note" style="margin:0 0 16px">'+esc(date(r.start)+(r.end?' — '+date(r.end):''))+'</p><div class="duels">'+r.matches.map(m=>'<div class="duel">'+m.teams.map(t=>'<div class="team '+(!s.cancelled||r.number===1?m.winner===t.id?'winner':'':'')+'">'+logo(t.name)+'<span class="name">'+esc(t.name)+'</span><span class="score">'+fmt(t.score)+'</span></div>').join('')+'<small>'+esc(r.interrupted?'Ronde interrompue · pointages archivés, sans résultat final':'FPTS · pointages officiels Fantrax')+'</small></div>').join('')+'</div></section>').join('')+(s.cancelled?'<section class="round"><h3>Troisième ronde</h3><div class="duels"><div class="empty">Non disputée<br><b>Aucun champion en 2019-20</b></div></div></section>':'')+'</div>';
}
function renderRecords(){const title=$('record').value;const rows=records.find(s=>s.title===title)?.entries||[];$('records').innerHTML=rows.length?'<table><thead><tr><th>Rang</th><th>Organisation</th><th>'+esc($('record').selectedOptions[0].text)+'</th></tr></thead><tbody>'+[...rows].sort((a,b)=>Number(b.value)-Number(a.value)||a.team.localeCompare(b.team,'fr')).map((r,i,all)=>'<tr><td>'+ (all.findIndex(x=>Number(x.value)===Number(r.value))+1)+'</td><td><span class="org">'+logo(r.team)+esc(r.team)+'</span></td><td>'+esc(r.value)+'</td></tr>').join('')+'</tbody></table>':'<p class="empty">Palmarès indisponible pour le moment.</p>'}
async function start(){
 try{const response=await fetch('data/playoffs.json',{cache:'no-store'});if(!response.ok)throw Error('Archives indisponibles');data=await response.json();
 const champions=data.seasons.filter(s=>s.champion);$('summary').innerHTML=[[data.seasons.length,'saisons historiques'],[champions.length,'Coupes Béliveau attribuées'],[new Set(champions.map(s=>s.champion)).size,'organisations championnes']].map(([n,l])=>'<div class="stat"><strong>'+n+'</strong><span>'+l+'</span></div>').join('');
 $('season').innerHTML=data.seasons.map(s=>'<option value="'+esc(s.season)+'">'+esc(s.season)+'</option>').join('');$('season').disabled=false;
 const requested=new URL(location.href).searchParams.get('saison');if(data.seasons.some(s=>s.season===requested))$('season').value=requested;
 $('banner-wall').innerHTML=champions.map(s=>'<article class="banner-card"><img src="'+esc(s.banner)+'" alt="Bannière des champions '+esc(s.season)+' — '+esc(s.champion)+'" loading="lazy"><strong>'+esc(s.season)+'</strong><span>'+esc(s.champion)+'</span><button type="button" data-season="'+esc(s.season)+'">Voir le parcours →</button></article>').join('');
 $('banner-wall').addEventListener('click',e=>{const b=e.target.closest('[data-season]');if(b){$('season').value=b.dataset.season;renderSeason();$('season').scrollIntoView({behavior:'smooth',block:'center'})}});
 $('source').textContent=data.source||'Archives officielles BHL et affrontements Fantrax.';$('season').addEventListener('change',renderSeason);renderSeason();
 }catch(e){$('season-result').textContent='Impossible de charger les archives. Réessayez dans quelques instants.'}
 try{const r=await fetch('bhl-records-data.json');if(!r.ok)throw Error();records=(await r.json()).find(g=>g.sheet==='Recordsv4')?.sections||[];renderRecords()}catch(e){$('records').textContent='Impossible de charger le palmarès.'}
 $('record').addEventListener('change',renderRecords);
}
function selectTab(id,focus=false){
 for(const name of ['bracket','scorers']){const active=name===id,button=$('tab-'+name);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$(name==='bracket'?'panel-bracket':'playoff-scorers').hidden=!active;if(active&&focus)button.focus()}
 if(id==='scorers')document.dispatchEvent(new Event('bhl:playoff-scorers-open'));
}
for(const name of ['bracket','scorers']){
 const button=$('tab-'+name);button.addEventListener('click',()=>selectTab(name));
 button.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectTab(e.key==='Home'?'bracket':e.key==='End'?'scorers':name==='bracket'?'scorers':'bracket',true)}});
}
start();
})();
