/* Shared BHL team identity and professional Fantrax score cards. */
(function(){
'use strict';
const logos={"Anaheim Mighty Ducks":"anaheim-mightyducks.png","Atlanta Thrashers":"atlanta-thrashers.png","Boston Bruins":"boston-bruins.png","California Golden Seals":"california-goldenseals.png","Chicago Blackhawks":"chicago-blackhawks.png","Colorado Avalanche":"colorado-avalanche.png","Detroit Red Wings":"detroit-redwings.png","Florida Panthers":"florida-panthers.png","Hartford Whalers":"hartford-whalers.png","Minnesota North Stars":"minnesota-northstars.png","Montréal Canadiens":"montreal-canadiens.png","Nashville Predators":"nashville-predators.png","New York Rangers":"newyork-rangers.png","Ottawa Senators":"ottawa-senators.png","Québec Nordiques":"quebec-nordiques.png","Toronto Maple Leafs":"toronto-mapleleafs.png"};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const lookup=Object.fromEntries(Object.entries(logos).map(([k,v])=>[norm(k),v]));
lookup['montreal maroons']='montreal-maroons.png';
lookup['cleveland barons']='cleveland-barons.png';
lookup['detroit cougars']='detroit-cougars.png';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function logo(name){const f=lookup[norm(name)];return f?'<img class="bhl-score-logo" src="logos/'+f+'" alt="" loading="lazy" onerror="this.hidden=true">':''}
function team(name){return '<span class="bhl-score-team">'+logo(name)+'<span>'+esc(name)+'</span></span>'}
function card(m){
 const a=m.away,h=m.home;
 const n=v=>Number(v);
 const aWin=Number.isFinite(n(a.score))&&Number.isFinite(n(h.score))&&n(a.score)>n(h.score),hWin=Number.isFinite(n(a.score))&&Number.isFinite(n(h.score))&&n(h.score)>n(a.score);
 return '<article class="bhl-score-card"><div class="bhl-score-card-top"><span>AFFRONTEMENT BHL</span><span class="bhl-score-period">FANTRAX</span></div>'+
 [a,h].map((t,i)=>'<div class="bhl-score-line'+((i===0&&aWin)||(i===1&&hWin)?' bhl-score-leading':'')+'">'+team(t.teamName)+'<strong class="bhl-score-number">'+(t.score==null?'—':Number(t.score).toLocaleString('fr-CA',{maximumFractionDigits:2}))+'</strong></div>').join('')+'</article>';
}
window.BHLScoreUI={logo,team,card};
})();