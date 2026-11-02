/* Shared Fantrax widgets; historical Google Sheets data remains independent. */
(()=>{
'use strict';
const root=document.querySelector('[data-fantrax-team], [data-fantrax-home]');
const rosterRoot=document.querySelector('[data-fantrax-roster]');
const calendarRoot=document.querySelector('[data-fantrax-calendar]');
if(!root&&!rosterRoot&&!calendarRoot)return;
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
function game(m){return window.BHLScoreUI?BHLScoreUI.card(m):'<article class="bhl-ft-game">'+[m.away,m.home].map(t=>'<div><span>'+esc(t.teamName)+'</span><strong>'+fmt(t.score)+'</strong></div>').join('')+'</article>'}
function draw(){
 if(!snapshot)return;
 if(!root){drawRoster();drawCalendar();return}
 if(root?.hasAttribute('data-fantrax-home')){
 root.innerHTML='<div class="bhl-ft-heading"><h2>Les scores de la semaine <small>· période '+esc(snapshot.scoringPeriod)+'</small></h2><a href="bhl-fantrax.html">Toute la saison →</a></div>'+stamp()+'<div class="bhl-ft-strip" tabindex="0" aria-label="Scores des affrontements; défilement horizontal">'+snapshot.matchups.map(game).join('')+'</div>';
 return;
 }
 const team=snapshot.teams.find(t=>t.name===names[sheet]);
 if(!team){root.innerHTML='<h3>Saison Fantrax</h3><p>Données indisponibles pour cette organisation.</p>';return}
 const standing=snapshot.standings.find(t=>t.teamId===team.id)||{};
 const games=snapshot.matchups.filter(m=>m.away.teamId===team.id||m.home.teamId===team.id);
 const recent=(snapshot.recentResults||[]).filter(m=>m.away.teamId===team.id||m.home.teamId===team.id).slice(0,3);
 const recentHtml=recent.map(m=>{const own=m.away.teamId===team.id?m.away:m.home;const opponent=m.away.teamId===team.id?m.home:m.away;const result=Number(own.score)>Number(opponent.score)?'V':Number(own.score)<Number(opponent.score)?'D':'N';return '<div class="bhl-ft-recent-item"><span class="bhl-ft-result bhl-ft-result-'+result+'">'+result+'</span><span class="bhl-ft-recent-opponent">'+(window.BHLScoreUI?BHLScoreUI.team(opponent.teamName):esc(opponent.teamName))+'</span><strong>'+fmt(own.score)+' – '+fmt(opponent.score)+'</strong><small>P'+esc(m.period)+'</small></div>';}).join('');
 root.innerHTML='<div class="bhl-ft-heading"><h3>Saison en cours · Fantrax</h3><a href="bhl-fantrax.html">Classement complet →</a></div>'+stamp()+
 '<div class="bhl-ft-team-id">'+(window.BHLScoreUI?BHLScoreUI.team(team.name):esc(team.name))+'</div><div class="bhl-ft-stats">'+[['Rang Fantrax',standing.rank==null?'—':'#'+standing.rank],['Fiche V-D-N',standing.points||'—'],['Points fantasy pour',fmt(standing.totalPointsFor)]].map(([label,value])=>'<div><span>'+label+'</span><strong>'+esc(value)+'</strong></div>').join('')+'</div>'+
 ''+
 '';
 drawRoster();drawCalendar();
}
function drawCalendar(){
 if(!calendarRoot||!snapshot)return;
 const team=snapshot.teams.find(t=>t.name===names[sheet]);
 if(!team){calendarRoot.innerHTML='<p>Calendrier indisponible.</p>';return;}
 const periods=(snapshot.schedule||[]).slice().sort((a,b)=>a.period-b.period);
 if(!periods.length){calendarRoot.innerHTML='<p class="bhl-ft-note">Le calendrier complet sera disponible après la prochaine synchronisation Fantrax.</p>';return;}
 const defaultPeriod=snapshot.scoringPeriod;
 const oldValue=calendarRoot.querySelector('[data-calendar-period]')?.value;
 const previous=oldValue===undefined?NaN:Number(oldValue);
 const current=periods.some(p=>p.period===previous)?previous:(defaultPeriod||periods[0].period);
 const date=v=>new Date(v).toLocaleDateString('fr-CA',{timeZone:'America/Toronto',month:'short',day:'numeric'});
 calendarRoot.innerHTML='<div class="bhl-ft-heading"><h3>Calendrier · saison '+esc(snapshot.season||'')+'</h3><label class="bhl-ft-calendar-picker">Période <select data-calendar-period>'+periods.map(p=>'<option value="'+p.period+'"'+(p.period===current?' selected':'')+'>Période '+p.period+' · '+date(p.startDate)+' au '+date(p.endDate)+'</option>').join('')+'</select></label></div><div data-calendar-games></div>';
 const show=()=>{
  const p=periods.find(x=>x.period===Number(calendarRoot.querySelector('[data-calendar-period]').value));
  const games=(p?.matchups||[]).filter(m=>m.away.teamId===team.id||m.home.teamId===team.id);
  calendarRoot.querySelector('[data-calendar-games]').innerHTML='<p class="bhl-ft-note">'+(p?date(p.startDate)+' au '+date(p.endDate):'')+'</p><div class="bhl-ft-games">'+(games.map(game).join('')||'<p>Aucun affrontement disponible pour cette période.</p>')+'</div>';
 };
 calendarRoot.querySelector('[data-calendar-period]').addEventListener('change',show);
 show();
}
function drawRoster(){
 if(!rosterRoot||!snapshot)return;
 const team=snapshot.teams.find(t=>t.name===names[sheet]);
 if(!team){rosterRoot.innerHTML='<p>Effectif indisponible.</p>';return}
 rosterRoot.innerHTML='<div class="bhl-ft-heading"><h3>Alignement · '+esc(snapshot.rosterPeriod)+'</h3><span>'+team.players.length+' joueurs</span></div>'+
 '<div class="bhl-ft-controls"><label>Statut<select data-ft-status><option value="">Tous</option>'+Object.entries(states).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label></div><p data-ft-count class="bhl-ft-note"></p><div class="bhl-ft-table" data-ft-roster-list></div>';
 const status=rosterRoot.querySelector('[data-ft-status]');
 const render=()=>{
  const rows=team.players.filter(p=>!status.value||p.status===status.value).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  rosterRoot.querySelector('[data-ft-count]').textContent=rows.length+' joueur(s)';
  const list=rosterRoot.querySelector('[data-ft-roster-list]');
  list.innerHTML=BHLRoster.render(rows);
  BHLRoster.photos(list);
 };
 status.addEventListener('change',render);
 render();
}
window.addEventListener('bhl:team-change',e=>{sheet=e.detail;draw()});
async function refresh(){
 try{
  const response=await fetch('data/fantrax.json',{cache:'no-store'});
  if(!response.ok)throw Error('Chargement indisponible');
  const data=await response.json();
  if(!Array.isArray(data.teams)||!Array.isArray(data.standings)||!Array.isArray(data.matchups)||!Number.isFinite(Date.parse(data.updatedAt)))throw Error('Données invalides');
  if(!snapshot||snapshot.updatedAt!==data.updatedAt){
   const previousStatus=rosterRoot?.querySelector('[data-ft-status]')?.value||'';
   window.BHLLivePlayerStats=data.playerStats||{};
   snapshot=data;draw();
   if(previousStatus&&rosterRoot){
    const select=rosterRoot.querySelector('[data-ft-status]');
    if(select){select.value=previousStatus;select.dispatchEvent(new Event('change'));}
   }
  }
 }catch(error){
  if(!snapshot){if(root)root.innerHTML='<p class="bhl-ft-note">Les données Fantrax sont temporairement indisponibles. <a href="bhl-fantrax.html">Consulter la saison →</a></p>';if(rosterRoot)rosterRoot.innerHTML='<p class="bhl-ft-note">Alignement temporairement indisponible.</p>';}
 }
}
refresh();
setInterval(()=>{if(!document.hidden)refresh()},300000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
