'use strict';
let DATA,year,tab='standings',selectedTeam=null;
let liveEdition={year:2027,teams:[]},liveUpdatedAt=null,liveLoadError='',liveLoading=false;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const edition=()=>year===2027?liveEdition:DATA.editions.find(e=>e.year===year);
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const logo=t=>`<img src="${esc(t.logo)}" alt="${esc(t.name)}">`;
const teamLink=t=>`<button class="team-link" data-team="${t.id}">${logo(t)}<span>${esc(t.name)}</span></button>`;
const playerLink=p=>`<button class="player-link" data-player="${esc(p.name)}">${esc(p.name)}</button>`;
const icon=(p,k)=>p[k]?`<img class="cell-icon" src="${DATA.images[p[k]]}" alt="${k==='countryImage'?'Pays':'Organisation LNH'} indiqué dans le PDF">`:'—';
const table=(headers,rows,cls='')=>`<div class="panel table-scroll"><table class="${cls}"><thead><tr>${headers.map(h=>`<th class="${h[1]||''}" scope="col">${h[0]}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const head=(title,note)=>`<div class="section-head"><div><h2>${title}</h2><p>${note}</p></div></div>`;
function render(){
 const e=edition();$('#status').textContent=`Édition ${year} · 9 équipes · 90 joueurs · Archives des documents BHL`;
 $('#podium').innerHTML=e.teams.slice(0,3).map((t,i)=>`<article class="podium-card ${i===0?'gold':''}">${logo(t)}<div><span class="medal">${['OR · CHAMPION','ARGENT','BRONZE'][i]}</span><h2>${esc(t.name)}</h2><p>${esc(t.manager)}</p><div class="score">${t.points} <small>POINTS</small></div></div></article>`).join('');
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));});
 const c=$('#content');
 if(tab==='standings')c.innerHTML=head('Le classement',`Résultats de l’édition ${year}. L’ordre des égalités respecte le PDF.`)+table([['Rang'],['Équipe','team-col'],['Directeur général','manager-col'],['PJ cumulés'],['Points']],e.teams.map(t=>`<tr><td class="rank">${String(t.rank).padStart(2,'0')}${t.rank<4?'<i class="medal-dot"></i>':''}</td><td class="team-col">${teamLink(t)}</td><td class="manager manager-col">${esc(t.manager)}</td><td>${t.gp}</td><td class="pts">${t.points}</td></tr>`))+`<p class="note">PJ cumulés : somme des matchs joués par les dix joueurs de l’effectif. Source : PDF ${year}, page 3.</p>`;
 if(tab==='teams')selectedTeam?renderTeam(selectedTeam):c.innerHTML=head('Les neuf nations',`Découvrez les effectifs de ${year}.`)+`<div class="team-grid">${e.teams.map(t=>`<button class="team-card" data-team="${t.id}">${logo(t)}<div><h3>${esc(t.name)}</h3><p>${esc(t.manager)}</p><b>${t.rank}${t.rank===1?'er':'e'} · ${t.points} points →</b></div></button>`).join('')}</div>`;
 if(tab==='players'){c.innerHTML=head('Les pointeurs',`Les 90 joueurs de l’édition ${year}, gardiens inclus.`)+`<div class="filters"><label>Recherche<input id="player-search" type="search" placeholder="Nom du joueur"></label><label>Équipe<select id="team-filter"><option value="">Toutes les équipes</option>${e.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><label>Position<select id="role-filter"><option value="">Toutes</option><option value="ATT">Attaquants</option><option value="DEF">Défenseurs</option><option value="GAR">Gardiens</option></select></label><label>Classer par<select id="sort-filter"><option value="points">Points</option><option value="gp">Matchs joués</option><option value="name">Nom</option></select></label></div><div id="player-results"></div>`;renderPlayers();}
 if(tab==='history')renderHistory();
 if(tab==='rules')c.innerHTML=head('Le fonctionnement du pool','Règles communes et précisions propres aux éditions.')+`<div class="rules-grid"><article class="rule"><span class="number">01 · EFFECTIF</span><h3>Dix joueurs, tous comptent.</h3><p><strong>6 attaquants, 3 défenseurs et 1 gardien</strong> par équipe. Tous les joueurs contribuent au total.</p></article><article class="rule"><span class="number">02 · POINTAGE</span><h3>Le format traditionnel.</h3><p>Un point de joueur = <strong>1 point au pool</strong>, pour les patineurs comme les gardiens.</p><p>Victoire d’un gardien : <strong>2 points</strong>.<br>Blanchissage : <strong>3 points</strong>.</p><p>Les PTS du document sont conservés, notamment les éventuels points offensifs des gardiens.</p></article><article class="rule"><span class="number">03 · CONTINUITÉ</span><h3>Un pool « full keeper ».</h3><p>Tous les joueurs sont conservés. Les documents 2025 et 2026 précisent qu’un joueur peut être libéré avant le repêchage.</p></article><article class="rule"><span class="number">04 · REPÊCHAGE</span><h3>Une relève chaque année.</h3><p>Le repêchage annuel comble les places disponibles. L’ordre suit le <strong>classement inversé de l’année précédente</strong>.</p><p>Les documents 2025 et 2026 mentionnent un « slow draft ». La fin de ce paragraphe est partiellement masquée dans les PDF.</p></article><article class="rule"><span class="number">05 · HONNEURS</span><h3>Trois marches sur le podium.</h3><p>Les trois premières équipes reçoivent l’or, l’argent et le bronze. Ces honneurs comptent dans les trophées, les finalistes et le classement du Prestige BHL.</p></article><article class="rule"><span class="number">06 · ARCHIVES</span><h3>Les résultats du pool font foi.</h3><p>Les classements et statistiques proviennent exclusivement des PDF transmis par la ligue. Les totaux ne sont pas remplacés par ceux d’une autre compétition ou d’une base LNH.</p></article></div>`;
 if(tab==='sources')c.innerHTML=head('Les documents de référence','Trois éditions intégrées. Chaque effectif conserve sa page source.')+`<div class="documents">${DATA.editions.map(e=>`<article class="document"><h3>Édition ${e.year}</h3><p>${esc(e.sourceFile)}</p><p>12 pages · Règlements : page 2 · Classement : page 3 · Effectifs : pages 4 à 12.</p><p>90 joueurs importés. Sommes des PJ et des points vérifiées pour les neuf équipes.</p>${e.documentUrl?`<a class="back" href="${esc(e.documentUrl)}" download="${esc(e.sourceFile)}">Télécharger le PDF original ↓</a>`:''}</article>`).join('')}</div><p class="note">Les drapeaux et les logos LNH des fiches sont repris des PDF et représentent l’information au moment du document. Les logos des équipes du pool proviennent du dossier logos du site BHL.</p>`;
}
function roster(players,goalie){return table([['Joueur','name-col'],['Pays'],['Position'],['PJ'],[goalie?'V':'B'],[goalie?'BL':'P'],['PTS'],['Naissance'],['Taille'],['Poids (lb)'],['LNH']],players.map(p=>`<tr><td class="name-col">${playerLink(p)}</td><td>${icon(p,'countryImage')}</td><td>${esc(p.position)}</td><td>${p.gp}</td><td>${goalie?p.wins:p.goals}</td><td>${goalie?p.shutouts:p.assists}</td><td class="pts">${p.points}</td><td>${p.birthYear}</td><td>${esc(p.height)}</td><td>${p.weight}</td><td>${icon(p,'nhlImage')}</td></tr>`),'roster');}
function renderTeam(id){const t=edition().teams.find(t=>t.id===id);if(!t)return;const m=t.medalsAsPrinted;$('#content').innerHTML=`<button class="back" data-back>← Les neuf équipes</button><header class="team-hero">${logo(t)}<div><p class="eyebrow">ÉDITION ${year} · ${t.rank}${t.rank===1?'ER':'E'} AU CLASSEMENT</p><h2>${esc(t.name)}</h2><p>${esc(t.manager)}</p><div class="chips"><span class="chip">${t.points} points</span><span class="chip">${t.gp} PJ cumulés</span><span class="chip">10 joueurs</span></div></div></header><h3 class="subhead">Patineurs</h3>${roster(t.players.filter(p=>p.role!=='GAR'),false)}<h3 class="subhead">Gardien</h3>${roster(t.players.filter(p=>p.role==='GAR'),true)}<p class="note">Source : document ${year}, page ${t.sourcePage}. « AGE » dans le PDF correspond à l’année de naissance.</p><p class="note">Médailles indiquées dans cette fiche : ${m.gold} or · ${m.silver} argent · ${m.bronze} bronze · ${m.total} au total. Ce relevé est conservé tel qu’imprimé; le palmarès de cette section est calculé séparément à partir des classements 2024–2026.</p>`;}
function renderPlayers(){const q=norm($('#player-search').value),team=$('#team-filter').value,role=$('#role-filter').value,sort=$('#sort-filter').value;let rows=edition().teams.flatMap(t=>t.players.map(p=>({...p,team:t}))).filter(p=>(!q||norm(p.name).includes(q))&&(!team||p.team.id===team)&&(!role||p.role===role));rows.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'fr'):b[sort]-a[sort]||a.name.localeCompare(b.name,'fr'));$('#player-results').innerHTML=`<p class="note">${rows.length} joueur${rows.length>1?'s':''} · Classement par ${sort==='gp'?'PJ':sort==='name'?'nom':'points'}</p>`+table([['Rang'],['Joueur','name-col'],['Équipe','team-col'],['Pos.'],['PJ'],['PTS']],rows.map((p,i)=>`<tr><td class="rank">${i+1}</td><td class="name-col">${playerLink(p)}</td><td class="team-col">${teamLink(p.team)}</td><td>${p.role}</td><td>${p.gp}</td><td class="pts">${p.points}</td></tr>`))+(!rows.length?'<p class="empty">Aucun joueur pour ces filtres.</p>':'');}
function renderHistory(){let totals=new Map();for(const e of DATA.editions)for(const t of e.teams){if(!totals.has(t.id))totals.set(t.id,{...t,gold:0,silver:0,bronze:0,total:0,totalPoints:0});let r=totals.get(t.id);r.totalPoints+=t.points;if(t.rank<=3){r[['gold','silver','bronze'][t.rank-1]]++;r.total++;}}const ranks=[...totals.values()].sort((a,b)=>b.gold-a.gold||b.silver-a.silver||b.bronze-a.bronze||b.totalPoints-a.totalPoints);$('#content').innerHTML=head('Les éditions, les champions','Palmarès calculé uniquement sur les trois éditions transmises : 2024, 2025 et 2026.')+`<div class="history-grid">${DATA.editions.map(e=>`<article class="year-card"><p class="eyebrow">LE PODIUM</p><h3>${e.year}</h3>${e.teams.slice(0,3).map((t,i)=>`<div class="team-link">${logo(t)}<span>${['🥇','🥈','🥉'][i]} ${esc(t.name)}</span><small>${t.points} pts</small></div>`).join('')}</article>`).join('')}</div><h3 class="subhead">Le tableau des médailles · 2024–2026</h3>`+table([['Équipe','team-col'],['Or'],['Argent'],['Bronze'],['Total'],['Points cumulés']],ranks.map(t=>`<tr><td class="team-col">${teamLink(t)}</td><td>${t.gold}</td><td>${t.silver}</td><td>${t.bronze}</td><td class="pts">${t.total}</td><td>${t.totalPoints}</td></tr>`))+`<p class="note">Les compteurs présents dans les fiches PDF peuvent refléter une mise à jour différente. Ici, chaque médaille est attribuée au podium du classement final de son édition.</p>`;}
function showPlayer(name){const appearances=DATA.editions.flatMap(e=>e.teams.flatMap(t=>t.players.filter(p=>norm(p.name)===norm(name)).map(p=>({p,t,year:e.year}))));$('#player-detail').innerHTML=`<p class="eyebrow">FICHE MONDIAL JUNIOR</p><h2>${esc(name)}</h2><p class="note">Présences sous ce nom dans les trois documents fournis.</p><div class="profile-years">${appearances.map(({p,t,year})=>`<article class="profile-year"><strong>${year} · ${esc(t.name)}</strong><p>${esc(p.position)} · ${p.birthYear} · ${esc(p.height)} · ${p.weight} lb</p><p>${p.gp} PJ · ${p.role==='GAR'?`${p.wins} victoires · ${p.shutouts} blanchissages`:`${p.goals} buts · ${p.assists} passes`}</p><b>${p.points} points au pool</b><p>PDF ${year} · page ${p.sourcePage}</p></article>`).join('')}</div>`;$('#player-dialog').showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!DATA)return;if(b.dataset.tab){tab=b.dataset.tab;selectedTeam=null;render();}else if(b.dataset.team){selectedTeam=b.dataset.team;tab='teams';render();}else if(b.hasAttribute('data-back')){selectedTeam=null;render();}else if(b.dataset.player)showPlayer(b.dataset.player);else if(b.classList.contains('close'))$('#player-dialog').close();});
document.addEventListener('input',e=>{if(e.target.id==='player-search')renderPlayers();});document.addEventListener('change',e=>{if(e.target.id==='year'){year=Number(e.target.value);selectedTeam=null;render();}else if(['team-filter','role-filter','sort-filter'].includes(e.target.id))renderPlayers();});
(async()=>{try{DATA=window.WJC_DRAFT_DATA||await fetch('data/wjc.json').then(r=>{if(!r.ok)throw Error();return r.json();});year=2027;tab='teams';$('#year').innerHTML=[{year:2027},...DATA.editions].map(e=>`<option value="${e.year}">${e.year}</option>`).join('');setupEditionTabs();prepareLiveEdition([]);render();refreshPublicRosters();}catch(e){$('#status').textContent='Les archives ne peuvent pas être chargées. Utilisez l’aperçu autonome ou un serveur local.';console.error(e);}})();


const allAppearances=()=>DATA.editions.flatMap(e=>e.teams.flatMap(t=>t.players.map(p=>({...p,team:t,year:e.year}))));
const playerKey=p=>norm(p.name).replace(/[^a-z0-9]/g,'')+'|'+p.birthYear;
const cumulative=()=>{const m=new Map();for(const p of allAppearances()){const k=playerKey(p);if(!m.has(k))m.set(k,{...p,gp:0,points:0,appearances:0});const r=m.get(k);r.gp+=p.gp;r.points+=p.points;r.appearances++;}return [...m.values()].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'fr'));};
const baseRender=render;
let restoredInitialState=false;
render=function(){if(!restoredInitialState){restoredInitialState=true;const params=new URLSearchParams(location.hash.slice(1));const y=Number(params.get('edition'));if(y===2027||DATA.editions.some(e=>e.year===y)){year=y;$('#year').value=y;}const section=params.get('section');if(['standings','teams','players','history','records','rules','sources'].includes(section))tab=section;const id=params.get('equipe');if(id&&edition().teams.some(t=>t.id===id)){selectedTeam=id;tab='teams';}}if(year===2027){renderUpcoming();syncPublicHash();return;}$('#podium').hidden=false;document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab==='standings')b.textContent='Classement';if(b.dataset.tab==='players')b.textContent='Pointeurs';});baseRender();updateEditionTabs();const e=edition();
 $('#status').textContent=`Édition ${year} · ${e.teams.length} équipes · ${e.teams.reduce((n,t)=>n+t.players.length,0)} joueurs`;
 document.querySelectorAll('.podium-card h2').forEach((h,i)=>{h.innerHTML=`<button data-team="${e.teams[i].id}">${esc(e.teams[i].name)}</button>`;});
 let summary=$('#edition-summary');if(!summary){summary=document.createElement('section');summary.id='edition-summary';summary.className='summary-grid';summary.setAttribute('aria-label','Faits saillants de l’édition');$('#podium').after(summary);}
 const players=e.teams.flatMap(t=>t.players.map(p=>({...p,team:t}))).sort((a,b)=>b.points-a.points);const leaders=players.filter(p=>p.points===players[0].points);const gap=e.teams[0].points-e.teams[1].points;
 summary.innerHTML=`<article class="summary-card"><small>En tête des pointeurs</small><strong>${leaders.map(p=>playerLink(p)).join(' · ')}</strong><span>${players[0].points} points${leaders.length===1?' · '+esc(players[0].team.name):' · '+leaders.length+' joueurs à égalité'}</span></article><article class="summary-card"><small>Course au titre</small><strong>${gap} point${gap>1?'s':''}</strong><span>Écart entre la première et la deuxième place</span></article><article class="summary-card"><small>Points du pool</small><strong>${e.teams.reduce((n,t)=>n+t.points,0)}</strong><span>Total des neuf équipes · ${year}</span></article>`;
 if(tab==='standings'){const tr=$('#content thead tr');tr.insertAdjacentHTML('beforeend','<th scope="col">Écart</th>');$('#content tbody').querySelectorAll('tr').forEach((row,i)=>{row.insertAdjacentHTML('beforeend',`<td>${i?'−'+(e.teams[0].points-e.teams[i].points):'—'}</td>`);row.querySelector('.pts').insertAdjacentHTML('beforeend',`<div class="bar-track" aria-hidden="true"><i style="width:${100*e.teams[i].points/e.teams[0].points}%"></i></div>`);});}
 if(tab==='records')renderRecords();
 try{history.replaceState(null,'','#edition='+year+'&section='+tab+(selectedTeam?'&equipe='+selectedTeam:''));}catch{}
};
function renderRecords(){const single=allAppearances().sort((a,b)=>b.points-a.points||b.year-a.year);const totals=cumulative();const block=(title,note,rows,total)=>`<section class="record-block"><h3>${title}</h3><p>${note}</p>`+table([['Rang'],['Joueur','name-col'],[total?'Éditions':'Édition'],['PJ'],['PTS']],rows.slice(0,10).map((p,i)=>`<tr><td class="rank">${i+1}</td><td class="name-col">${playerLink(p)}</td><td>${total?p.appearances:p.year}</td><td>${p.gp}</td><td class="pts">${p.points}</td></tr>`))+'</section>';
 $('#content').innerHTML=head('Les records du Mondial junior','Top 10 calculés sur les éditions 2024 à 2026 uniquement. Les points sont ceux du pool BHL, gardiens inclus.')+'<div class="records-grid">'+block('Une édition, une performance','Les meilleures récoltes individuelles dans une seule édition.',single,false)+block('Les pointeurs cumulés','Les points additionnés sur les trois éditions disponibles.',totals,true)+'</div><p class="note">Les noms sont regroupés sans tenir compte des accents, avec vérification de l’année de naissance. Les égalités de points sont affichées sans départage sportif supplémentaire.</p>';
}
showPlayer=function(name){if(year===2027){showUpcomingPlayer(name);return;}const seed=allAppearances().find(p=>norm(p.name)===norm(name));if(!seed)return;const appearances=allAppearances().filter(p=>playerKey(p)===playerKey(seed));const pts=appearances.reduce((n,p)=>n+p.points,0),gp=appearances.reduce((n,p)=>n+p.gp,0);
 $('#player-detail').innerHTML=`<header class="profile-header">${logo(seed.team)}<div><p class="eyebrow">FICHE MONDIAL JUNIOR BHL</p><h2 id="profile-title">${esc(seed.name)}</h2></div></header><div class="chips"><span class="chip">${appearances.length} édition${appearances.length>1?'s':''}</span><span class="chip">${gp} PJ</span><span class="chip">${pts} points cumulés</span></div><h3 class="subhead">Parcours dans le pool</h3><div class="profile-years">${appearances.map(p=>`<article class="profile-year"><strong>${logo(p.team)}${p.year} · ${esc(p.team.name)}</strong><p>${esc(p.position)} · Né en ${p.birthYear} · ${esc(p.height)} · ${p.weight} lb</p><p>${p.gp} PJ · ${p.role==='GAR'?`${p.wins} victoires · ${p.shutouts} blanchissages`:`${p.goals} buts · ${p.assists} passes`}</p><b>${p.points} points au pool</b><p>Équipe : ${p.team.rank}${p.team.rank===1?'re':'e'} place${p.team.rank<=3?' · '+['Or','Argent','Bronze'][p.team.rank-1]:''} · PDF ${p.year}, page ${p.sourcePage}</p></article>`).join('')}</div>`;
 $('#player-dialog').setAttribute('aria-labelledby','profile-title');$('#player-dialog').showModal();
};
$('#player-dialog').addEventListener('click',e=>{if(e.target===$('#player-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
const initialParams=new URLSearchParams(location.hash.slice(1));
if(DATA){const initialYear=Number(initialParams.get('edition'));if(initialYear===2027||DATA.editions.some(e=>e.year===initialYear)){year=initialYear;$('#year').value=year;}const initialTab=initialParams.get('section');if(['standings','teams','players','history','records','rules','sources'].includes(initialTab))tab=initialTab;const initialTeam=initialParams.get('equipe');if(initialTeam&&edition().teams.some(t=>t.id===initialTeam)){selectedTeam=initialTeam;tab='teams';}render();}


function setupEditionTabs(){
 const nav=document.createElement('nav');
 nav.className='edition-tabs';nav.setAttribute('aria-label','Éditions du Mondial junior');
 nav.innerHTML=[2027,...DATA.editions.map(e=>e.year)].map(value=>'<button type="button" data-edition="'+value+'">'+value+'</button>').join('');
 $('.heading').after(nav);
 nav.addEventListener('click',event=>{
  const button=event.target.closest('[data-edition]');if(!button)return;
  year=Number(button.dataset.edition);$('#year').value=year;selectedTeam=null;
  if(year===2027)tab='teams';render();
 });
}
function updateEditionTabs(){
 document.querySelectorAll('[data-edition]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.edition)===year)));
}
function syncPublicHash(){
 history.replaceState(null,'','#edition='+year+'&section='+tab+(selectedTeam?'&equipe='+selectedTeam:''));
}
function prepareLiveEdition(published){
 const previous=DATA.editions.find(e=>e.year===2026);
 const known=previous.teams.flatMap(t=>t.players);
 const findOriginal=t=>previous.teams.find(old=>old.id===(t.archiveId||t.id)||norm(old.name)===norm(t.name));
 const merged=previous.teams.map(old=>published.find(t=>findOriginal(t)?.id===old.id)||{id:old.id,name:old.name,capacity:old.players.length,players:[]});
 merged.push(...published.filter(t=>!findOriginal(t)));
 liveEdition={year:2027,teams:merged.map(t=>{
  const old=findOriginal(t);
  return {...t,logo:old?.logo||'logos/BHLlogo.png',players:(t.players||[]).map(p=>{
   const original=known.find(x=>norm(x.name)===norm(p.name));
   return {...p,birthYear:p.birthYear||original?.birthYear||null,position:p.position||original?.position||'—',countryImage:original?.countryImage,role:p.position==='G'?'GAR':p.position==='D'?'DEF':'ATT'};
  })};
 })};
}
async function refreshPublicRosters(){
 if(liveLoading||!DATA)return;liveLoading=true;
 try{
  const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import('./bhl-supabase.js');
  const response=await fetch(SUPABASE_URL+'/rest/v1/bhl_wjc_public_rosters?year=eq.2027&select=payload,updated_at',{cache:'no-store',headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});
  if(!response.ok)throw Error('Alignements temporairement indisponibles');
  const rows=await response.json();if(!rows[0])throw Error('Édition 2027 en préparation');
  const changed=liveUpdatedAt!==rows[0].updated_at||!!liveLoadError;
  liveUpdatedAt=rows[0].updated_at;liveLoadError='';prepareLiveEdition(rows[0].payload.teams||[]);
  if(year===2027&&changed)render();
 }catch(error){liveLoadError=error.message;if(year===2027)render();}
 finally{liveLoading=false;}
}
function upcomingRoster(players){
 if(!players.length)return '<p class="empty">Aucun joueur prévu pour le moment.</p>';
 return table([['Joueur','name-col'],['Position'],['Naissance'],['Pays'],['Statut']],players.map(p=>'<tr><td class="name-col">'+playerLink(p)+'</td><td>'+esc(p.position)+'</td><td>'+esc(p.birthYear||'—')+'</td><td>'+(p.country?esc(p.country):icon(p,'countryImage'))+'</td><td><span class="presence-badge">'+(p.source==='draft'?'Repêché en 2027':'Retour probable')+'</span></td></tr>'),'roster');
}
function renderUpcoming(){
 const teams=liveEdition.teams,players=teams.flatMap(t=>t.players),capacity=teams.reduce((n,t)=>n+t.capacity,0);
 $('#podium').hidden=true;
 let summary=$('#edition-summary');if(!summary){summary=document.createElement('section');summary.id='edition-summary';summary.className='summary-grid';$('#podium').after(summary);}
 summary.innerHTML='<article class="summary-card"><small>Édition en préparation</small><strong>2027</strong><span>Effectifs prévisionnels de la BHL</span></article><article class="summary-card"><small>Joueurs prévus</small><strong>'+players.length+' / '+capacity+'</strong><span>'+teams.length+' équipes</span></article><article class="summary-card"><small>Places à combler</small><strong>'+Math.max(0,capacity-players.length)+'</strong><span>À compléter au repêchage</span></article>';
 $('#status').textContent=liveLoadError?'2027 · '+liveLoadError:liveUpdatedAt?'2027 · Alignements enregistrés dans le Portail Admin · actualisation automatique':'2027 · Chargement des alignements prévisionnels…';
 document.querySelectorAll('[data-tab]').forEach(b=>{
  if(b.dataset.tab==='standings')b.textContent='Vue d’ensemble';
  if(b.dataset.tab==='players')b.textContent='Alignements';
  b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));
 });
 const c=$('#content');
 if(tab==='teams'&&selectedTeam){
  const t=teams.find(t=>t.id===selectedTeam);
  if(!t){selectedTeam=null;renderUpcoming();return;}
  c.innerHTML='<button class="back" data-back>← Les équipes 2027</button><header class="team-hero">'+logo(t)+'<div><p class="eyebrow">ÉDITION 2027 · EFFECTIF EN PRÉPARATION</p><h2>'+esc(t.name)+'</h2><div class="chips"><span class="chip">'+t.players.length+' / '+t.capacity+' joueurs</span><span class="chip">'+Math.max(0,t.capacity-t.players.length)+' places à combler</span></div></div></header><h3 class="subhead">Patineurs</h3>'+upcomingRoster(t.players.filter(p=>p.role!=='GAR'))+'<h3 class="subhead">Gardiens</h3>'+upcomingRoster(t.players.filter(p=>p.role==='GAR'));
 }else if(tab==='teams'){
  c.innerHTML=head('Les équipes · 2027','Les joueurs présents sont ajoutés après enregistrement dans le Portail Admin.')+'<div class="team-grid">'+teams.map(t=>'<button class="team-card" data-team="'+esc(t.id)+'">'+logo(t)+'<div><h3>'+esc(t.name)+'</h3><p>'+t.players.length+' / '+t.capacity+' joueurs prévus</p><b>'+Math.max(0,t.capacity-t.players.length)+' places à combler →</b></div></button>').join('')+'</div>';
 }else if(tab==='players'){
  c.innerHTML=head('Les alignements prévisionnels','Retours de 2026 et sélections du repêchage 2027.')+'<div class="filters"><label>Recherche<input id="live-player-search" type="search" placeholder="Nom ou position"></label><label>Équipe<select id="live-team-filter"><option value="">Toutes les équipes</option>'+teams.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('')+'</select></label></div><div id="live-players"></div>';
  const filter=()=>{const q=norm($('#live-player-search').value),id=$('#live-team-filter').value;const rows=teams.filter(t=>!id||t.id===id).flatMap(t=>t.players.map(p=>({...p,team:t}))).filter(p=>norm(p.name+' '+p.position).includes(q));$('#live-players').innerHTML=upcomingRoster(rows);};
  $('#live-player-search').oninput=filter;$('#live-team-filter').onchange=filter;filter();
 }else if(tab==='standings'){
  c.innerHTML=head('Les effectifs se construisent','Édition 2027 en préparation.')+table([['Équipe','team-col'],['Joueurs prévus'],['Places à combler']],teams.map(t=>'<tr><td class="team-col">'+teamLink(t)+'</td><td>'+t.players.length+' / '+t.capacity+'</td><td>'+Math.max(0,t.capacity-t.players.length)+'</td></tr>'));
 }else{
  baseRender();$('#podium').hidden=true;
  document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab==='standings')b.textContent='Vue d’ensemble';if(b.dataset.tab==='players')b.textContent='Alignements';});
  if(tab==='records')renderRecords();
  $('#status').textContent='Édition 2027 · Alignements en préparation';
 }
 updateEditionTabs();
}
function showUpcomingPlayer(name){
 const t=liveEdition.teams.find(t=>t.players.some(p=>p.name===name)),p=t?.players.find(p=>p.name===name);if(!p)return;
 $('#player-detail').innerHTML='<p class="eyebrow">ÉDITION 2027 · EFFECTIF PRÉVISIONNEL</p><h2 id="profile-title">'+esc(p.name)+'</h2><div class="profile-header">'+logo(t)+'<div><strong>'+esc(t.name)+'</strong><p>'+esc(p.position)+' · Naissance '+esc(p.birthYear||'non renseignée')+'</p><span class="presence-badge">'+(p.source==='draft'?'Repêché en 2027':'Retour probable')+'</span></div></div>';
 $('#player-dialog').setAttribute('aria-labelledby','profile-title');$('#player-dialog').showModal();
}
setInterval(()=>{if(!document.hidden)refreshPublicRosters();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPublicRosters();});
