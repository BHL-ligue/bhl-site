import {slug} from './bhl-wjc-draft-model.mjs?v=1';
export function normalizeTargets(targets=[],players=[]){
 if(!Array.isArray(targets)||targets.length>1000)throw Error('Maximum de 1 000 cibles potentielles.');
 const used=new Set(players.map(p=>slug(p.name))),ids=new Set();
 return targets.map(p=>{
  const name=String(p.name||'').trim(),key=slug(name),id=p.id||'target-'+key;
  if(!name||name.length>120||!key||used.has(key)||ids.has(id))throw Error('Nom invalide ou déjà présent dans la préparation : '+name);
  const birthYear=p.birthYear==null||p.birthYear===''?null:Number(p.birthYear);
  if(birthYear!==null&&(!Number.isInteger(birthYear)||birthYear<1900||birthYear>2100))throw Error('Année de naissance invalide pour '+name+'.');
  const epUrl=String(p.epUrl||'').trim();
  if(epUrl&&!/^https:\/\/(?:www\.)?eliteprospects\.com\/player\/\d+(?:\/[a-z0-9-]+)?\/?$/i.test(epUrl))throw Error('Lien Elite Prospects invalide pour '+name+'.');
  used.add(key);ids.add(id);return {id,name,position:String(p.position||'').trim().slice(0,24),country:String(p.country||'').trim().slice(0,80),birthYear,epUrl};
 });
}
export function parseTargets(text){return text.split(/\r?\n/).filter(line=>line.trim()).map(line=>{const [name,position='',country='',birthYear='',epUrl='']=line.split(/\t|;/).map(x=>x.trim());return {name,position,country,birthYear,epUrl};});}
export function confirmTarget(config,id){
 const targets=normalizeTargets(config.targets||[],config.players),target=targets.find(p=>p.id===id);
 if(!target)throw Error('Cible introuvable.');
 const playerId='p-'+slug(target.name);if(config.players.some(p=>p.id===playerId))throw Error('Ce joueur existe déjà dans la banque.');
 return {...config,players:[...config.players,{...target,id:playerId,keeperTeamId:''}],targets:targets.filter(p=>p.id!==id)};
}
