import {node} from './bhl-news-db.js?v=journalists1';
export async function articleIdentity(db,form,user,profile,onChange){
 let reporterQuery=db.from('bhl_journalists').select('*').order('name');if(profile.role!=='admin')reporterQuery=reporterQuery.eq('owner_id',user.id);
 const [jr,tr,capability]=await Promise.all([reporterQuery,db.from('bhl_teams').select('team_id,team_name').order('team_name'),db.from('bhl_news').select('journalist_ids').limit(0)]);
 if(jr.error||tr.error)throw jr.error||tr.error;
 const multiReady=!capability.error,reporters=jr.data||[],teams=tr.data||[],old=document.getElementById('reporterName'),select=node('select');select.id='reporterName';select.required=true;old.replaceWith(select);
 const note=node('p','Choisis la signature principale parmi tes journalistes.','muted');select.parentElement.append(note);
 const coauthors=node('div',undefined,'article-coauthors'),coLabel=node('span','Coauteurs (facultatif)','coauthor-label'),dropdown=node('details',undefined,'coauthor-dropdown'),toggle=node('summary'),panel=node('div',undefined,'coauthor-panel'),search=node('input'),coOptions=node('div',undefined,'coauthor-options'),selection=node('div',undefined,'coauthor-selected'),feedback=node('p','','coauthor-feedback');
 coauthors.hidden=!multiReady;search.type='search';search.placeholder='Rechercher un journaliste…';search.setAttribute('aria-label','Rechercher un coauteur');feedback.setAttribute('role','status');
 panel.append(search,coOptions);dropdown.append(toggle,panel);coauthors.append(coLabel,dropdown,selection,node('p','Jusqu’à 4 coauteurs, en plus de la signature principale.','coauthor-hint'),feedback);select.parentElement.after(coauthors);
 dropdown.addEventListener('keydown',event=>{if(event.key==='Escape'){dropdown.open=false;toggle.focus();}});
 document.addEventListener('click',event=>{if(!dropdown.contains(event.target))dropdown.open=false;});
 search.addEventListener('input',drawCo);
 const bankLink=node('a','Choisir un journaliste dans la banque →');bankLink.href='bhl-journalistes.html';bankLink.target='_blank';bankLink.rel='noopener';select.parentElement.append(bankLink);
 const refresh=node('button','Actualiser ma liste','secondary');refresh.type='button';select.parentElement.append(refresh);
 let selected=[];
 function updateCoSummary(){
  toggle.textContent=selected.length?selected.length+' coauteur'+(selected.length>1?'s':'')+' sélectionné'+(selected.length>1?'s':''):'Choisir des coauteurs';
  selection.replaceChildren(...selected.map(id=>node('span',reporters.find(r=>r.id===id)?.name||'Journaliste conservé','coauthor-chip')));
  coOptions.querySelectorAll('input').forEach(input=>input.disabled=!multiReady||(!input.checked&&selected.length>=4));
 }
 function drawCo(){
  coOptions.replaceChildren();const query=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matches=reporters.filter(r=>r.id!==select.value&&r.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
  for(const r of matches){const label=node('label',undefined,'coauthor-option'),input=node('input'),identity=node('span'),name=node('strong',r.name);input.type='checkbox';input.value=r.id;input.checked=selected.includes(r.id);identity.append(name);if(r.media_name)identity.append(node('small',r.media_name));label.append(input,identity);coOptions.append(label);
   input.onchange=()=>{feedback.textContent='';if(input.checked){if(selected.length>=4){input.checked=false;feedback.textContent='Maximum de 4 coauteurs.';return;}selected.push(r.id);}else selected=selected.filter(id=>id!==r.id);updateCoSummary();onChange();};
  }
  if(!matches.length)coOptions.append(node('p',query?'Aucun journaliste trouvé.':'Aucun autre journaliste disponible.','coauthor-hint'));
  updateCoSummary();
 }
 function fill(){const v=select.value;select.replaceChildren(new Option('Choisir un journaliste',''));for(const r of reporters)select.add(new Option(r.name,r.id));select.value=v;drawCo();}
 refresh.onclick=async()=>{refresh.disabled=true;try{let q=db.from('bhl_journalists').select('*').order('name');if(profile.role!=='admin')q=q.eq('owner_id',user.id);const {data,error}=await q;if(error)throw error;reporters.splice(0,reporters.length,...data);fill();}catch(error){note.textContent=error.message;}finally{refresh.disabled=false;}};
 const field=node('fieldset',undefined,'article-team-tags'),options=node('div',undefined,'article-tag-options');field.append(node('legend','Équipes mentionnées'),node('p','Coche toutes les équipes dont parle cet article.','muted'));for(const team of teams){const label=node('label'),input=node('input');input.type='checkbox';input.value=team.team_id;label.append(input,document.createTextNode(team.team_name));options.append(label);}field.append(options);form.querySelector('.article-metadata-grid').after(field);
 select.onchange=()=>{selected=selected.filter(id=>id!==select.value);const r=reporters.find(r=>r.id===select.value);if(r)document.getElementById('mediaName').value=r.media_name||'';drawCo();onChange();};field.onchange=onChange;
 return {set(article){fill();if(article?.journalist_id&&!reporters.some(r=>r.id===article.journalist_id))select.add(new Option(article.reporter_name+' (attribution à corriger)',article.journalist_id));select.value=article?.journalist_id||'';selected=(article?.journalist_ids||[]).filter(id=>id!==select.value);drawCo();options.querySelectorAll('input').forEach(i=>i.checked=(article?.team_tags||[]).includes(i.value));note.textContent=reporters.length?'La signature principale précède les coauteurs.':'Aucun journaliste attribué. Tu peux conserver un brouillon.';},value(){const ids=[select.value,...selected].filter(Boolean);const names=ids.map(id=>reporters.find(r=>r.id===id)?.name||'').filter(Boolean);return {journalist_id:select.value||null,reporter_name:names.join(' et '),...(multiReady?{journalist_ids:ids}:{}),team_tags:[...options.querySelectorAll('input:checked')].map(i=>i.value)};}};
}
export async function initJournalistsAdmin(db,target){
 target.textContent='Chargement des journalistes…';
 const [jr,pr,tr]=await Promise.all([db.from('bhl_journalists').select('*').order('name'),db.from('bhl_profiles').select('user_id,full_name,team_id,role').in('role',['dg','admin']).order('full_name'),db.from('bhl_teams').select('team_id,team_name').order('team_name')]);
 if(jr.error||pr.error||tr.error)throw jr.error||pr.error||tr.error;
 const reporters=jr.data||[],profiles=pr.data||[],teams=tr.data||[],teamName=id=>teams.find(t=>t.team_id===id)?.team_name||'BHL';
 target.replaceChildren(node('h2','Banque de journalistes'),node('p','Crée un journaliste sans compte pour le rendre disponible aux DG. Tu peux aussi l’attribuer directement, le modifier, le désattribuer ou le supprimer.'));
 const form=node('form'),name=node('input'),media=node('input'),owner=node('select'),team=node('select'),save=node('button','Ajouter le journaliste','btn'),cancel=node('button','Annuler','btn secondary'),feedback=node('p');let editing=null;
 name.required=true;name.maxLength=120;media.maxLength=160;save.type='submit';cancel.type='button';cancel.hidden=true;feedback.setAttribute('role','status');
 for(const [title,input] of [['Nom du journaliste',name],['Média',media],['Compte du portail (facultatif)',owner],['Équipe du journaliste',team]]){const label=node('label',title,'field');label.append(input);form.append(label)}
 owner.add(new Option('Disponible — aucun compte attribué',''));profiles.forEach(p=>owner.add(new Option((p.full_name||'Compte BHL')+' · '+teamName(p.team_id),p.user_id)));
 team.add(new Option('BHL — Couverture générale de la ligue',''));teams.forEach(t=>team.add(new Option(t.team_name,t.team_id)));team.disabled=true;
 owner.onchange=()=>{team.value=profiles.find(p=>p.user_id===owner.value)?.team_id||'';team.disabled=!owner.value};
 function reset(){editing=null;form.reset();team.disabled=true;save.textContent='Ajouter le journaliste';cancel.hidden=true}cancel.onclick=reset;
 form.append(save,cancel,feedback);target.append(form);
 form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;save.disabled=true;feedback.textContent='Enregistrement…';try{const payload={name:name.value.trim(),media_name:media.value.trim(),owner_id:owner.value||null,team_id:owner.value?(team.value||null):null};const result=editing?await db.from('bhl_journalists').update(payload).eq('id',editing).select('id').single():await db.from('bhl_journalists').insert(payload).select('id').single();if(result.error)throw result.error;await initJournalistsAdmin(db,target)}catch(error){feedback.textContent=error.code==='23505'?'Ce journaliste existe déjà. Modifie son attribution dans la liste.':error.message;save.disabled=false}};
 const list=node('div',undefined,'journalist-directory');
 for(const r of reporters){
  const item=node('article',undefined,'card'),p=profiles.find(p=>p.user_id===r.owner_id),edit=node('button','Modifier','btn secondary'),remove=node('button','Supprimer','btn secondary'),status=node('p'),actions=node('div',undefined,'actions');
  status.setAttribute('role','status');edit.type=remove.type='button';
  item.append(node('h3',r.name),node('p',r.media_name||'Média non précisé'),node('p',r.owner_id?((p?.full_name||'Compte non disponible')+' · '+teamName(r.team_id)):'Disponible dans la banque','muted'),actions,status);actions.append(edit);
  edit.onclick=()=>{editing=r.id;name.value=r.name;media.value=r.media_name;owner.value=r.owner_id||'';team.value=r.team_id||'';team.disabled=!r.owner_id;save.textContent='Enregistrer les modifications';cancel.hidden=false;name.focus();form.scrollIntoView({behavior:'smooth',block:'center'})};
  async function mutate(request){actions.querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await request;if(result.error)throw result.error;await initJournalistsAdmin(db,target)}catch(error){status.textContent=error.message;actions.querySelectorAll('button').forEach(b=>b.disabled=false)}}
  if(r.owner_id){const release=node('button','Désattribuer','btn secondary');release.type='button';release.onclick=()=>mutate(db.from('bhl_journalists').update({owner_id:null,team_id:null}).eq('id',r.id).select('id').single());actions.append(release)}
  remove.onclick=()=>{if(confirm('Supprimer le journaliste « '+r.name+' »? Les signatures de ses articles existants seront conservées.'))mutate(db.from('bhl_journalists').delete().eq('id',r.id).select('id').single())};actions.append(remove);list.append(item);
 }
 if(!reporters.length)list.append(node('p','Aucun journaliste ajouté.'));target.append(list);
}
