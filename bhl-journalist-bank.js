import {db,node} from './bhl-news-db.js?v=team-banners1';
const status=document.getElementById('bankStatus'),mine=document.getElementById('myJournalists'),available=document.getElementById('availableJournalists'),reload=document.getElementById('reloadBank');
let user,profile,busy=false;
function message(text){status.textContent=text}
function card(reporter,canClaim=false){
 const item=node('article',undefined,'bank-card');item.append(node('h3',reporter.name),node('p',reporter.media_name||'Média non précisé','muted'));
 if(canClaim){const button=node('button','Ajouter à mes journalistes','btn');button.type='button';button.onclick=()=>claim(reporter);item.append(button)}
 else item.append(node('span','Attribué à mon compte','bank-badge'));
 return item;
}
async function load(){
 const {data,error}=await db.from('bhl_journalists').select('id,name,media_name,owner_id,team_id').order('name');if(error)throw error;
 const owned=(data||[]).filter(r=>r.owner_id===user.id),free=(data||[]).filter(r=>!r.owner_id);
 mine.replaceChildren(...(owned.length?owned.map(r=>card(r)):[node('p','Tu n’as pas encore de journaliste. Choisis une signature dans la banque ci-dessous.','muted')]));
 available.replaceChildren(...(free.length?free.map(r=>card(r,true)):[node('p','Aucun journaliste disponible pour le moment. L’administration peut en ajouter dans la banque.','muted')]));
 document.getElementById('myCount').textContent=owned.length;document.getElementById('availableCount').textContent=free.length;
}
async function claim(reporter){
 if(busy)return;busy=true;document.querySelectorAll('#bankApp button').forEach(b=>b.disabled=true);message('Attribution de '+reporter.name+'…');
 try{
  const {error}=await db.from('bhl_journalists').update({owner_id:user.id,team_id:profile.team_id}).eq('id',reporter.id).is('owner_id',null).select('id').single();
  if(error)throw error;
  await load();message(reporter.name+' fait maintenant partie de tes journalistes. Tu peux le choisir pour signer tes articles.');
 }catch(error){
  try{await load()}catch{}
  message(['PGRST116','42501'].includes(error.code)?'Ce journaliste n’est plus disponible. La banque a été actualisée.':'Attribution impossible : '+error.message);
 }finally{busy=false;document.querySelectorAll('#bankApp button').forEach(b=>b.disabled=false)}
}
reload.onclick=async()=>{if(busy)return;reload.disabled=true;try{await load();message('Banque actualisée.')}catch(error){message(error.message)}finally{reload.disabled=false}};
async function boot(){
 const {data,error}=await db.auth.getUser();if(error||!data.user){document.getElementById('bankAccess').hidden=false;message('Connecte-toi avec ton compte habituel pour choisir un journaliste.');return}
 user=data.user;
 const {data:p,error:pe}=await db.from('bhl_profiles').select('role,team_id,full_name').eq('user_id',user.id).single();if(pe)throw pe;profile=p;
 if(!['dg','admin'].includes(p.role)||!p.team_id){document.getElementById('bankAccess').hidden=false;message(p.role==='admin'?'Pour gérer la banque, ouvre Journalistes dans le portail Admin.':'Un compte DG approuvé et associé à une équipe est requis.');if(p.role==='admin')document.getElementById('bankAdmin').hidden=false;return}
 document.getElementById('bankApp').hidden=false;document.getElementById('bankIdentity').textContent=p.full_name||'Mon compte BHL';if(p.role==='admin')document.getElementById('bankAdmin').hidden=false;
 await load();message('Choisis un journaliste disponible. Une fois attribué à ton compte, il est réservé à ton équipe.');
}
boot().catch(error=>message('Chargement impossible : '+error.message));
