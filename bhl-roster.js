/* Shared roster presentation for team profiles and season page. */
window.BHLRoster=(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positions=['C','LW','RW','D','G'];
const groups=[['ACTIVE','Alignement de départ'],['RESERVE','Banc'],['INJURED_RESERVE','Liste des blessés'],['MINORS','Mineures']];
function rank(p){const i=positions.indexOf(String(p.position).toUpperCase());return i<0?positions.length:i}
function sort(rows){return rows.slice().sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name,'fr'))}
function render(rows,showTeam=false){
 return groups.map(([status,title])=>{
 const list=sort(rows.filter(p=>p.status===status));
 const body=status==='ACTIVE'?positions.concat(list.some(p=>rank(p)===5)?['Autres']:[]).map(pos=>{
 const players=list.filter(p=>pos==='Autres'?rank(p)===5:p.position===pos);
 if(!players.length)return '';
 return '<div class="bhl-roster-position"><h5>'+esc(pos)+'</h5><div class="bhl-lineup-cards">'+players.map(p=>{
 const initials=p.name.split(/\s+/).filter(Boolean).map(s=>s[0]).slice(0,2).join('');
 return '<article class="bhl-lineup-player" data-bhl-nhl-name="'+esc(p.name)+'"><div class="bhl-lineup-portrait"><span class="bhl-lineup-initials" aria-hidden="true">'+esc(initials)+'</span><img class="bhl-nhl-photo" hidden loading="lazy" alt=""></div><div class="bhl-lineup-info"><span class="bhl-lineup-badge">'+esc(p.position)+'</span><strong>'+esc(p.name)+'</strong>'+(showTeam?'<small>'+esc(p.teamName)+'</small>':'')+'<a class="bhl-nhl-link" hidden target="_blank" rel="noopener noreferrer">Fiche NHL ↗</a></div></article>';
 }).join('')+'</div></div>';
 }).join(''):'<div class="bhl-ft-table"><table><thead><tr><th>Position</th><th>Joueur</th>'+(showTeam?'<th>Organisation BHL</th>':'')+'</tr></thead><tbody>'+list.map(p=>'<tr><td><span class="bhl-lineup-badge">'+esc(p.position)+'</span></td><td>'+esc(p.name)+'</td>'+(showTeam?'<td>'+esc(p.teamName)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
 return '<section class="bhl-roster-block'+(status==='ACTIVE'?' bhl-roster-starting':'')+'" data-roster-status="'+status+'"><div class="bhl-roster-title"><h4>'+title+'</h4><span>'+list.length+' joueur(s)</span></div>'+(list.length?body:'<p class="bhl-roster-empty">Aucun joueur dans cette section pour les filtres choisis.</p>')+'</section>';
 }).join('');
}
function photos(container){
 // Reuse the site's official NHL portrait lookup and its in-memory name cache.
 if(typeof window.bhlNhlApplyPortraits==='function')window.bhlNhlApplyPortraits(container);
}
return {render,photos,sort};
})();
(()=>{if(typeof window.bhlNhlApplyPortraits==="function")return;
const bhlNhlPortraitCache=new Map();
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
    const url='https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q='+encodeURIComponent(name);
    const result=await bhlNhlJson(url);
    const matches=Array.isArray(result)?result:(Array.isArray(result?.data)?result.data:[]);
    const match=matches.find(p=>bhlNhlNamesMatch(name,p.name||p.fullName||p.playerName));
    const id=Number(match?.playerId||match?.id);
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
    if(!photo||!link)return;
    link.href=result.profile;
    link.hidden=false;
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
