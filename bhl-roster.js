/* BHL lineup cards: Fantrax roster positions, ranked using dated CSV statistics. */
window.BHLRoster=(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positions=['C','LW','RW','D','G'];
const groups=[['ACTIVE','Alignement de départ'],['RESERVE','Banc'],['INJURED_RESERVE','Liste des blessés'],['MINORS','Mineures']];
const dataset=window.BHLFantasyStats;
const stats=p=>dataset?.players[String(p.id||'').replace(/\*/g,'')]||{};
const metric=(p,key)=>{const s=stats(p);return s.gp>0&&Number.isFinite(s[key])?s[key]:-Infinity};
const fmt=v=>Number.isFinite(v)?v.toLocaleString('fr-CA',{maximumFractionDigits:2}):'—';
function productive(a,b){return (metric(b,'fpg')>metric(a,'fpg')?1:metric(b,'fpg')<metric(a,'fpg')?-1:0)||(metric(b,'fpts')>metric(a,'fpts')?1:metric(b,'fpts')<metric(a,'fpts')?-1:0)||a.name.localeCompare(b.name,'fr')}
function rank(p){const i=positions.indexOf(String(p.position).toUpperCase());return i<0?positions.length:i}
function sort(rows){return rows.slice().sort((a,b)=>rank(a)-rank(b)||productive(a,b))}
function card(p,pos){
 if(!p)return '<div class="bhl-pro-card bhl-pro-empty"><span>'+esc(pos)+'</span><p>Aucun joueur actif à cette place</p></div>';
 const s=stats(p),words=p.name.split(/\s+/),first=words.shift()||'',last=words.join(' ')||first;
 return '<article class="bhl-lineup-player bhl-pro-card" data-bhl-nhl-name="'+esc(p.name)+'"><span class="bhl-pro-pos">'+esc(pos)+'</span><div class="bhl-lineup-portrait"><span class="bhl-lineup-initials" aria-hidden="true">'+esc(first[0]||'')+esc(last[0]||'')+'</span><img class="bhl-nhl-photo" hidden loading="lazy" alt=""></div><div class="bhl-lineup-info"><span class="bhl-pro-first">'+esc(first)+'</span><strong><button class="bhl-player-open" data-bhl-player-id="'+esc(p.id)+'" data-bhl-player-name="'+esc(p.name)+'">'+esc(last)+'</button></strong><div class="bhl-pro-metrics"><div><b>'+fmt(s.gp>0?s.fpg:null)+'</b><span>FP/G</span></div><div><b>'+fmt(s.fpts)+'</b><span>FPTS</span></div></div><small>'+fmt(s.gp)+' PJ</small><a class="bhl-nhl-link" hidden target="_blank" rel="noopener noreferrer">Fiche NHL ↗</a></div></article>';
}
function compose(rows){
 const pool=pos=>rows.filter(p=>p.position===pos).slice().sort(productive);
 const lw=pool('LW'),c=pool('C'),rw=pool('RW'),d=pool('D'),g=pool('G');
 return {trios:Array.from({length:Math.max(lw.length,c.length,rw.length)},(_,i)=>[lw[i]||null,c[i]||null,rw[i]||null]),duos:Array.from({length:Math.ceil(d.length/2)},(_,i)=>[d[i*2],d[i*2+1]||null]),goalies:g,others:rows.filter(p=>rank(p)===5)};
}
function lineup(rows){
 const x=compose(rows);
 const row=(label,players,pos)=>'<div class="bhl-pro-row"><h6>'+label+'</h6><div class="bhl-pro-grid bhl-pro-n'+players.length+'">'+players.map((p,i)=>card(p,pos[i])).join('')+'</div></div>';
 return '<div class="bhl-pro-layout"><section><h5>Attaque</h5>'+x.trios.map((trio,i)=>row('Trio '+(i+1),trio,['LW','C','RW'])).join('')+(!x.trios.length?'<p class="bhl-roster-empty">Aucun attaquant actif.</p>':'')+'</section><section><h5>Défense</h5>'+x.duos.map((duo,i)=>row('Duo '+(i+1),duo,['D','D'])).join('')+'<h5>Gardiens</h5><div class="bhl-pro-grid bhl-pro-n2">'+x.goalies.map(p=>card(p,'G')).join('')+'</div></section></div>'+
 (x.others.length?'<h5>Autres positions actives</h5><div class="bhl-pro-grid bhl-pro-n3">'+x.others.map(p=>card(p,p.position)).join('')+'</div>':'');
}
function render(rows,showTeam=false){
 const note=dataset?'<p class="bhl-roster-source">Tri automatique : FP/G décroissant, puis FPTS. Statistiques des exports Fantrax du '+esc(dataset.exportDate)+' · période des statistiques non précisée dans les exports. Ces valeurs ne sont pas actualisées aux 15 minutes. Joueurs sans match ou sans données placés en fin de position.</p>':'<p class="bhl-roster-source">Statistiques individuelles indisponibles; ordre alphabétique par position.</p>';
 return note+groups.map(([status,title])=>{
 const list=sort(rows.filter(p=>p.status===status));
 let body='';
 if(status==='ACTIVE'){
  if(showTeam){const teams=[...new Set(list.map(p=>p.teamName))];body=teams.map(name=>'<h5 class="bhl-pro-team">'+esc(name)+'</h5>'+lineup(list.filter(p=>p.teamName===name))).join('')}
  else body=lineup(list);
 }else body='<div class="bhl-ft-table"><table><thead><tr><th>Position</th><th>Joueur</th>'+(showTeam?'<th>Organisation BHL</th>':'')+'<th>FP/G</th><th>FPTS</th></tr></thead><tbody>'+list.map(p=>'<tr><td><span class="bhl-lineup-badge">'+esc(p.position)+'</span></td><td>'+'<button class="bhl-player-open" data-bhl-player-id="'+esc(p.id)+'" data-bhl-player-name="'+esc(p.name)+'">'+esc(p.name)+'</button></td>'+(showTeam?'<td>'+esc(p.teamName)+'</td>':'')+'<td>'+fmt(stats(p).gp>0?stats(p).fpg:null)+'</td><td>'+fmt(stats(p).fpts)+'</td></tr>').join('')+'</tbody></table></div>';
 return '<section class="bhl-roster-block'+(status==='ACTIVE'?' bhl-roster-starting':'')+'" data-roster-status="'+status+'"><div class="bhl-roster-title"><h4>'+title+'</h4><span>'+list.length+' joueur(s)</span></div>'+(list.length?body:'<p class="bhl-roster-empty">Aucun joueur dans cette section pour les filtres choisis.</p>')+'</section>';
 }).join('');
}
function photos(container){if(typeof window.bhlNhlApplyPortraits==='function')window.bhlNhlApplyPortraits(container)}
return {render,photos,sort,compose};
})();
(()=>{if(typeof window.bhlNhlApplyPortraits==="function")return;
const bhlNhlPortraitCache=new Map();
const bhlKnownNhlIds={'ryan nugent hopkins':8476454,'k andre miller':8480817};
function bhlNhlPlayerName(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
function bhlNhlNamesMatch(name, candidate){
  const normalized=bhlNhlPlayerName(candidate);
  const target=bhlNhlPlayerName(name);
  if(normalized===target)return true;
  const pieces=String(candidate||'').split(',');
  if(pieces.length===2&&bhlNhlPlayerName(pieces[1]+' '+pieces[0])===target)return true;
  return false;
}
async function bhlNhlJson(url){
  // Les deux passerelles sont des services publics; aucun secret ni donnée privée n'est envoyé.
  const proxies=['https://proxy.cors.dev/','https://corsproxy.io/?'];
  try{const direct=await fetch(url,{signal:AbortSignal.timeout(9000)});if(direct.ok)return await direct.json()}catch(error){}
  for(const proxy of proxies){
    try{
      const target=proxy.includes('corsproxy.io')?proxy+encodeURIComponent(url):proxy+url;
      const response=await fetch(target,{signal:AbortSignal.timeout(11000)});
      if(response.ok)return await response.json();
    }catch(error){console.warn('NHL photo source temporarily unavailable',error);}
  }
  throw Error('Service de recherche NHL temporairement indisponible');
}
async function bhlNhlPortrait(name){
  const key=bhlNhlPlayerName(name);
  if(!key)return null;
  if(bhlNhlPortraitCache.has(key))return bhlNhlPortraitCache.get(key);
  const request=(async()=>{
    // Search variants account for NHL's inconsistent apostrophes, hyphens and initials.
    const variants=[name,name.replace(/[’‘\u2019]/g,"'"),name.replace(/['’‘-]/g,' '),bhlNhlPlayerName(name)];
    const unique=[...new Set(variants.map(v=>v.trim()).filter(Boolean))];
    let match=null;
    for(const variant of unique){
      try{
        const url='https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q='+encodeURIComponent(variant);
        const result=await bhlNhlJson(url);
        const matches=Array.isArray(result)?result:(Array.isArray(result?.data)?result.data:[]);
        match=matches.find(p=>bhlNhlNamesMatch(name,p.name||p.fullName||p.playerName||[p.firstName,p.lastName].join(' ')));
        if(match)break;
      }catch(e){console.warn('NHL search variant failed',variant,e)}
    }
    const id=Number(bhlKnownNhlIds[key]||match?.playerId||match?.id);
    if(!Number.isInteger(id)||id<=0)return null;
    const profile=await bhlNhlJson('https://api-web.nhle.com/v1/player/'+id+'/landing');
    const headshot=String(profile?.headshot||'');
    const team=String(profile?.currentTeamAbbrev||'').replace(/[^A-Z]/g,'');
    const photo=/^https:\/\/(?:assets\.nhle\.com|media\.d3\.nhl\.com)\//.test(headshot)?headshot:null;
    const fallbacks=team?['20262027','20252026','20242025'].map(season=>'https://assets.nhle.com/mugs/nhl/'+season+'/'+team+'/'+id+'.png'):[];
    return {url:photo,alternates:fallbacks.filter(url=>url!==photo),profile:'https://www.nhl.com/player/'+id};
  })().catch(error=>{console.warn('Photo NHL non trouvée pour '+name,error);return null;});
  bhlNhlPortraitCache.set(key,request);
  return request;
}
function bhlNhlApplyPortraits(panel){
  panel.querySelectorAll('[data-bhl-nhl-name]').forEach(async card=>{
    const name=card.getAttribute('data-bhl-nhl-name');
    if(!name)return;
    const result=await bhlNhlPortrait(name);
    if(!result||!card.isConnected)return;
    const photo=card.querySelector('.bhl-nhl-photo');
    const link=card.querySelector('.bhl-nhl-link');
    if(!photo)return;
    if(link){link.href=result.profile;link.hidden=false;}
    const urls=[result.url,...(result.alternates||[])].filter(Boolean);
    if(urls.length){
      let index=0;
      photo.alt='Photo officielle NHL de '+name;
      photo.onload=()=>{photo.hidden=false;card.classList.add('bhl-has-portrait');};
      photo.onerror=()=>{
        index++;
        if(index<urls.length)photo.src=urls[index];
        else{photo.hidden=true;card.classList.remove('bhl-has-portrait');}
      };
      photo.hidden=false;
      photo.src=urls[index];
    }
  });
}
window.bhlNhlApplyPortraits=bhlNhlApplyPortraits;
})();
