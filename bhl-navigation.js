/* Navigation unique sur toutes les pages BHL */
(function(){
'use strict';
function ensurePlayerProfile(){
 const needsProfile=!document.querySelector('script[src^="bhl-player-stats.js"]');
 if(!document.querySelector('link[href^="bhl-player-stats.css"]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href='bhl-player-stats.css?v=global3';document.head.append(css);
 }
 if(!document.querySelector('script[src^="bhl-trades.js"]')){
  const trades=document.createElement('script');trades.src='bhl-trades.js?v=global3';document.head.append(trades);
 }
 if(needsProfile){const script=document.createElement('script');script.src='bhl-player-stats.js?v=bhl-team-badges-20261104';document.head.append(script)}
 if(!document.querySelector('script[src^="bhl-player-links.js"]')){const links=document.createElement('script');links.src='bhl-player-links.js?v=20261104';document.head.append(links)}
}
function ensureTableVisuals(){
 if(!document.querySelector('link[href^="bhl-table-visuals.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='bhl-table-visuals.css?v=1';document.head.append(css)}
 if(!document.querySelector('script[src^="bhl-table-visuals.js"]')){const script=document.createElement('script');script.src='bhl-table-visuals.js?v=2';document.head.append(script)}
}
function mount(){
 // Icône de l'onglet du navigateur sur toutes les pages BHL.
 if(!document.querySelector('link[rel="icon"]')){const favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/png';favicon.href='logos/BHLlogo.png?v=bhl-favicon-20261104';document.head.appendChild(favicon)}
 if(!document.querySelector('link[rel="apple-touch-icon"]')){const touch=document.createElement('link');touch.rel='apple-touch-icon';touch.href='logos/BHLlogo.png?v=bhl-favicon-20261104';document.head.appendChild(touch)}
 ensurePlayerProfile();ensureTableVisuals();
 const root=document.getElementById('bhl-global-nav');if(!root)return;
 const groups=[
  {href:'index.html',label:'Accueil'},
  {label:'Ligue',items:[['bhl-trophees.html','Trophées'],['bhl-reglements.html','Règlements'],['bhl-transactions.html','Transactions'],['bhl-repechage.html','Repêchage']]},
  {label:'Statistiques',items:[['bhl-fantrax.html','Saison régulière'],['bhl-series.html','Séries éliminatoires'],['bhl-pointeurs.html','Joueurs'],['bhl-records.html','Records']]},
  {label:'Équipes',teamMenu:true,items:[['bhl-equipes-connectees.html','Toutes les équipes'],['bhl-equipes-connectees.html?team=ANAHEIM','Anaheim','anaheim-mightyducks.png'],['bhl-equipes-connectees.html?team=ATLANTA','Atlanta','atlanta-thrashers.png'],['bhl-equipes-connectees.html?team=CLEVELAND','Boston','boston-bruins.png'],['bhl-equipes-connectees.html?team=CALIFORNIE','Californie','california-goldenseals.png'],['bhl-equipes-connectees.html?team=CHICAGO','Chicago','chicago-blackhawks.png'],['bhl-equipes-connectees.html?team=COLORADO','Colorado','colorado-avalanche.png'],['bhl-equipes-connectees.html?team=DETROIT','Détroit','detroit-redwings.png'],['bhl-equipes-connectees.html?team=FLORIDA','Floride','florida-panthers.png'],['bhl-equipes-connectees.html?team=HARTFORD','Hartford','hartford-whalers.png'],['bhl-equipes-connectees.html?team=MINNESOTA','Minnesota','minnesota-northstars.png'],['bhl-equipes-connectees.html?team=MONTREAL','Montréal','montreal-canadiens.png'],['bhl-equipes-connectees.html?team=NASHVILLE','Nashville','nashville-predators.png'],['bhl-equipes-connectees.html?team=NEWYORK','New York','newyork-rangers.png'],['bhl-equipes-connectees.html?team=OTTAWA','Ottawa','ottawa-senators.png'],['bhl-equipes-connectees.html?team=QU%C3%89BEC','Québec','quebec-nordiques.png'],['bhl-equipes-connectees.html?team=TORONTO','Toronto','toronto-mapleleafs.png']]},
  {href:'bhl-nouvelles.html',label:'Nouvelles'},
  {href:'bhl-espace-dg.html',label:'Espace DG'}
 ];
 const page=decodeURIComponent(location.pathname.split('/').pop()||'index.html');
 const active=page==='bhl-portail-dg.html'||page==='bhl-admin-dg.html'||page==='bhl-gestion-acces-dg.html'?'bhl-espace-dg.html':page;
 const renderLink=(href,label)=>'<a href="'+href+'"'+(active===href?' aria-current="page"':'')+(href==='bhl-espace-dg.html'?' class="bhl-nav-dg"':'')+'>'+label+'</a>';
 const renderGroup=(g,i)=>{
  if(g.href)return renderLink(g.href,g.label);
  const selected=g.items.some(([href])=>href.split('?')[0]===active);
  return '<div class="bhl-nav-group'+(selected?' is-current':'')+(g.teamMenu?' bhl-nav-team-group':'')+'"><button type="button" class="bhl-nav-group-toggle" aria-expanded="false" aria-controls="bhl-submenu-'+i+'">'+g.label+'<span class="bhl-nav-chevron" aria-hidden="true">⌄</span></button><div class="bhl-nav-submenu" id="bhl-submenu-'+i+'">'+g.items.map(([href,label,logo])=>logo?'<a class="bhl-nav-team-link" href="'+href+'"><img src="logos/'+logo+'" alt="" loading="lazy"><span>'+label+'</span></a>':renderLink(href,label)).join('')+'</div></div>';
 };
 root.innerHTML='<div class="bhl-nav-shell"><div class="bhl-nav-inner"><a class="bhl-nav-brand" href="index.html" aria-label="BHL — Accueil"><img class="bhl-nav-logo" src="logos/BHLlogo.png" alt=""><span>BHL<small>BÉLIVEAU HOCKEY LEAGUE</small></span></a><button type="button" class="bhl-nav-toggle" aria-expanded="false" aria-controls="bhl-navigation-links" aria-label="Ouvrir le menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>MENU</span></button><nav class="bhl-nav-links" id="bhl-navigation-links" aria-label="Navigation principale">'+groups.map(renderGroup).join('')+'</nav></div></div>';
 const toggle=root.querySelector('.bhl-nav-toggle'),nav=root.querySelector('.bhl-nav-links');
 const closeGroups=()=>root.querySelectorAll('.bhl-nav-group.is-open').forEach(g=>{g.classList.remove('is-open');g.querySelector('button').setAttribute('aria-expanded','false')});
 root.querySelectorAll('.bhl-nav-group-toggle').forEach(button=>button.addEventListener('click',()=>{const group=button.parentElement,opening=!group.classList.contains('is-open');closeGroups();group.classList.toggle('is-open',opening);button.setAttribute('aria-expanded',String(opening))}));
 function close(){closeGroups();nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Ouvrir le menu')}
 toggle.addEventListener('click',()=>{const opened=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(opened));toggle.setAttribute('aria-label',opened?'Fermer le menu':'Ouvrir le menu')});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 document.addEventListener('click',e=>{if(!root.contains(e.target))close()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
