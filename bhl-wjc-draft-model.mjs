export const YEAR=2027;
export const EMPTY={teams:[],players:[],order:[]};
export const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function parsePlayers(text,previous=[]){
 const old=new Map(previous.map(p=>[p.name.toLocaleLowerCase('fr'),p.id]));
 const names=new Set(),ids=new Set();return text.split(/\r?\n/).filter(l=>l.trim()).map((l,i)=>{
  const [name='',position='',country='',keeperTeamId='']=l.split(/\t|;/).map(s=>s.trim());
  const key=name.toLocaleLowerCase('fr'),id=old.get(key)||'p-'+slug(name);
  if(!name||name.length>120||names.has(key)||ids.has(id)||id.length>160)throw Error('Ligne '+(i+1)+' : nom invalide ou doublon.');
  names.add(key);ids.add(id);return {id,name,position,country,keeperTeamId};
 });
}
export function summary(config,selections=[]){return config.teams.map(t=>{
 const keepers=config.players.filter(p=>p.keeperTeamId===t.id),drafted=selections.filter(s=>s.teamId===t.id),slots=config.order.filter(id=>id===t.id).length;
 return {...t,keepers,drafted,slots,remaining:t.capacity-keepers.length-drafted.length,missingOrder:t.capacity-keepers.length-slots};
});}
export function available(config,selections=[]){const used=new Set(selections.map(s=>s.playerId));return config.players.filter(p=>!p.keeperTeamId&&!used.has(p.id));}
export function validateConfig(c,selections=[],opening=false){
 if(!c||!Array.isArray(c.teams)||!Array.isArray(c.players)||!Array.isArray(c.order))throw Error('Préparation invalide.');
 if(c.teams.length>32||c.players.length>1000||c.order.length>1000)throw Error('Préparation trop volumineuse.');
 const ids=new Set();for(const t of c.teams){if(!/^[a-z0-9_-]{1,80}$/.test(t.id)||ids.has(t.id)||!t.name?.trim()||!Number.isInteger(t.capacity)||t.capacity<1||t.capacity>100||!Array.isArray(t.dgIds))throw Error('Vérifie les équipes et leur total de joueurs.');ids.add(t.id);if(opening&&!t.dgIds.length)throw Error('Associe un DG à '+t.name+'.');}
 const pids=new Set(),names=new Set();for(const p of c.players){const name=p.name?.trim().toLocaleLowerCase('fr');if(!name||pids.has(p.id)||names.has(name)||p.keeperTeamId&&!ids.has(p.keeperTeamId))throw Error('Vérifie les joueurs, doublons et équipes des joueurs conservés.');pids.add(p.id);names.add(name);}
 if(c.order.some(id=>!ids.has(id)))throw Error('Une équipe de l’ordre est inconnue.');
 if(selections.some((s,i)=>c.order[i]!==s.teamId||!c.players.some(p=>p.id===s.playerId&&!p.keeperTeamId)))throw Error('Les sélections déjà faites doivent être conservées.');
 for(const t of summary(c,selections)){if(t.missingOrder<0)throw Error(t.name+' : trop de choix ou de joueurs conservés.');if(opening&&t.missingOrder!==0)throw Error(t.name+' : il manque '+t.missingOrder+' choix dans l’ordre.');}
 if(opening&&(!c.teams.length||!c.order.length||available(c,selections).length<c.order.length-selections.length))throw Error('Ajoute assez de joueurs disponibles et un ordre complet.');return c;
}
