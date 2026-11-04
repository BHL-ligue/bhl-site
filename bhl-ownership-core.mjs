// Pure helpers: ownership comes from roster snapshots, never inferred from trades.
export function nameKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
export function resolvePlayer(players,id,name){
 const supplied=String(id||'').replace(/\*/g,'');if(supplied)return players[supplied]?supplied:null;
 const key=nameKey(name);if(!key)return null;
 const matches=Object.entries(players).filter(([,p])=>[p.name,...(p.aliases||[])].some(n=>nameKey(n)===key));
 return matches.length===1?matches[0][0]:null;
}
export function ownershipRows(archive,id,byPeriod=false){
 const spans=archive.ownership[id]||[],rows=[];
 for(const p of archive.periods){
  const owner=spans.find(([start,end])=>p.number>=start&&p.number<=end)?.[2]||null;
  const state=p.available?(owner?'owned':'unlisted'):'missing';
  const prev=rows.at(-1);
  if(!byPeriod&&prev&&prev.state===state&&prev.teamId===owner&&prev.last===p.number-1){prev.last=p.number;prev.end=p.end;}
  else rows.push({season:archive.season,first:p.number,last:p.number,start:p.start,end:p.end,state,teamId:owner,team:owner?archive.teams[owner]?.name||'Équipe non identifiée':null});
 }
 return rows;
}
export function periodLabel(row){return row.first===row.last?'Période '+row.first:'Périodes '+row.first+' à '+row.last;}
export function lineupRows(archive,id){
 return ownershipRows(archive,id,true).map(row=>{const span=(archive.lineups?.[id]||[]).find(([start,end])=>row.first>=start&&row.first<=end);return {...row,status:span?.[3]||null,position:span?.[4]||null};});
}
