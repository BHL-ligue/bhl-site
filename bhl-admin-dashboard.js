import {initJournalistsAdmin} from './bhl-news-journalists.js?v=1';
import{initRulesAdmin}from'./bhl-rules-admin.js?v=2';import{initCaptainAdmin}from'./bhl-admin-captains.js?v=1';import{createClient}from'https://esm.sh/@supabase/supabase-js@2.57.4';import{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}from'./bhl-supabase.js';const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY),$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function msg(t,c=''){$('#status').textContent=t;$('#status').className='status '+c}
let adminReady=false,adminUser=null;
const views={journalistes:['Journalistes','Les signatures de la ligue et leur attribution aux comptes du portail.'],accueil:['Tableau de bord','L’essentiel de ta ligue, au même endroit.'],capitaines:['Capitaines et assistants','Gère le leadership des organisations de la BHL.'],articles:['Articles et nouvelles','De la rédaction à la publication.'],reglements:['Règlements','Modifie les articles et publie les changements sur le site.'],dgs:['Directeurs généraux','Responsables et attribution des organisations.'],demandes:['Demandes d’accès','Les inscriptions qui attendent ta validation.'],site:['Site et outils','Les raccourcis vers les pages de la ligue.']};
function metric(key,value){document.querySelectorAll('[data-admin-metric="'+key+'"]').forEach(el=>el.textContent=value)}
async function showView(name,focus=false){
 if(!adminReady)return;name=views[name]?name:'accueil';
 document.querySelectorAll('[data-admin-panel]').forEach(panel=>panel.hidden=panel.dataset.adminPanel!==name);
 document.querySelectorAll('.admin-sidebar [data-admin-view]').forEach(a=>{if(a.dataset.adminView===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 $('#adminViewTitle').textContent=views[name][0];$('#adminBreadcrumb').textContent=views[name][0];$('#adminViewDescription').textContent=views[name][1];
 if(focus){$('#adminViewTitle').tabIndex=-1;$('#adminViewTitle').focus({preventScroll:true});$('#adminViewTitle').scrollIntoView({behavior:'smooth',block:'start'})}
 if(name==='journalistes')await initJournalistsAdmin(db,$('#journalistsAdmin'));
 if(name==='reglements')await initRulesAdmin(db,$('#rulesAdmin'));
 if(name==='capitaines')await initCaptainAdmin(db,$('#captainAdmin'),{user:adminUser,onSaved:leaders});
}
function requestedView(){return location.hash.slice(1)||'accueil'}
document.querySelectorAll('[data-admin-view]').forEach(control=>control.addEventListener('click',e=>{e.preventDefault();const name=control.dataset.adminView;if(location.hash!=='#'+name)history.pushState(null,'','#'+name);showView(name,true).catch(e=>msg(e.message,'error'))}));
window.addEventListener('popstate',()=>showView(requestedView()).catch(e=>msg(e.message,'error')));
window.addEventListener('hashchange',()=>showView(requestedView()).catch(e=>msg(e.message,'error')));
async function boot(){
 const{data:{session},error:sessionError}=await db.auth.getSession();if(sessionError)throw sessionError;
 if(!session){adminReady=false;$('#login').classList.remove('hidden');$('#app').classList.add('hidden');msg('Connecte-toi avec ton compte administrateur.');return}
 const{data:p,error}=await db.from('bhl_profiles').select('role,full_name').eq('user_id',session.user.id).maybeSingle();
 if(error||p?.role!=='admin'){adminReady=false;$('#app').classList.add('hidden');$('#login').classList.remove('hidden');msg('Accès réservé à l’administrateur BHL.','error');return}
 adminUser=session.user;adminReady=true;$('#login').classList.add('hidden');$('#app').classList.remove('hidden');
 if(p.full_name)$('#adminGreeting').textContent='Bonjour, '+p.full_name.trim().split(/\s+/)[0];
 msg('Session administrateur vérifiée.','ok');await Promise.all([refresh(),showView(requestedView())]);
}
async function refresh(){const results=await Promise.allSettled([requests(),dgs(),leaders(),articleStats()]);for(const result of results)if(result.status==='rejected')msg('Certains outils n’ont pas pu être actualisés : '+result.reason.message,'error')}
async function requests(){
 const [a,p,t]=await Promise.all([
  db.from('bhl_account_requests').select('request_id,user_id,email,full_name,requested_team_id,created_at').eq('status','pending'),
  db.from('bhl_profiles').select('user_id,email,full_name,role').eq('role','pending'),
  db.from('bhl_teams').select('team_id,team_name').order('team_name')
 ]);
 const error=a.error||p.error||t.error;
 if(error){$('#requests').textContent='Erreur : '+error.message;return}
 const teams=t.data||[];
 const records=(a.data||[]).map(x=>({...x,source:'request'}));
 const known=new Set(records.map(x=>x.user_id));
 for(const x of p.data||[])if(!known.has(x.user_id))records.push({...x,source:'profile',request_id:null,requested_team_id:''});
 metric('requests',records.length);
 if(!records.length){$('#requests').textContent='Aucune demande en attente.';return}
 $('#requests').innerHTML='<p><strong>'+records.length+' inscription(s) en attente</strong></p><table><thead><tr><th>Nom</th><th>Courriel</th><th>Équipe</th><th>Origine</th><th>Action</th></tr></thead><tbody>'+
 records.map((x,i)=>'<tr><td>'+esc(x.full_name)+'</td><td>'+esc(x.email)+'</td><td><select id="pending-team-'+i+'" style="padding:8px;max-width:220px"><option value="">Choisir une équipe</option>'+teams.map(y=>'<option value="'+esc(y.team_id)+'" '+(y.team_id===x.requested_team_id?'selected':'')+'>'+esc(y.team_name)+'</option>').join('')+'</select></td><td>'+esc(x.source==='profile'?'Compte en attente':'Demande reçue')+'</td><td><button class="btn" data-pending-approve="'+i+'">Approuver</button></td></tr>').join('')+'</tbody></table>';
 document.querySelectorAll('[data-pending-approve]').forEach(btn=>btn.onclick=async()=>{
  const i=Number(btn.dataset.pendingApprove),x=records[i],team=document.getElementById('pending-team-'+i).value;
  if(!team){msg('Choisis une équipe avant de valider.','error');return}
  const {data:occupied,error:oe}=await db.from('bhl_profiles').select('user_id').eq('team_id',team).in('role',['dg','admin']);
  if(oe){msg(oe.message,'error');return}
  if((occupied||[]).some(z=>z.user_id!==x.user_id)){msg('Équipe déjà attribuée.','error');return}
  if(!confirm('Approuver ce DG pour '+(teams.find(y=>y.team_id===team)?.team_name||team)+' ?'))return;
  const {data:updated,error:ue}=await db.from('bhl_profiles').update({role:'dg',team_id:team}).eq('user_id',x.user_id).eq('role','pending').select('user_id');
  if(ue||!updated?.length){msg(ue?.message||'Profil non modifié.','error');return}
  if(x.request_id){const {data:{user:me}}=await db.auth.getUser();const {error:re}=await db.from('bhl_account_requests').update({status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:me?.email||null}).eq('request_id',x.request_id);if(re)msg('DG approuvé, mais demande non actualisée : '+re.message,'error')}
  msg('DG approuvé.','ok');await refresh();
 });
}
async function approve(id,user,team){if(!confirm('Approuver ce DG pour cette organisation?'))return;const{error}=await db.from('bhl_profiles').update({role:'dg',team_id:team}).eq('user_id',user);if(error){msg(error.message,'error');return}const{data:{user:me}}=await db.auth.getUser();const{error:e}=await db.from('bhl_account_requests').update({status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:me.email}).eq('request_id',id);if(e){msg('Profil attribué, demande non mise à jour : '+e.message,'error');return}msg('Compte DG approuvé.','ok');await refresh()}
async function reject(id){const note=prompt('Motif du refus (facultatif) :')||null;const{data:{user:me}}=await db.auth.getUser();const{error}=await db.from('bhl_account_requests').update({status:'rejected',admin_note:note,reviewed_at:new Date().toISOString(),reviewed_by:me.email}).eq('request_id',id);if(error){msg(error.message,'error');return}msg('Demande refusée.','ok');await requests()}
let directory=[];
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function drawDirectory(){
 const q=norm($('#directorySearch').value);
 const rows=directory.filter(x=>norm([x.team_name,x.full_name,x.email,x.role].join(' ')).includes(q));
 $('#dgs').innerHTML='<table><thead><tr><th>Organisation</th><th>Responsable</th><th>Courriel</th><th>Rôle</th><th>Statut</th><th>Gestion</th></tr></thead><tbody>'+
 (rows.length?rows.map(x=>'<tr><td><strong>'+esc(x.team_name)+'</strong></td><td>'+esc(x.full_name||'—')+'</td><td>'+esc(x.email||'—')+'</td><td><span class="role-badge">'+esc(x.role==='admin'?'Administrateur':x.role==='dg'?'DG':x.role||'—')+'</span></td><td><span class="state-badge '+(x.assigned?'assigned':'')+'">'+(x.assigned?'Attribuée':'Disponible')+'</span></td><td>'+(x.user_id?'<button type="button" class="btn secondary" data-edit-user="'+esc(x.user_id)+'">Modifier</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="6">Aucun résultat.</td></tr>')+'</tbody></table>';
 document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>openDirectoryEditor(b.dataset.editUser));
}
async function dgs(){
 const [teamsResponse,profilesResponse]=await Promise.all([
  db.from('bhl_teams').select('team_id,team_name').order('team_name'),
  db.from('bhl_profiles').select('user_id,email,full_name,team_id,role')
 ]);
 if(teamsResponse.error){$('#dgs').textContent=teamsResponse.error.message;return}
 if(profilesResponse.error){$('#dgs').textContent=profilesResponse.error.message;return}
 const teams=teamsResponse.data||[],profiles=profilesResponse.data||[];
 directory=teams.flatMap(team=>{
  const owners=profiles.filter(p=>p.team_id===team.team_id&&(p.role==='admin'||p.role==='dg'));
  return owners.length?owners.map(p=>({...team,...p,assigned:true})):
    [{...team,full_name:'',email:'',role:'',assigned:false}];
 });
 const assigned=teams.filter(t=>directory.some(p=>p.team_id===t.team_id&&p.assigned)).length;
 metric('assigned',assigned+'/'+teams.length);
 $('#directorySummary').textContent=teams.length+' organisations · '+assigned+' attribuées · '+(teams.length-assigned)+' disponibles';
 drawDirectory();
}
let editingDirectoryUser=null;
function openDirectoryEditor(id){
 const row=directory.find(x=>x.user_id===id);
 if(!row)return;
 editingDirectoryUser=id;
 const form=$('#directoryEditForm');
 form.elements.full_name.value=row.full_name||'';
 form.elements.team_id.innerHTML='<option value="">Choisir une organisation</option>'+[...new Map(directory.map(x=>[x.team_id,x.team_name])).entries()].map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
 form.elements.team_id.value=row.team_id;
 $('#directoryEditorInfo').textContent='Compte : '+row.email+' · '+(row.role==='admin'?'Administrateur':'DG');
 $('#directoryEditor').classList.remove('hidden');
 $('#directoryEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('#cancelDirectoryEdit').onclick=()=>{$('#directoryEditor').classList.add('hidden');editingDirectoryUser=null};
$('#directoryEditForm').onsubmit=async e=>{
 e.preventDefault();
 if(!editingDirectoryUser)return;
 const form=e.currentTarget,full_name=form.elements.full_name.value.trim(),team_id=form.elements.team_id.value;
 if(!full_name||!team_id){msg('Le nom et l’organisation sont obligatoires.','error');return}
 const current=directory.find(x=>x.user_id===editingDirectoryUser);
 if(current?.team_id!==team_id){
  const {data:owners,error:checkError}=await db.from('bhl_profiles').select('user_id').eq('team_id',team_id).in('role',['admin','dg']);
  if(checkError){msg(checkError.message,'error');return}
  if((owners||[]).some(x=>x.user_id!==editingDirectoryUser)){msg('Cette organisation a déjà un responsable.','error');return}
 }
 if(!confirm('Enregistrer les modifications de ce responsable?'))return;
 const btn=form.querySelector('[type=submit]');btn.disabled=true;
 const {data,error}=await db.from('bhl_profiles').update({full_name,team_id}).eq('user_id',editingDirectoryUser).select('user_id');
 btn.disabled=false;
 if(error||!data?.length){msg('Modification non enregistrée : '+(error?.message||'aucun compte modifié'),'error');return}
 $('#directoryEditor').classList.add('hidden');editingDirectoryUser=null;
 msg('Informations du responsable mises à jour.','ok');await refresh();
};
$('#directorySearch').addEventListener('input',drawDirectory);
$('#reloadDirectory').addEventListener('click',refresh);

async function leaders(){
 const{data,error}=await db.from('bhl_team_leadership').select('team_id,captain,assistant_1,assistant_2,assistant_3,updated_at').order('team_id');
 if(error){$('#leadership').textContent=error.message;metric('leaders','—');return}
 const{data:ts}=await db.from('bhl_teams').select('team_id,team_name');const names=Object.fromEntries((ts||[]).map(t=>[t.team_id,t.team_name]));
 const complete=(data||[]).filter(l=>['captain','assistant_1','assistant_2','assistant_3'].every(k=>!!l[k]));metric('leaders',complete.length+'/'+(ts?.length||16));
 $('#leadership').innerHTML='<table><thead><tr><th>Organisation</th><th>Capitaine</th><th>Assistant 1</th><th>Assistant 2</th><th>Assistant 3</th></tr></thead><tbody>'+(data||[]).map(l=>'<tr><td><strong>'+esc(names[l.team_id]||l.team_id)+'</strong></td><td>'+esc(l.captain||'—')+'</td><td>'+esc(l.assistant_1||'—')+'</td><td>'+esc(l.assistant_2||'—')+'</td><td>'+esc(l.assistant_3||'—')+'</td></tr>').join('')+'</tbody></table>';
}
async function articleStats(){
 const states=['pending','published','draft','rejected'];
 const responses=await Promise.all(states.map(state=>db.from('bhl_news').select('id',{count:'exact',head:true}).eq('status',state)));
 const failed=responses.some(r=>r.error);
 if(failed){metric('news','—');$('#articleSummary').textContent='Le bilan des articles est temporairement indisponible.'}
 else{const count=Object.fromEntries(states.map((state,i)=>[state,responses[i].count||0]));metric('news',count.pending);$('#articleSummary').textContent=count.pending+' à approuver · '+count.published+' publiés · '+count.draft+' brouillons · '+count.rejected+' à revoir'}
 const {data,error}=await db.from('bhl_news').select('id,title,status,updated_at').order('updated_at',{ascending:false}).limit(5);
 if(error){$('#recentArticles').textContent='Les articles récents ne sont pas disponibles pour le moment.';return}
 const root=$('#recentArticles');root.replaceChildren();const labels={pending:'À approuver',published:'Publié',draft:'Brouillon',rejected:'À revoir'};
 for(const article of data||[]){const a=document.createElement('a');a.href='bhl-articles-modifier.html?id='+encodeURIComponent(article.id);const title=document.createElement('span');title.textContent=article.title||'Sans titre';const state=document.createElement('span');state.className='role-badge';state.textContent=labels[article.status]||article.status;a.append(title,state);root.append(a)}
 if(!data?.length)root.textContent='Aucun article pour le moment.';
}
$('#refreshLeaders').onclick=leaders;
$('#refreshRequests').onclick=refresh;$('#loginForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;try{const f=new FormData(form),{error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)throw error;form.reset();await boot()}catch(e){msg(e.message,'error')}finally{button.disabled=false}};$('#logout').onclick=async()=>{await db.auth.signOut();location.reload()};boot().catch(e=>msg('Chargement impossible : '+e.message,'error'));
