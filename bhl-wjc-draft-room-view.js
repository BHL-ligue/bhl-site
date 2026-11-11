import {YEAR,available,summary,slug} from './bhl-wjc-draft-model.mjs?v=1';
export function initWjcDraftRoom(db,root){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null,user=null,admin=false,channel=null,loading=false,busy=false,pending=null,view='available',query='',position='',rosterId='',message='',messageError=false,bootId=0;
let archive=null;
const archiveRequest=fetch('data/wjc.json').then(response=>response.ok?response.json():null).then(data=>data?.editions?.find(edition=>edition.year===2026)).catch(()=>null);
const fields='year,status,config,selections,revision,updated_at';
const team=id=>state.config.teams.find(t=>t.id===id),player=id=>state.config.players.find(p=>p.id===id);
const current=()=>team(state.config.order[state.selections.length]);
const mine=t=>t?.dgIds.includes(user.id);
const myTurn=()=>state?.status==='open'&&current()&&(admin||mine(current()));
function stopChannel(){if(channel){db.removeChannel(channel);channel=null;}}
function tell(text,error=false){message=text;messageError=error;const el=root.querySelector('#wjc-room-status');if(el){el.textContent=text;el.className='wjc-status '+(error?'error':'ok');}}
async function boot(){const id=++bootId;stopChannel();state=null;user=null;pending=null;
 const {data:{user:me}}=await db.auth.getUser();if(id!==bootId)return;
 if(!me){root.innerHTML='<section class="wjc-card wjc-login"><h2>Connexion au portail DG</h2><p>Utilise ton compte BHL habituel.</p><form id="wjc-login"><label>Courriel<input name="email" type="email" autocomplete="email" required></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><button>Se connecter</button></form><p id="wjc-room-status" class="wjc-status" role="status"></p><a href="bhl-espace-dg.html">Compte ou mot de passe oublié →</a></section>';root.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;const f=new FormData(e.currentTarget);const {error}=await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:f.get('password')});if(error){tell(error.message,true);b.disabled=false;}else await boot();};return;}
 const {data:p,error}=await db.from('bhl_profiles').select('role').eq('user_id',me.id).maybeSingle();if(id!==bootId)return;
 if(error||!['dg','admin'].includes(p?.role)){root.innerHTML='<div class="wjc-card">Accès réservé aux DG approuvés. <a href="bhl-espace-dg.html">Retour au portail</a></div>';return;}
 user=me;admin=p.role==='admin';archive=await archiveRequest;await refresh(true);if(id!==bootId||!state)return;
 channel=db.channel('wjc-room-'+YEAR).on('postgres_changes',{event:'UPDATE',schema:'public',table:'bhl_wjc_drafts',filter:'year=eq.'+YEAR},()=>refresh()).subscribe();
}
async function refresh(force=false){if(!user||loading)return;loading=true;const activeUser=user.id;
 try{const {data,error}=await db.from('bhl_wjc_drafts').select(fields).eq('year',YEAR).maybeSingle();if(error)throw error;if(user?.id!==activeUser)return;
  if(!data){state=null;root.innerHTML='<div class="wjc-card"><h2>Participation à confirmer</h2><p>Ton compte n’est pas encore associé à une équipe pour le Mondial junior 2027. L’administrateur peut t’ajouter dans la préparation du repêchage.</p><button class="secondary" id="wjc-recheck">Vérifier mon accès</button></div>';root.querySelector('button').onclick=()=>boot();return;}
  const changed=state&&data.revision!==state.revision;if(!force&&state?.revision===data.revision){syncStamp();return;}
  if(changed&&pending){pending=null;message='Le repêchage a changé : vérifie les disponibilités avant de confirmer un nouveau choix.';messageError=false;}
  state=data;render();
 }catch(error){tell('Actualisation impossible : '+error.message+'. Réessaie avant de choisir.',true);if(!state)root.innerHTML='<div class="wjc-card"><p>Chargement impossible. Réessaie depuis ton portail DG.</p><a href="bhl-espace-dg.html">Retour au portail</a></div>';}
 finally{loading=false;}
}
function syncStamp(){const el=root.querySelector('#wjc-sync');if(el)el.textContent='Actualisé à '+new Date().toLocaleTimeString('fr-CA',{timeZone:'America/Toronto'})+' · mises à jour automatiques';}
function teamIdentity(t){
 if(!t)return '';
 const original=archive?.teams.find(x=>x.id===(t.archiveId||t.id)||slug(x.name)===slug(t.name));
 const logo=original?.logo;
 return (logo&&/^logos\/[a-z0-9_-]+\.(png|webp)$/i.test(logo)?'<img class="wjc-logo" src="'+esc(logo)+'" alt="">':'')+'<span>'+esc(t.name)+'</span>';
}
function birthYear(p){
 return p.birthYear||archive?.teams.flatMap(t=>t.players).find(x=>slug(x.name)===slug(p.name))?.birthYear||'—';
}
function renderDashboard(){
 const own=summary(state.config,state.selections).filter(mine);
 const completed=state.selections.length;
 const percent=state.config.order.length?Math.round(completed/state.config.order.length*100):0;
 const upcoming=state.config.order.slice(completed,completed+5);
 const recent=state.selections.slice(-3).reverse();
 const cards=own.map(t=>{
  const index=state.config.order.findIndex((id,i)=>i>=completed&&id===t.id);
  const next=index<0?'Tous tes choix sont effectués':index===completed?'Ton équipe est la prochaine à choisir':'Prochain choix n° '+(index+1)+' · dans '+(index-completed)+' choix';
  return `<article class="wjc-own-card"><div class="wjc-team-identity">${teamIdentity(t)}</div><strong class="wjc-own-total">${t.capacity-t.remaining}<small> / ${t.capacity} joueurs</small></strong><p>${t.keepers.length} conservés · ${t.drafted.length} repêchés · <b>${t.remaining} à combler</b></p><span class="wjc-next-pick">${esc(next)}</span></article>`;
 }).join('');
 const queue=upcoming.map((id,i)=>'<li class="'+(i===0?'current':'')+'"><span class="wjc-pick-number">'+(completed+i+1)+'</span><span class="wjc-team-identity">'+teamIdentity(team(id))+'</span></li>').join('');
 const last=recent.map(p=>'<li><span class="wjc-pick-number">'+p.pick+'</span><div><strong>'+esc(player(p.playerId)?.name)+'</strong><small>'+esc(team(p.teamId)?.name)+'</small></div></li>').join('');
 return '<div class="wjc-draft-progress"><div><b>'+completed+' / '+state.config.order.length+' choix</b><span>'+percent+' %</span></div><progress value="'+completed+'" max="'+(state.config.order.length||1)+'" aria-label="Progression du repêchage"></progress></div>'+
 '<div class="wjc-room-dashboard">'+(cards?'<div class="wjc-own-teams">'+cards+'</div>':'')+'<section class="wjc-queue"><h3>Prochains choix</h3><ol>'+ (queue||'<li>Ordre complété ou en préparation.</li>')+'</ol></section><section class="wjc-recent"><h3>Dernières sélections</h3><ol>'+(last||'<li>La première sélection apparaîtra ici.</li>')+'</ol></section></div>';
}
function render(){
 const active=document.activeElement;
 const focusedId=root.contains(active)?active.id:'';
 const caret=focusedId==='wjc-search'?active.selectionStart:null;
 const scrolls=Array.from(root.querySelectorAll('.wjc-scroll'),el=>el.scrollTop);
 const c=state.config,next=current(),done=state.selections.length,own=c.teams.filter(mine),names={setup:'En préparation',open:'En cours',paused:'En pause',complete:'Terminé'};
 root.innerHTML=`<div class="wjc-hero"><span class="wjc-kicker">POOL BHL · ${YEAR}</span><h2>${state.status==='open'?(myTurn()?'C’est à toi de choisir':'Au tour de '+esc(next?.name||'l’équipe suivante')):names[state.status]}</h2><p>${state.status==='open'?'Choix '+(done+1)+' sur '+c.order.length+' · '+esc(next?.name):state.status==='complete'?'Toutes les sélections ont été enregistrées.':state.status==='paused'?'Les sélections reprendront lorsque l’administration rouvrira le repêchage.':'L’administration prépare les effectifs et l’ordre des choix.'}</p></div><div class="wjc-row" style="margin:16px 0"><span>${admin?'Administration · tu peux choisir pour l’équipe au tour actuel.':own.length?'Mon équipe : '+esc(own.map(t=>t.name).join(' · ')):''}</span><button class="secondary" id="wjc-refresh">Actualiser</button>${admin?'<a class="wjc-link" href="bhl-admin-dg.html#mondial">Gérer le repêchage</a>':''}</div>${renderDashboard()}<div class="wjc-pills"><span><b>${done} / ${c.order.length}</b> choix faits</span><span><b>${available(c,state.selections).length}</b> joueurs disponibles</span><span><b>${c.players.filter(p=>p.keeperTeamId).length}</b> joueurs conservés</span></div><p id="wjc-room-status" role="status" class="wjc-status ${messageError?'error':''}">${esc(message||'Choisis un joueur dans la liste, puis confirme sa sélection. Les effectifs et l’ordre se mettent à jour automatiquement.')}</p><div id="wjc-confirm-area"></div><div class="wjc-tabs" aria-label="Sections du repêchage"><button data-view="available" class="secondary" aria-pressed="${view==='available'}">Joueurs disponibles</button><button data-view="order" class="secondary" aria-pressed="${view==='order'}">Ordre et sélections</button><button data-view="rosters" class="secondary" aria-pressed="${view==='rosters'}">Effectifs des équipes</button></div><div id="wjc-room-content" class="wjc-card"></div><p id="wjc-sync" class="muted"></p>`;
 root.querySelector('#wjc-refresh').onclick=()=>refresh(true);root.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});renderContent();renderConfirm();syncStamp();
 root.querySelectorAll('.wjc-scroll').forEach((el,i)=>{el.scrollTop=scrolls[i]||0;});
 const replacement=focusedId&&root.querySelector('#'+CSS.escape(focusedId));
 if(replacement){replacement.focus({preventScroll:true});if(caret!==null)replacement.setSelectionRange(caret,caret);}
}
function renderContent(){const el=root.querySelector('#wjc-room-content'),c=state.config;
 if(view==='available'){
  el.innerHTML='<div class="wjc-row"><label>Rechercher<input id="wjc-search" type="search" placeholder="Nom, pays ou année" value="'+esc(query)+'"></label><label>Position<select id="wjc-position"><option value="">Toutes les positions</option>'+[...new Set(c.players.flatMap(p=>String(p.position||'').split('/')).filter(Boolean))].sort().map(p=>'<option '+(position===p?'selected':'')+'>'+esc(p)+'</option>').join('')+'</select></label></div><div id="wjc-available-table"></div>';
  el.querySelector('#wjc-search').oninput=e=>{query=e.target.value;renderAvailable();};el.querySelector('#wjc-position').onchange=e=>{position=e.target.value;renderAvailable();};renderAvailable();
 }else if(view==='order')el.innerHTML='<h3>Ordre exact du repêchage</h3><div class="wjc-scroll"><table><thead><tr><th>Choix</th><th>Équipe</th><th>Joueur</th><th>Position</th><th>Pays</th></tr></thead><tbody>'+c.order.map((id,i)=>{const p=player(state.selections[i]?.playerId);return `<tr class="${i===state.selections.length&&state.status!=='complete'?'current':mine(team(id))?'mine':''}"><td>${i+1}</td><td><span class="wjc-team-identity">${teamIdentity(team(id))}</span></td><td>${p?esc(p.name):i===state.selections.length&&state.status==='open'?'Au tour actuel':'À venir'}</td><td>${esc(p?.position||'—')}</td><td>${esc(p?.country||'—')}</td></tr>`;}).join('')+'</tbody></table></div>';
 else{
  if(!c.teams.some(t=>t.id===rosterId))rosterId=c.teams.find(mine)?.id||c.teams[0]?.id||'';
  el.innerHTML='<label>Équipe<select id="wjc-roster-team">'+c.teams.map(t=>`<option value="${esc(t.id)}" ${rosterId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')+'</select></label><div id="wjc-roster"></div>';
  el.querySelector('select').onchange=e=>{rosterId=e.target.value;renderRoster();};renderRoster();
 }
}
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function renderAvailable(){const list=available(state.config,state.selections).filter(p=>(!position||String(p.position||'').split('/').includes(position))&&norm(p.name+' '+p.country+' '+birthYear(p)).includes(norm(query)));
 const el=root.querySelector('#wjc-available-table');el.innerHTML=list.length?'<p class="muted">'+list.length+' joueur(s)</p><div class="wjc-scroll"><table><thead><tr><th>Joueur</th><th>Position</th><th>Pays</th><th>Naissance</th><th>Sélection</th></tr></thead><tbody>'+list.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.position||'—')}</td><td>${esc(p.country||'—')}</td><td>${esc(birthYear(p))}</td><td><button data-player="${esc(p.id)}" ${!myTurn()||busy?'disabled':''}>Choisir</button></td></tr>`).join('')+'</tbody></table></div>':'<p class="wjc-empty">Aucun joueur disponible pour ces filtres.</p>';
 el.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>{if(!myTurn()||busy)return;pending={playerId:b.dataset.player,revision:state.revision};renderConfirm();root.querySelector('#wjc-confirm-area').scrollIntoView({behavior:'instant',block:'center'});root.querySelector('#wjc-confirm').focus({preventScroll:true});});
}
function renderConfirm(){const el=root.querySelector('#wjc-confirm-area');if(!pending){el.replaceChildren();return;}const p=player(pending.playerId);el.innerHTML=`<div class="wjc-confirm"><h3>Confirmer ce choix ?</h3><p><b>${esc(p.name)}</b> · ${esc(p.position)} · ${esc(p.country||'Pays non indiqué')}<br>Choix ${state.selections.length+1} pour <b>${esc(current()?.name)}</b>.</p><div class="wjc-row"><button id="wjc-confirm" ${busy?'disabled':''}>Confirmer la sélection</button><button id="wjc-cancel" class="secondary" ${busy?'disabled':''}>Retour à la liste</button></div></div>`;
 el.querySelector('#wjc-cancel').onclick=()=>{pending=null;renderConfirm();};el.querySelector('#wjc-confirm').onclick=async()=>{if(busy||!pending)return;busy=true;const choice={...pending};renderConfirm();
  try{const {error}=await db.rpc('bhl_wjc_action',{p_year:YEAR,p_action:'pick',p_payload:{playerId:choice.playerId},p_revision:choice.revision});if(error)throw error;pending=null;tell('Sélection enregistrée : '+p.name+'.');await refresh(true);}
  catch(error){pending=null;tell('Sélection non confirmée : '+error.message,true);await refresh(true);}
  finally{busy=false;if(state)render();}
 };
}
function renderRoster(){const el=root.querySelector('#wjc-roster');const s=summary(state.config,state.selections).find(t=>t.id===rosterId);if(!s){el.textContent='Aucune équipe préparée.';return;}
 const picks=s.drafted.map(x=>({...player(x.playerId),pick:x.pick}));
 el.innerHTML=`<h3 class="wjc-team-identity">${teamIdentity(s)}</h3><p><b>${s.capacity-s.remaining} / ${s.capacity}</b> joueurs · ${s.keepers.length} conservés · ${picks.length} repêchés · ${s.remaining} place(s) à combler</p><h4>Joueurs conservés de 2026</h4><ul class="wjc-roster-list">${s.keepers.map(p=>`<li><b>${esc(p.name)}</b> · ${esc(p.position||'—')} · ${esc(p.country||'—')} · ${esc(birthYear(p))}</li>`).join('')||'<li>Aucun joueur conservé.</li>'}</ul><h4>Sélections 2027</h4><ul class="wjc-roster-list">${picks.map(p=>`<li><b>${esc(p.name)}</b> · ${esc(p.position||'—')} · ${esc(birthYear(p))} · choix ${p.pick}</li>`).join('')||'<li>Aucune sélection pour le moment.</li>'}</ul>`;
}
const timer=setInterval(()=>{if(!document.hidden&&user)refresh();},5000);
const visibility=()=>{if(!document.hidden&&user)refresh();};document.addEventListener('visibilitychange',visibility);
const authListener=db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')setTimeout(()=>boot(),0);});
boot().catch(error=>{root.textContent='Chargement impossible : '+error.message;});

return {destroy(){clearInterval(timer);stopChannel();document.removeEventListener('visibilitychange',visibility);authListener.data.subscription.unsubscribe();}};
}
