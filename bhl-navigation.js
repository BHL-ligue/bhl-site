/* Navigation unique sur toutes les pages BHL */
(function(){
'use strict';
function mount(){
 const root=document.getElementById('bhl-global-nav');if(!root)return;
 const links=[
  ['index.html','Actualités'],
  ['bhl-accueil-forbes-connecte.html','FORBES'],
  ['bhl-equipes-connectees.html','Équipes'],
  ['bhl-trophees.html','Trophées'],
  ['bhl-matchs-joues.html','Matchs joués'],
  ['bhl-records.html','Records'],
  ['bhl-transactions.html','Transactions'],
  ['bhl-espace-dg.html','Espace DG']
 ];
 const page=decodeURIComponent(location.pathname.split('/').pop()||'index.html');
 const active=page==='bhl-portail-dg.html'||page==='bhl-admin-dg.html'||page==='bhl-gestion-acces-dg.html'?'bhl-espace-dg.html':page;
 root.innerHTML='<div class="bhl-nav-shell"><div class="bhl-nav-inner"><a class="bhl-nav-brand" href="index.html" aria-label="BHL — Accueil"><img class="bhl-nav-logo" src="logos/BHLlogo.png" alt=""><span>BHL<small>BÉLIVEAU HOCKEY LEAGUE</small></span></a><button type="button" class="bhl-nav-toggle" aria-expanded="false" aria-controls="bhl-navigation-links" aria-label="Ouvrir le menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>MENU</span></button><nav class="bhl-nav-links" id="bhl-navigation-links" aria-label="Navigation principale">'+links.map(([href,label])=>'<a href="'+href+'"'+(active===href?' aria-current="page"':'')+(href==='bhl-espace-dg.html'?' class="bhl-nav-dg"':'')+'>'+label+'</a>').join('')+'</nav></div></div>';
 const toggle=root.querySelector('.bhl-nav-toggle'),nav=root.querySelector('.bhl-nav-links');
 function close(){nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Ouvrir le menu')}
 toggle.addEventListener('click',()=>{const opened=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(opened));toggle.setAttribute('aria-label',opened?'Fermer le menu':'Ouvrir le menu')});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 document.addEventListener('click',e=>{if(!root.contains(e.target))close()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
