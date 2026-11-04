import {db} from './bhl-news-db.js';
import {richFragment} from './bhl-rules-format.js?v=2';
const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
let rules=[],category='';
function render(){
 const query=normalize($('rules-search').value.trim());
 const visible=rules.filter(r=>(!category||r.category===category)&&normalize(r.id+' '+r.title+' '+r.category+' '+richFragment(r.body).textContent).includes(query));
 const root=$('rules-content');root.replaceChildren();
 for(const r of visible){const card=node('article',undefined,'rules-article');card.id='regle-'+r.id;const header=node('header'),number=node('span',r.id,'rules-number'),heading=node('div');heading.append(node('span',r.category,'rules-category'),node('h2',r.title));header.append(number,heading);const body=node('div',undefined,'rules-body');body.append(richFragment(r.body));card.append(header,body);root.append(card)}
 if(!visible.length)root.append(node('p','Aucun article ne correspond à cette recherche.','rules-empty'));
 $('rules-status').textContent=visible.length+' article'+(visible.length>1?'s':'')+(category?' · '+category:'');
 for(const button of $('rules-categories').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.category===category));
}
function buildNavigation(){
 const cats=[...new Set(rules.map(r=>r.category))],toc=$('rules-toc');toc.replaceChildren();
 for(const cat of cats){toc.append(node('h3',cat));for(const r of rules.filter(r=>r.category===cat)){const a=node('a',r.id+' · '+r.title);a.href='#regle-'+r.id;a.onclick=e=>{e.preventDefault();category='';$('rules-search').value='';render();history.replaceState(null,'',a.href);document.getElementById('regle-'+r.id)?.scrollIntoView({behavior:'smooth',block:'start'})};toc.append(a)}}
 const filters=$('rules-categories');for(const [value,label] of [['','Tout consulter'],...cats.map(c=>[c,c])]){const button=node('button',label);button.type='button';button.dataset.category=value;button.onclick=()=>{category=value;render()};filters.append(button)}
}
async function start(){
 try{const {data,error}=await db.from('bhl_rules').select('title,introduction,sections,revision,updated_at').eq('id',1).single();if(error)throw error;rules=data.sections;$('rules-title').textContent=data.title;$('rules-intro').textContent=data.introduction;$('rules-updated').textContent='Mis à jour le '+new Date(data.updated_at).toLocaleDateString('fr-CA',{dateStyle:'long',timeZone:'America/Toronto'});buildNavigation();render();if(location.hash.startsWith('#regle-'))document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
 }catch(e){$('rules-status').textContent='Impossible de charger les règlements. Réessayez dans quelques instants.';const retry=node('button','Réessayer','rules-button');retry.type='button';retry.onclick=()=>location.reload();$('rules-content').append(retry)}
 try{const {data:{user}}=await db.auth.getUser();if(user){const {data}=await db.from('bhl_profiles').select('role').eq('user_id',user.id).maybeSingle();$('rules-edit').hidden=data?.role!=='admin'}}catch(e){}
}
$('rules-search').addEventListener('input',render);$('rules-print').addEventListener('click',()=>{category='';$('rules-search').value='';render();window.print()});start();
