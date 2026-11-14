import {articleIdentity} from './bhl-news-journalists.js?v=coauthors1';
import {articleTags} from './bhl-news-tag-ui.js?v=1';
import {today,seasonForDate,fillSeasons,articleByline} from './bhl-news-metadata.js?v=date-only-20261114';
import {attachCover,renderCover} from './bhl-news-images.js?v=inline1';
import {attachEditor} from './bhl-news-editor.js?v=inline1';
import {db,node,labels,date,articleLink,paragraphs} from './bhl-news-db.js?v=inline1';
const $=id=>document.getElementById(id), form=$('articleForm');
const view=document.body.dataset.articlePage||'hub';
const journalistBankLink=node('a','Mes journalistes / Banque');journalistBankLink.href='bhl-journalistes.html';document.querySelector('.article-nav')?.append(journalistBankLink);
if(location.hash==='#moderation')location.replace('bhl-articles-approbation.html');
let identityFields;
let user,profile,current=null,reservedId=null,busy=false,dirty=false,reviewing=null,mine=[],queue=[],minePage=0,reviewPage=0,seasonChosen=false;
const needsEditor=view==='write'||(view==='edit'&&new URLSearchParams(location.search).has('id'));
const rich=needsEditor?await attachEditor($('body'),()=>{dirty=true;},{onBusy:setBusy}):{set(){},enable(){},valid(){return false;},value(){return {body:'',body_format:'plain'};}};
const cover=attachCover({db,user:()=>user,canEdit:()=>editable()&&!busy,onChange:()=>{dirty=true;},onBusy:setBusy});
function message(t){$('status').textContent=t;}
function error(e){message('Impossible de terminer : '+(e.code==='PGRST116'?'L’article a changé. Actualise la liste, puis rouvre-le avant de réessayer.':(e.message||e)));}
function setBusy(v){busy=v;document.querySelectorAll('button').forEach(b=>b.disabled=v);rich.enable(!v&&editable());cover.enable(!v&&editable());}
function values(){return {...Object.fromEntries(['title','category','summary'].map(id=>[id,$(id).value.trim()])),...rich.value(),...cover.value(),article_date:$('articleDate').value,season:$('articleSeason').value,reporter_name:$('reporterName').value.trim(),media_name:$('mediaName').value.trim(),...identityFields?.value()};}
function canEdit(article){return !article||profile?.role==='admin'||(article.author_id===user?.id&&['draft','pending','rejected'].includes(article.status));}
function editable(){return canEdit(current);}
function openEditor(article){if(busy)return;if(!canEdit(article)){display(article);return;}location.href='bhl-articles-modifier.html?id='+encodeURIComponent(article.id);}
function saveState(){return current&&['pending','published'].includes(current.status)?current.status:'draft';}
function edit(article){identityFields?.set(article);$('savedLinks').hidden=true;current=article;reservedId=article?.id||null;$('articleDate').value=article?.article_date||today();fillSeasons($('articleSeason'),article?.season||seasonForDate($('articleDate').value));$('mediaName').value=article?.media_name||'';seasonChosen=!!article;for(const id of ['title','summary'])$(id).value=article?.[id]||'';rich.set(article?.body||'',article?.body_format||'plain');cover.set(article);$('category').value=article?.category||'Ligue';$('editorTitle').textContent=article?'Modifier l’article':'Rédiger une nouvelle';$('editState').textContent=labels[article?.status||'draft'];form.querySelectorAll('input,textarea,select').forEach(e=>e.disabled=!editable());rich.enable(editable());cover.enable(editable());$('save').classList.toggle('hidden',!editable());$('submit').classList.toggle('hidden',!editable()||['pending','published'].includes(article?.status));$('save').textContent=article?'Enregistrer les modifications':'Enregistrer le brouillon';$('deleteCurrent').hidden=!(article&&profile?.role==='admin');$('editHint').textContent=article?.status==='published'?'Administrateur : les modifications enregistrées seront visibles dans l’article publié.':article?.status==='pending'?'Cet article reste en attente d’approbation après tes modifications.':profile?.role==='admin'?'Tu peux aussi modifier les articles des DG depuis la liste d’administration.':'Un titre suffit pour enregistrer un brouillon. Complète ton article avant de le soumettre pour approbation.';dirty=false;}
function display(article,review=false){reviewing=review?article:null;$('readerTitle').textContent=article.title;$('readerCategory').textContent=article.category+(review?' · Validation':' · Aperçu');$('readerByline').textContent=articleByline(article);renderCover(db,$('readerCover'),article,{eager:true});paragraphs($('readerBody'),article.body,article.body_format);$('readerBody').append(articleTags(article));$('reviewActions').classList.toggle('hidden',!review);$('editReview').hidden=!(review&&profile?.role==='admin');$('editReview').textContent=article.status==='published'?'Modifier l’article':'Modifier avant validation';$('deleteReview').hidden=!(review&&profile?.role==='admin');$('approve').classList.toggle('hidden',article.status==='published');$('reviewNote').textContent=review?'L’approbation rend cet article public. Le retour à l’auteur le retire de l’accueil et permet sa correction.':'Aperçu privé : cet affichage ne publie pas l’article.';$('reader').showModal();}
function item(article,review=false){const el=node('article',undefined,'news-item');el.append(node('span',labels[article.status],'badge '+article.status),node('h3',article.title),node('p',article.summary||(article.status==='draft'?'Brouillon en cours de rédaction.':'')),node('p',articleByline(article),'muted'),node('p','Soumis par : '+article.author_name+' · '+article.team_name+' · Modifié le '+date(article.updated_at),'muted'));const actions=node('div',undefined,'actions');const b=node('button',review?'Lire et valider':(article.status==='draft'?'Reprendre':canEdit(article)?'Modifier':'Consulter'),'secondary');b.type='button';b.onclick=()=>{if(busy)return;if(review){display(article,true);return;}openEditor(article);};actions.append(b);if(review&&canEdit(article)){const change=node('button','Modifier','secondary');change.type='button';change.onclick=()=>openEditor(article);actions.append(change);}if(profile?.role==='admin'){const remove=node('button','Supprimer','danger');remove.type='button';remove.onclick=()=>deleteArticle(article);actions.append(remove);}if(article.status==='published'){const a=node('a','Voir l’article public');a.href=articleLink(article.id);actions.append(a);}el.append(actions);return el;}
function emptyState(title,text,write=false){const box=node('div',undefined,'empty-articles');box.append(node('h3',title),node('p',text));if(write){const link=node('a','Rédiger un article','btn');link.href='bhl-articles-rediger.html';box.append(link);}return box;}
function renderMine(){const q=$('articleSearch').value.trim().toLocaleLowerCase('fr');const rows=mine.filter(a=>[a.title,a.reporter_name,a.media_name,a.team_name].join(' ').toLocaleLowerCase('fr').includes(q));$('mine').replaceChildren(...(rows.length?rows.map(a=>item(a)):[emptyState(q?'Aucun résultat':view==='drafts'?'Aucun brouillon pour le moment':view==='pending'?'Aucun article en attente':'Aucun article à afficher',q?'Essaie un autre titre, journaliste ou média.':view==='drafts'?'Commence un article et clique sur « Enregistrer le brouillon » pour le retrouver ici.':view==='pending'?'Tes prochaines soumissions apparaîtront ici jusqu’à leur approbation.':'Choisis un autre statut ou commence une nouvelle rédaction.',!q)]));$('listCount').textContent=rows.length+' article'+(rows.length>1?'s':'')+' affiché'+(rows.length>1?'s':'')+' parmi '+mine.length+' chargé'+(mine.length>1?'s':'')+'.';}
async function loadMine(reset=true){if(!['edit','pending','drafts'].includes(view))return;if(reset){minePage=0;mine=[];}let request=db.from('bhl_news').select('*');if(['pending','drafts'].includes(view)||profile.role!=='admin')request=request.eq('author_id',user.id);const status=view==='drafts'?'draft':view==='pending'?'pending':$('listFilter').value;if(status)request=request.eq('status',status);const {data,error:e}=await request.order('updated_at',{ascending:false}).order('id').range(minePage*20,minePage*20+19);if(e)throw e;mine.push(...data);renderMine();$('moreMine').classList.toggle('hidden',data.length<20);}
async function loadReview(reset=true){if(profile.role!=='admin'||view!=='review')return;if(reset){reviewPage=0;queue=[];}const {data,error:e}=await db.from('bhl_news').select('*').eq('status','pending').order('updated_at',{ascending:false}).order('id').range(reviewPage*20,reviewPage*20+19);if(e)throw e;queue.push(...data);$('queue').replaceChildren(...(queue.length?queue.map(a=>item(a,true)):[emptyState('Tout est à jour','Aucun article ne demande ton approbation pour le moment.')]));$('moreReview').classList.toggle('hidden',data.length<20);}
function validateDraft(){
 const optional=['summary','reporterName','mediaName','body'].map($),required=optional.map(el=>el.required);
 try{optional.forEach(el=>el.required=false);if(!form.reportValidity())return false;if(rich.value().body.length>20000){message('Article trop long : raccourcis le texte ou simplifie la mise en forme.');return false;}return true;}finally{optional.forEach((el,i)=>el.required=required[i]);}
}
async function persist(state){const isDraft=state==='draft';if(busy||!editable()||!(isDraft?validateDraft():form.reportValidity()&&rich.valid()))return;if(state==='pending'&&current?.status!=='pending'&&!confirm('Soumettre cet article à l’administration? Il restera en attente jusqu’à son approbation.'))return;setBusy(true);try{const payload=values();const required=isDraft?['title','category','article_date','season']:['title','category','summary','body','article_date','season','reporter_name','media_name'];if(required.some(k=>!payload[k]))throw new Error(isDraft?'Ajoute un titre à ton brouillon.':'Complète les champs avant de soumettre ton article.');
// A reserved UUID is reused after an ambiguous network failure to avoid duplicate submissions.
if(!current&&reservedId){const {data,error:e}=await db.from('bhl_news').select('*').eq('id',reservedId).maybeSingle();if(e)throw e;if(data)current=data;}
if(current&&!canEdit(current)){edit(current);throw new Error('Cet article est déjà approuvé et ne peut plus être modifié par son auteur.');}
if(state==='draft'&&current&&['pending','published'].includes(current.status))state=current.status;
let request;if(current){request=db.from('bhl_news').update({...payload,status:state}).eq('id',current.id).eq('updated_at',current.updated_at).eq('status',current.status);}else{reservedId=reservedId||crypto.randomUUID();request=db.from('bhl_news').insert({...payload,id:reservedId,author_id:user.id,status:state});}
const {data,error:e}=await request.select('*').single();if(e)throw e;edit(data);$('savedLinks').hidden=false;message(state==='published'?'Article mis à jour. Les modifications sont visibles sur le site.':state==='pending'?'Modifications enregistrées. L’article reste en attente d’approbation.':'Brouillon enregistré dans ton compte.');await Promise.all([loadMine(),loadReview()]);
}catch(e){error(e);}finally{setBusy(false);}}
async function deleteArticle(article){
 if(busy||profile?.role!=='admin'||!article?.id)return;
 const unsaved=dirty&&current?.id===article.id?' Tes modifications non enregistrées seront aussi perdues.':'';
 if(!confirm('Supprimer définitivement la nouvelle « '+article.title+' »? Elle sera retirée du site et cette action ne peut pas être annulée.'+unsaved))return;
 setBusy(true);
 try{
  const {data,error:e}=await db.from('bhl_news').delete().eq('id',article.id).eq('updated_at',article.updated_at).select('id').single();
  if(e||!data)throw e||new Error('La nouvelle a changé ou a déjà été supprimée. Actualise la liste avant de réessayer.');
  const deletingCurrent=current?.id===article.id;
  if(reviewing?.id===article.id||deletingCurrent){if($('reader').open)$('reader').close();reviewing=null;}
  if(deletingCurrent){edit(null);$('editor').classList.add('hidden');}
  message('Nouvelle supprimée. Elle n’est plus accessible sur le site.');
  await Promise.all([loadMine(),loadReview()]);
 }catch(e){error(e);}finally{setBusy(false);}
}
async function moderate(state){if(busy||!reviewing)return;setBusy(true);try{const {data,error:e}=await db.from('bhl_news').update({status:state}).eq('id',reviewing.id).eq('status',reviewing.status).eq('updated_at',reviewing.updated_at).select('id').single();if(e||!data)throw e||new Error('L’article a changé. Actualise la file avant de le valider.');$('reader').close();message(state==='published'?'Article approuvé et publié sur l’accueil.':'Article retourné à l’auteur pour correction.');await Promise.all([loadMine(),loadReview()]);}catch(e){error(e);}finally{setBusy(false);}}
$('articleSeason').addEventListener('change',()=>{seasonChosen=true;});$('articleDate').addEventListener('change',()=>{if(!seasonChosen&&$('articleDate').value)fillSeasons($('articleSeason'),seasonForDate($('articleDate').value));});
form.onsubmit=e=>{e.preventDefault();persist(saveState());};$('submit').onclick=()=>persist('pending');$('preview').onclick=()=>{if(form.reportValidity()&&rich.valid())display({...values(),author_name:current?.author_name||profile.full_name,team_name:current?.team_name});};form.addEventListener('input',()=>{dirty=true;});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
$('deleteCurrent').onclick=()=>deleteArticle(current);$('deleteReview').onclick=()=>deleteArticle(reviewing);
$('editReview').onclick=()=>{if(busy||profile?.role!=='admin'||!reviewing)return;location.href='bhl-articles-modifier.html?id='+encodeURIComponent(reviewing.id)+'&return=review';};
$('closeReader').onclick=()=>$('reader').close();$('approve').onclick=()=>moderate('published');$('reject').onclick=()=>moderate('rejected');
$('articleSearch').addEventListener('input',renderMine);$('listFilter').addEventListener('change',()=>loadMine().catch(error));
$('reload').onclick=()=>loadMine().catch(error);$('moreMine').onclick=()=>{minePage++;loadMine(false).catch(e=>{minePage--;error(e);});};$('reloadReview').onclick=()=>loadReview().catch(error);$('reviewFilter').onchange=()=>loadReview().catch(error);$('moreReview').onclick=()=>{reviewPage++;loadReview(false).catch(e=>{reviewPage--;error(e);});};
async function boot(){
 const {data,error:e}=await db.auth.getUser();if(e||!data.user){$('access').classList.remove('hidden');message('Connecte-toi dans l’Espace DG avec ton compte habituel.');return;}user=data.user;
 const {data:p,error:pe}=await db.from('bhl_profiles').select('role,team_id,full_name').eq('user_id',user.id).single();if(pe)throw pe;profile=p;
 if(!p||!['dg','admin'].includes(p.role)||(p.role==='dg'&&!p.team_id)){$('access').classList.remove('hidden');message('Ton compte doit être approuvé et associé à une organisation.');return;}
 if(view==='review'&&p.role!=='admin'){$('access').classList.remove('hidden');$('access').querySelector('h2').textContent='Espace réservé à l’administration';$('access').querySelector('p').textContent='Retrouve tes soumissions dans « Articles en attente d’approbation ».';message('La validation des articles est réservée à l’administration.');return;}
 $('app').classList.remove('hidden');$('identity').textContent=(p.full_name||'DG BHL')+' · '+(p.role==='admin'?'Administration BHL':'Rédaction DG');
 document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',p.role!=='admin'));
 if(p.role==='admin'){const back=document.querySelector('main>a:first-child');if(back){back.href='bhl-admin-dg.html#articles';back.textContent='← Retour au portail administrateur'}}
 document.querySelectorAll('.article-nav a').forEach(el=>{if(el.dataset.page===view)el.setAttribute('aria-current','page');});
 $('articleHub').classList.toggle('hidden',view!=='hub');$('articleList').classList.toggle('hidden',!['edit','pending','drafts'].includes(view));$('moderation').classList.toggle('hidden',view!=='review');$('newArticle').hidden=view==='write'||view==='hub';
 $('listTitle').textContent=view==='drafts'?'Mes brouillons':view==='pending'?'Mes articles soumis':p.role==='admin'?'Tous les articles de la ligue':'Mes articles';
 $('listHint').textContent=view==='drafts'?'Ces articles ne sont pas encore soumis. Clique sur « Reprendre », complète ton article, puis envoie-le pour approbation quand il est prêt.':view==='pending'?'Les corrections enregistrées gardent l’article en attente d’approbation.':p.role==='admin'?'Tu peux modifier les articles de tous les DG, y compris les articles publiés.':'Les brouillons, les articles à revoir et les soumissions en attente restent modifiables. Les articles publiés sont consultables.';
 $('listFilterLabel').hidden=['pending','drafts'].includes(view);
 if(needsEditor)identityFields=await articleIdentity(db,form,user,profile,()=>{dirty=true;});
 edit(null);
 if(view==='write')$('editor').classList.remove('hidden');
 const params=new URLSearchParams(location.search),id=params.get('id');
 if(view==='edit'&&id){
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Le lien de cet article est invalide.');
  const {data:article,error:ae}=await db.from('bhl_news').select('*').eq('id',id).maybeSingle();if(ae)throw ae;
  if(!article)throw new Error('Article introuvable ou inaccessible avec ton compte.');
  if(!canEdit(article))throw new Error('Cet article est déjà publié. Seule l’administration peut le modifier.');
  edit(article);$('editor').classList.remove('hidden');$('articleList').classList.add('hidden');$('editorBack').hidden=false;
  if(p.role==='admin'&&params.get('return')==='review'){$('reviewReturn').hidden=false;}
 }
 await Promise.all([loadMine(),loadReview()]);
 message(view==='write'?'Ton brouillon reste privé. La soumission ne publie pas automatiquement ton article.':view==='review'?'Les articles restent privés jusqu’à ton approbation.':'Ton espace articles est prêt.');
}
boot().catch(error);
