/* Player statistics from administrator-provided Fantrax exports. */
(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('fr-CA',{maximumFractionDigits:2}):'—';
let request;
function load(){return request||(request=fetch('data/fantrax-player-details.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Statistiques indisponibles');return r.json()}).catch(e=>{request=null;throw e}))}
function table(player,data){
 const s=player.stats;
 const cols=player.goalie?[['GP','PJ'],['W','V'],['GA','BA'],['SV','ARR'],['SHO','BL'],['G','B'],['A','A']]:[['GP','PJ'],['G','B'],['A','A'],['PTS','PTS'],['SOG','TIRS'],['Hit','HITS'],['Blk','BLOCS'],['Tk','TK'],['FOW','MÀJ']];
 const values={...s,PTS:s.G==null||s.A==null?null:s.G+s.A};
 return '<div class="bhl-player-meta">'+esc(player.position)+' · '+esc(player.nhlTeam)+'</div><div class="bhl-player-totals"><div><span>FPTS</span><strong>'+fmt(s.FPts)+'</strong></div><div><span>FP/G</span><strong>'+fmt(s['FP/G'])+'</strong></div><div><span>Matchs joués</span><strong>'+fmt(s.GP)+'</strong></div></div><h4>Statistiques — '+esc(data.period)+'</h4><div class="bhl-player-scroll"><table class="bhl-player-table"><thead><tr>'+cols.map(([key,label])=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody><tr>'+cols.map(([key])=>'<td>'+fmt(values[key])+'</td>').join('')+'</tr></tbody></table></div><p class="bhl-player-source">Source : export Fantrax du '+esc(data.exportDate)+'. Ces statistiques sont un instantané et ne sont pas actualisées automatiquement.</p><p class="bhl-player-legend">'+(player.goalie?'V : victoires · BA : buts accordés · ARR : arrêts · BL : blanchissages · B : buts · A : passes.':'B : buts · A : passes · PTS : buts + passes · TK : takeaways · MÀJ : mises au jeu gagnées.')+'</p>';
}
async function fill(target,id,name){
 target.innerHTML='<p role="status">Chargement des statistiques…</p>';
 try{
 const data=await load();
 const matches=id?[data.players[id]].filter(Boolean):Object.values(data.players).filter(p=>norm(p.name)===norm(name));
 if(!target.isConnected)return;
 target.innerHTML=matches.length===1?table(matches[0],data):'<p>Statistiques non disponibles pour ce joueur dans l’export actuel.</p>';
 }catch(e){if(target.isConnected)target.innerHTML='<p>Statistiques temporairement indisponibles. Réessaie plus tard.</p>'}
}
function open(id,name){
 const previous=document.querySelector('.bhl-player-dialog');if(previous)previous.close();
 const trigger=document.activeElement,dialog=document.createElement('dialog');dialog.className='bhl-player-dialog';dialog.setAttribute('aria-label','Fiche de '+name);
 dialog.innerHTML='<button class="bhl-player-close" type="button" aria-label="Fermer la fiche">×</button><div class="bhl-player-hero" data-bhl-nhl-name="'+esc(name)+'"><div class="bhl-player-photo"><img class="bhl-nhl-photo" hidden alt=""></div><div><p>FICHE DU JOUEUR</p><h3>'+esc(name)+'</h3><a class="bhl-nhl-link" hidden target="_blank" rel="noopener noreferrer">Profil NHL ↗</a></div></div><section class="bhl-player-stats"></section>';
 document.body.append(dialog);dialog.showModal();
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus()},{once:true});
 fill(dialog.querySelector('.bhl-player-stats'),id,name);
 if(typeof window.bhlNhlApplyPortraits==='function')window.bhlNhlApplyPortraits(dialog);
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-bhl-player-id]');
 if(!button)return;
 e.preventDefault();open(button.dataset.bhlPlayerId,button.dataset.bhlPlayerName||button.textContent.trim());
});
// Enrich the existing portrait modal used by leadership and historical views.
if(typeof window.bhlPortraitModal==='function'){
 const original=window.bhlPortraitModal;
 window.bhlPortraitModal=function(name,details=''){
  original(name,details);
  const box=document.querySelector('.bhl-portrait-overlay .bhl-portrait-details');
  if(box){const stats=document.createElement('section');stats.className='bhl-player-stats';box.append(stats);fill(stats,null,name)}
 };
}
window.BHLPlayerStats={open,table};
})();