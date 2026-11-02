/* Shared Fantrax widgets; historical Google Sheets data remains independent. */
(()=>{
'use strict';
const root=document.querySelector('[data-fantrax-team], [data-fantrax-home]');
if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'—':Number(v).toLocaleString('fr-CA',{maximumFractionDigits:2});
const names={ANAHEIM:'Anaheim Mighty Ducks',ATLANTA:'Atlanta Thrashers',CALIFORNIE:'California Golden Seals',CHICAGO:'Chicago Blackhawks',CLEVELAND:'Boston Bruins',COLORADO:'Colorado Avalanche',DETROIT:'Detroit Red Wings',FLORIDA:'Florida Panthers',HARTFORD:'Hartford Whalers',MINNESOTA:'Minnesota North Stars',MONTREAL:'Montréal Canadiens',NASHVILLE:'Nashville Predators',NEWYORK:'New York Rangers',OTTAWA:'Ottawa Senators','QUÉBEC':'Québec Nordiques',TORONTO:'Toronto Maple Leafs'};
const states={ACTIVE:'Actif',RESERVE:'Banc',INJURED_RESERVE:'Blessés',MINORS:'Mineures'};
let snapshot=null,sheet=window.bhlFantraxSheet||'MONTREAL';
const norm=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function stamp(){
 const age=Date.now()-Date.parse(snapshot.updatedAt);
 return '<p class="bhl-ft-note'+(age>12*3600000?' bhl-ft-stale':'')+'">Mise à jour : '+esc(new Date(snapshot.updatedAt).toLocaleString('fr-CA',{timeZone:'America/Toronto'}))+' · heure de Montréal'+(age>12*3600000?' · Données anciennes, dernière version disponible.':'')+'</p>';
}
function game(m){return '<article class="bhl-ft-game">'+[m.away,m.home].map(t=>'<div><span>'+esc(t.teamName)+'</span><strong>'+fmt(t.score)+'</strong></div>').join('')+'</article>'}
function draw(){
 if(!snapshot)return;
 if(root.hasAttribute('data-fantrax-home')){
 root.innerHTML='<div class="bhl-ft-heading"><h2>Les scores de la semaine <small>· période '+esc(snapshot.scoringPeriod)+'</small></h2><a href="bhl-fantrax.html">Toute la saison →</a></div>'+stamp()+'<div class="bhl-ft-strip" tabindex="0" aria-label="Scores des affrontements; défilement horizontal">'+snapshot.matchups.map(game).join('')+'</div>';
 return;
 }
 const team=snapshot.teams.find(t=>t.name===names[sheet]);
 if(!team){root.innerHTML='<h3>Saison Fantrax</h3><p>Données indisponibles pour cette organisation.</p>';return}
 const standing=snapshot.standings.find(t=>t.teamId===team.id)||{};
 const games=snapshot.matchups.filter(m=>m.away.teamId===team.id||m.home.teamId===team.id);
 root.innerHTML='<div class="bhl-ft-heading"><h3>Saison en cours · Fantrax</h3><a href="bhl-fantrax.html">Classement complet →</a></div>'+stamp()+
 '<div class="bhl-ft-stats">'+[['Rang Fantrax',standing.rank==null?'—':'#'+standing.rank],['Fiche V-D-N',standing.points||'—'],['Points fantasy pour',fmt(standing.totalPointsFor)]].map(([label,value])=>'<div><span>'+label+'</span><strong>'+esc(value)+'</strong></div>').join('')+'</div>'+
 '<h4>Affrontements · période '+esc(snapshot.scoringPeriod)+'</h4><div class="bhl-ft-games">'+(games.map(game).join('')||'<p>Aucun affrontement pour cette période.</p>')+'</div>'+
 '<details class="bhl-ft-details"><summary>Effectif Fantrax · période '+esc(snapshot.rosterPeriod)+' · '+team.players.length+' joueurs</summary><div class="bhl-ft-controls"><label>Rechercher un joueur<input data-ft-search type="search" placeholder="Nom du joueur"></label><label>Statut<select data-ft-status><option value="">Tous</option>'+Object.entries(states).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label></div><p data-ft-count class="bhl-ft-note"></p><div class="bhl-ft-table" data-ft-roster></div></details>';
 const search=root.querySelector('[data-ft-search]'),status=root.querySelector('[data-ft-status]');
 const roster=()=>{
 const rows=team.players.filter(p=>norm(p.name).includes(norm(search.value))&&(!status.value||p.status===status.value)).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 root.querySelector('[data-ft-count]').textContent=rows.length+' joueur(s)';
 root.querySelector('[data-ft-roster]').innerHTML='<table><thead><tr><th>Joueur</th><th>Position</th><th>Statut</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+esc(p.position)+'</td><td>'+esc(states[p.status]||p.status)+'</td></tr>').join('')+(rows.length?'':'<tr><td colspan="3">Aucun résultat.</td></tr>')+'</tbody></table>';
 };
 search.addEventListener('input',roster);status.addEventListener('change',roster);roster();
}
window.addEventListener('bhl:team-change',e=>{sheet=e.detail;draw()});
fetch('data/fantrax.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Chargement indisponible');return r.json()}).then(data=>{
 if(!Array.isArray(data.teams)||!Array.isArray(data.standings)||!Array.isArray(data.matchups)||!Number.isFinite(Date.parse(data.updatedAt)))throw Error('Données invalides');
 snapshot=data;draw();
}).catch(()=>{root.innerHTML='<p class="bhl-ft-note">Les données Fantrax sont temporairement indisponibles. <a href="bhl-fantrax.html">Consulter la saison →</a></p>'});
})();