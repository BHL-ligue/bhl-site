import {YEAR,EMPTY,parsePlayers,summary,validateConfig,slug} from './bhl-wjc-draft-model.mjs?v=1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields='year,status,config,selections,revision,updated_at';
export async function initWjcDraftAdmin(db,target){
 target.classList.add('wjc-tool');target.innerHTML='<p>Chargement du repêchage junior…</p>';
 let state,config,profiles=[],dirty=false;
 const archivesRequest=getArchive().catch(()=>null);
 let archive;
 const result=await db.from('bhl_profiles').select('user_id,full_name,team_id,role').in('role',['dg','admin']).order('full_name');
 if(result.error){target.textContent=result.error.message;return;}profiles=result.data;archive=await archivesRequest;
 async function load(){const {data,error}=await db.from('bhl_wjc_drafts').select(fields).eq('year',YEAR).single();if(error)throw error;state=data;config=structuredClone(data.config||EMPTY);dirty=false;render();}
 const mark=()=>{dirty=true;target.querySelector('#wjc-dirty').textContent='Préparation modifiée · à enregistrer';target.querySelector('#wjc-save-hint').textContent='Modifications à enregistrer';};
 const tell=(s,error=false)=>{const el=target.querySelector('#wjc-admin-status');el.textContent=s;el.className='wjc-status '+(error?'error':'ok');};
 const playerText=()=>config.players.map(p=>[p.name,p.position||'',p.country||'',p.keeperTeamId||''].join('\t')).join('\n');
 function readInputs(){config.players=parsePlayers(target.querySelector('#wjc-players').value,config.players);config.order=target.querySelector('#wjc-order').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}
 function read(){readInputs();return validateConfig(config,state.selections);}
 async function action(name,payload={}){const {error}=await db.rpc('bhl_wjc_action',{p_year:YEAR,p_action:name,p_payload:payload,p_revision:state.revision});if(error)throw error;await load();}
 function render(){
 const editable=['setup','paused'].includes(state.status);
 target.innerHTML=`<div class="wjc-hero"><span class="wjc-kicker">CHAMPIONNAT MONDIAL JUNIOR</span><h2>Repêchage du pool · ${YEAR}</h2><p>Ordre personnalisé, joueurs conservés et sélections de tes DG.</p></div><div class="wjc-row" style="margin-top:16px"><strong>État : ${{setup:'En préparation',paused:'En pause',open:'Ouvert',complete:'Terminé'}[state.status]}</strong><a class="wjc-link" href="bhl-mondial-repechage.html">Ouvrir la salle →</a><button class="secondary" id="wjc-refresh">Actualiser</button></div><p class="muted">${state.selections.length} choix effectués · Révision ${state.revision} · ${new Date(state.updated_at).toLocaleString('fr-CA',{timeZone:'America/Toronto'})}</p><div id="wjc-admin-overview"></div><nav class="wjc-step-nav" aria-label="Préparation du repêchage"><button class="secondary" data-step="0">1 · Équipes</button><button class="secondary" data-step="1">2 · Retours</button><button class="secondary" data-step="2">3 · Choix</button></nav><p id="wjc-dirty" class="wjc-dirty"></p><div id="wjc-admin-status" class="wjc-status" role="status">Prépare les équipes, les joueurs conservés et l’ordre complet. Rien ne démarre automatiquement.</div>
 <div class="wjc-row"><button id="wjc-open" ${!editable?'disabled':''}>${state.status==='paused'?'Reprendre':'Ouvrir le repêchage'}</button><button id="wjc-pause" class="secondary" ${state.status!=='open'?'disabled':''}>Mettre en pause</button><button id="wjc-undo" class="secondary" ${!state.selections.length||!['paused','complete'].includes(state.status)?'disabled':''}>Annuler le dernier choix</button></div>
 <fieldset ${editable?'':'disabled'} style="border:0;padding:0;margin:0"><section class="wjc-card wjc-admin-step"><h3>1. Équipes et DG participants</h3><p class="muted">Le total inclut les joueurs conservés et ceux qui seront repêchés. Choisis le ou les comptes autorisés pour chaque équipe.</p><div class="wjc-row wjc-admin-actions"><button class="secondary" id="wjc-add-team">Ajouter une équipe</button><button class="secondary" id="wjc-archive-teams">Reprendre les équipes de 2026</button></div><div id="wjc-teams"></div></section>
 <section class="wjc-card wjc-admin-step"><h3>2. Joueurs conservés de 2026</h3><p class="muted">Ouvre un effectif pour voir les joueurs, leur position et leur année de naissance. Coche les retours et décoche ceux qui ne reviennent pas. Les retours cochés occupent une place dans l’effectif 2027 et sont retirés des disponibilités.</p><div class="wjc-filter-bar"><label>Rechercher dans les effectifs<input id="wjc-archive-search" type="search" placeholder="Joueur, équipe, position ou année"></label><button type="button" class="secondary" id="wjc-expand-rosters">Tout ouvrir</button><button type="button" class="secondary" id="wjc-collapse-rosters">Tout replier</button></div><div id="wjc-archive-rosters"></div>
 <details class="wjc-admin-import"><summary>Liste de repêchage et saisie manuelle</summary><p class="muted">Colle un joueur par ligne. Sépare les colonnes par des tabulations ou des points-virgules. Ordre des colonnes : <b>Nom, Position, Pays, Code de l’équipe si conservé</b>. Laisse le code vide pour un joueur disponible.</p><textarea id="wjc-players" rows="10" aria-label="Liste des joueurs et joueurs conservés" placeholder="Nom du joueur;C;Canada;">${esc(playerText())}</textarea><div class="wjc-row"><button class="secondary" id="wjc-preview">Vérifier la liste</button></div><div id="wjc-keeper-preview"></div></details></section>
 <section class="wjc-card wjc-admin-step"><h3>3. Ordre exact des choix</h3><p class="muted">Ajoute les choix dans l’ordre voulu, puis utilise les flèches pour les déplacer. Les choix déjà effectués sont verrouillés.</p><p class="wjc-tip" id="wjc-codes"></p><div class="wjc-row"><select id="wjc-order-team" aria-label="Équipe à ajouter à l’ordre"></select><label class="wjc-quantity">Nombre<input id="wjc-order-quantity" type="number" min="1" max="100" value="1"></label><button class="secondary" id="wjc-append">Ajouter à l’ordre</button></div><div id="wjc-order-editor"></div><details class="wjc-admin-import"><summary>Modifier l’ordre par codes</summary><textarea id="wjc-order" rows="12" aria-label="Ordre personnalisé des choix" style="margin-top:12px">${esc(config.order.join('\n'))}</textarea></details><div id="wjc-summary"></div></section>
 <div class="wjc-admin-save"><span id="wjc-save-hint">Les changements sont enregistrés ensemble.</span><button id="wjc-save">Enregistrer la préparation</button></div></fieldset>
 <div class="wjc-row" style="margin-top:15px"><button class="secondary" id="wjc-export">Exporter la préparation</button><label>Restaurer une préparation JSON<input type="file" id="wjc-import" accept="application/json,.json" ${editable?'':'disabled'}></label></div><p class="muted">Pendant le repêchage, mets-le en pause pour modifier la préparation. Les sélections déjà faites doivent garder leur équipe, leur ordre et leur joueur. L’annulation ne touche que le dernier choix et remet le repêchage en pause.</p>`;
 target.querySelectorAll('button').forEach(b=>b.type='button');
 renderTeams();renderSummary();renderArchive();
 const on=(id,fn)=>target.querySelector('#'+id).onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await fn();}catch(error){tell(error.message,true);}finally{if(b.isConnected)b.disabled=false;}};
 on('wjc-refresh',async()=>{if(dirty&&!confirm('Abandonner les modifications non enregistrées et recharger ?'))return;await load();});
 on('wjc-save',async()=>{await action('save',structuredClone(read()));tell('Préparation enregistrée. Le repêchage peut être ouvert quand tout est prêt.');});
 on('wjc-open',async()=>{if(dirty)throw Error('Enregistre la préparation avant d’ouvrir le repêchage.');validateConfig(config,state.selections,true);if(confirm('Ouvrir le repêchage pour les DG participants ?'))await action('open');});
 on('wjc-pause',()=>action('pause'));
 on('wjc-undo',async()=>{if(dirty)throw Error('Enregistre ou actualise la préparation avant d’annuler un choix.');if(confirm('Annuler uniquement le dernier choix et rendre son joueur disponible ?'))await action('undo');});
 on('wjc-add-team',()=>{let n=1;while(config.teams.some(t=>t.id==='equipe-'+n))n++;config.teams.push({id:'equipe-'+n,name:'Nouvelle équipe '+n,capacity:10,dgIds:[]});mark();renderTeams();renderSummary();});
 on('wjc-archive-teams',async()=>{if(config.teams.length)throw Error('Les équipes existent déjà. Ajoute ou modifie une équipe individuellement.');if(!archive)throw Error('Archives 2026 indisponibles.');config.teams=archive.teams.map(t=>archivedTeam(t));mark();renderTeams();renderSummary();renderArchive();});
 on('wjc-preview',()=>{readInputs();renderKeeperPreview();renderSummary();renderArchive();tell('Liste vérifiée. Sélectionne l’équipe des joueurs conservés ci-dessous.');});
 on('wjc-append',()=>{
  readInputs();
  const id=target.querySelector('#wjc-order-team').value;
  const count=Number(target.querySelector('#wjc-order-quantity').value);
  if(!id)throw Error('Ajoute d’abord une équipe.');
  if(!Number.isInteger(count)||count<1||count>100)throw Error('Choisis entre 1 et 100 choix.');
  config.order.push(...Array(count).fill(id));
  target.querySelector('#wjc-order').value=config.order.join('\n');
  mark();renderSummary();
 });
 on('wjc-export',()=>{const c=read();const url=URL.createObjectURL(new Blob([JSON.stringify({year:YEAR,config:c},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bhl-mondial-junior-2027-preparation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 target.querySelector('#wjc-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2000000)throw Error('Fichier trop volumineux.');const x=JSON.parse(await file.text());if(x.year!==YEAR)throw Error('Choisis une préparation 2027.');validateConfig(x.config,state.selections);if(!confirm('Remplacer la préparation affichée par ce fichier ? La sauvegarde reste à faire.'))return;config=x.config;render();mark();}catch(error){tell(error.message,true);}};
 target.querySelector('#wjc-players').oninput=mark;
 target.querySelector('#wjc-players').onchange=()=>{try{readInputs();renderArchive();renderSummary();}catch(error){tell(error.message,true);}};
 target.querySelector('#wjc-order').oninput=()=>{mark();try{readInputs();renderSummary();}catch{}};
 target.querySelector('#wjc-archive-teams').disabled=!archive||config.teams.length>0;
 target.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>target.querySelectorAll('.wjc-admin-step')[Number(button.dataset.step)].scrollIntoView({behavior:'instant',block:'start'}));
 target.querySelector('#wjc-archive-search').oninput=filterArchive;
 target.querySelector('#wjc-expand-rosters').onclick=()=>target.querySelectorAll('.wjc-archive-team:not([hidden])').forEach(el=>el.open=true);
 target.querySelector('#wjc-collapse-rosters').onclick=()=>target.querySelectorAll('.wjc-archive-team').forEach(el=>el.open=false);
 }
 async function getArchive(){const r=await fetch('data/wjc.json');if(!r.ok)throw Error('Archives indisponibles');const x=await r.json();return x.editions.find(e=>e.year===2026);}
 function renderTeams(){target.querySelector('#wjc-archive-teams').disabled=!archive||config.teams.length>0;const el=target.querySelector('#wjc-teams');el.innerHTML=config.teams.map((t,i)=>`<details class="wjc-admin-team"><summary>${esc(t.name)} <span>${t.dgIds.length? t.dgIds.length+' DG':'DG à associer'}</span></summary><div class="wjc-team-form"><label>Code (utilisé dans l’ordre)<input data-field="id" data-i="${i}" value="${esc(t.id)}" ${state.selections.length?'disabled':''}></label><label>Nom de l’équipe<input data-field="name" data-i="${i}" value="${esc(t.name)}" maxlength="100"></label><label>Total de joueurs<input data-field="capacity" data-i="${i}" type="number" min="1" max="100" value="${esc(t.capacity)}"></label><label class="wjc-users">DG autorisés (plusieurs possibles)<select multiple data-field="dgIds" data-i="${i}">${profiles.map(p=>`<option value="${esc(p.user_id)}" ${t.dgIds.includes(p.user_id)?'selected':''}>${esc(p.full_name||'Compte approuvé')} · ${esc(p.team_id||'Admin')}</option>`).join('')}</select></label></div><button class="secondary" data-remove="${i}">Retirer cette équipe de la préparation</button></details>`).join('')||'<p class="wjc-empty">Ajoute les équipes participantes ou reprends celles de 2026.</p>';
 el.querySelectorAll('[data-field]').forEach(input=>input.onchange=()=>{const t=config.teams[Number(input.dataset.i)],key=input.dataset.field;if(key==='id'){const old=t.id;try{read();}catch(error){input.value=old;tell(error.message,true);return;}t.id=input.value.trim();config.order=config.order.map(x=>x===old?t.id:x);config.players.forEach(p=>{if(p.keeperTeamId===old)p.keeperTeamId=t.id;});target.querySelector('#wjc-order').value=config.order.join('\n');target.querySelector('#wjc-players').value=playerText();}else t[key]=key==='dgIds'?Array.from(input.selectedOptions,o=>o.value):key==='capacity'?Number(input.value):input.value.trim();mark();renderSummary();updateCodes();renderArchive();});
 el.querySelectorAll('[data-remove]').forEach(b=>{b.type='button';b.onclick=()=>{const t=config.teams[Number(b.dataset.remove)];if(config.order.includes(t.id)||config.players.some(p=>p.keeperTeamId===t.id)){tell('Retire d’abord les choix et joueurs conservés de cette équipe.',true);return;}config.teams.splice(Number(b.dataset.remove),1);mark();renderTeams();renderSummary();renderArchive();};});updateCodes();}
 function updateCodes(){target.querySelector('#wjc-codes').textContent=config.teams.map(t=>t.id+' = '+t.name).join(' · ')||'Les codes apparaîtront ici.';target.querySelector('#wjc-order-team').innerHTML=config.teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');}
 function renderSummary(){renderOverview();renderOrderEditor();target.querySelector('#wjc-summary').innerHTML='<div class="wjc-scroll"><table><thead><tr><th>Équipe</th><th>Conservés</th><th>Choix prévus</th><th>Total attendu</th><th>À ajouter à l’ordre</th></tr></thead><tbody>'+summary(config,state.selections).map(t=>`<tr><td>${esc(t.name)}</td><td>${t.keepers.length}</td><td>${t.slots}</td><td>${t.capacity}</td><td>${t.missingOrder===0?'✓':t.missingOrder}</td></tr>`).join('')+'</tbody></table></div>';}
 function renderOverview(){
  const teams=summary(config,state.selections);
  const missing=teams.reduce((n,t)=>n+Math.max(0,t.missingOrder),0);
  const assigned=teams.filter(t=>t.dgIds.length>0).length;
  let readiness='Préparation complète · prête à enregistrer et ouvrir';
  try{validateConfig(config,state.selections,true);}catch(error){readiness=error.message;}
  target.querySelector('#wjc-admin-overview').innerHTML='<div class="wjc-metrics">'+[
   [teams.length,'équipes'],[assigned+' / '+teams.length,'DG associés'],
   [config.players.filter(p=>p.keeperTeamId).length,'joueurs conservés'],[missing,'choix à ajouter']
  ].map(([value,label])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('')+'</div><p class="wjc-readiness">'+esc(readiness)+'</p>';
 }
 function renderOrderEditor(){
  const container=target.querySelector('#wjc-order-editor');
  const completed=state.selections.length;
  container.innerHTML=config.order.length?'<ol class="wjc-edit-order">'+config.order.map((id,index)=>{
   const name=config.teams.find(t=>t.id===id)?.name||id;
   const locked=index<completed;
   return `<li><span class="wjc-pick-number">${index+1}</span><strong>${esc(name)}</strong>${locked?'<span class="wjc-lock">Effectué</span>':`<div class="wjc-order-actions"><button type="button" class="secondary" data-move="${index}" data-offset="-1" aria-label="Monter le choix ${index+1}" ${index<=completed?'disabled':''}>↑</button><button type="button" class="secondary" data-move="${index}" data-offset="1" aria-label="Descendre le choix ${index+1}" ${index===config.order.length-1?'disabled':''}>↓</button><button type="button" class="secondary" data-delete-pick="${index}" aria-label="Retirer le choix ${index+1}">×</button></div>`}</li>`;
  }).join('')+'</ol>':'<p class="wjc-empty">Ajoute le premier choix pour commencer.</p>';
  function syncOrder(){target.querySelector('#wjc-order').value=config.order.join('\n');mark();renderSummary();}
  container.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{
   readInputs();
   const index=Number(button.dataset.move),next=index+Number(button.dataset.offset);
   if(index<completed||next<completed||next>=config.order.length)return;
   [config.order[index],config.order[next]]=[config.order[next],config.order[index]];syncOrder();
  });
  container.querySelectorAll('[data-delete-pick]').forEach(button=>button.onclick=()=>{
   readInputs();const index=Number(button.dataset.deletePick);
   if(index<completed)return;config.order.splice(index,1);syncOrder();
  });
 }
 function filterArchive(){
  const query=slug(target.querySelector('#wjc-archive-search').value);
  target.querySelectorAll('.wjc-archive-team').forEach(details=>{
   const name=details.querySelector('summary strong').textContent;
   let visible=0;
   details.querySelectorAll('tbody tr').forEach(row=>{
    row.hidden=!!query&&!slug(name+' '+row.textContent).includes(query);
    if(!row.hidden)visible++;
   });
   details.hidden=visible===0;if(query&&visible)details.open=true;
  });
 }
 function archivedTeam(t){return {id:t.id,archiveId:t.id,name:t.name,capacity:t.players.length,dgIds:[]};}
 function archiveMatch(t){return config.teams.find(x=>x.archiveId===t.id||x.id===t.id||slug(x.name)===slug(t.name));}
 function renderArchive(){
  const container=target.querySelector('#wjc-archive-rosters');
  if(!archive){container.textContent='Archives de 2026 indisponibles. La saisie manuelle reste accessible.';return;}
  const open=new Set(Array.from(container.querySelectorAll('details[open]'),e=>e.dataset.archive));
  const picked=new Set(state.selections.map(s=>s.playerId));
  const byName=new Map(config.players.map(p=>[slug(p.name),p]));
  container.innerHTML=archive.teams.map(t=>{
   const team=archiveMatch(t);
   const keepers=team?config.players.filter(p=>p.keeperTeamId===team.id).length:0;
   const remaining=team?team.capacity-keepers-state.selections.filter(s=>s.teamId===team.id).length:0;
   const logo=/^logos\/[a-z0-9_-]+\.(png|webp)$/i.test(t.logo)?`<img class="wjc-logo" src="${esc(t.logo)}" alt="">`:'';
   const rows=t.players.map((p,index)=>{
    const current=byName.get(slug(p.name));
    const retained=!!team&&current?.keeperTeamId===team.id;
    const blocked=!!current&&(picked.has(current.id)||!!current.keeperTeamId&&!retained);
    return `<tr class="${retained?'wjc-retained':''}"><td><strong>${esc(p.name)}</strong></td><td><span class="wjc-position">${esc(p.position||'—')}</span></td><td class="wjc-birth">${esc(p.birthYear||'—')}</td><td>${blocked?'<span class="muted">'+(picked.has(current.id)?'Déjà repêché':'Conservé ailleurs')+'</span>':team?`<label class="wjc-keeper-check"><input type="checkbox" data-retain="${index}" aria-label="Conserver ${esc(p.name)}" ${retained?'checked':''}><span>${retained?'Conservé':'Conserver'}</span></label>`:'<span class="muted">—</span>'}</td></tr>`;
   }).join('');
   return `<details class="wjc-archive-team" data-archive="${esc(t.id)}" ${open.has(t.id)?'open':''}><summary>${logo}<strong>${esc(team?.name||t.name)}</strong><span class="wjc-archive-count">${team?keepers+' conservé(s) · '+remaining+' place(s) libre(s)':t.players.length+' joueurs en 2026'}</span></summary>${team?'':`<button type="button" class="secondary wjc-archive-add">Ajouter cette équipe à la préparation</button>`}<div class="wjc-scroll"><table><thead><tr><th>Joueur</th><th>Position</th><th>Naissance</th><th>Retour 2027</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }).join('');
  filterArchive();
  container.querySelectorAll('details').forEach(details=>{
   const oldTeam=archive.teams.find(t=>t.id===details.dataset.archive);
   const add=details.querySelector('.wjc-archive-add');
   if(add)add.onclick=()=>{config.teams.push(archivedTeam(oldTeam));mark();renderTeams();renderSummary();renderArchive();};
   details.querySelectorAll('[data-retain]').forEach(input=>input.onchange=()=>{
    try{
     readInputs();
     const team=archiveMatch(oldTeam),p=oldTeam.players[Number(input.dataset.retain)];
     const existing=config.players.find(x=>slug(x.name)===slug(p.name));
     if(!team||existing&&(picked.has(existing.id)||existing.keeperTeamId&&existing.keeperTeamId!==team.id))throw Error('Ce joueur est déjà attribué à une autre sélection ou équipe.');
     if(input.checked){
      const count=config.players.filter(x=>x.keeperTeamId===team.id).length;
      if(count+state.selections.filter(x=>x.teamId===team.id).length>=team.capacity)throw Error('L’effectif est plein. Retire un joueur ou ajuste le total de l’équipe.');
      if(existing)existing.keeperTeamId=team.id;
      else config.players.push({id:'p-'+slug(p.name),name:p.name,position:p.position||'',country:'',keeperTeamId:team.id});
     }else if(existing?.keeperTeamId===team.id)config.players=config.players.filter(x=>x.id!==existing.id);
     target.querySelector('#wjc-players').value=playerText();target.querySelector('#wjc-keeper-preview').replaceChildren();
     mark();renderSummary();renderArchive();
     const replacement=Array.from(container.querySelectorAll('details')).find(e=>e.dataset.archive===oldTeam.id)?.querySelector('[data-retain="'+input.dataset.retain+'"]');
     replacement?.focus({preventScroll:true});
    }catch(error){input.checked=!input.checked;tell(error.message,true);}
   });
  });
 }
 function renderKeeperPreview(){const el=target.querySelector('#wjc-keeper-preview');el.innerHTML='<div class="wjc-scroll"><table><thead><tr><th>Joueur</th><th>Position</th><th>Statut</th></tr></thead><tbody>'+config.players.map((p,i)=>`<tr><td>${esc(p.name)}</td><td>${esc(p.position)}</td><td><select data-keeper="${i}" aria-label="Équipe conservant ${esc(p.name)}"><option value="">Disponible au repêchage</option>${config.teams.map(t=>`<option value="${esc(t.id)}" ${p.keeperTeamId===t.id?'selected':''}>Conservé · ${esc(t.name)}</option>`).join('')}</select></td></tr>`).join('')+'</tbody></table></div>';el.querySelectorAll('[data-keeper]').forEach(input=>input.onchange=()=>{config.players[Number(input.dataset.keeper)].keeperTeamId=input.value;target.querySelector('#wjc-players').value=playerText();mark();renderSummary();renderArchive();});}
 try{await load();}catch(error){target.textContent='Chargement impossible : '+error.message;}
}
