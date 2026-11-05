// Scores are stored as integer hundredths. Only explicitly selected starters count.
export function scoreLineup(week, roster) {
 const seen=new Set();let units=0,gp=0;const rows=[];
 for(const entry of roster){
  if(seen.has(entry.id))throw Error('Une joueuse figure deux fois dans cet alignement.');
  seen.add(entry.id);
  if(!['active','bench'].includes(entry.status))throw Error('Statut d’alignement invalide.');
  const result=week.players[entry.id]||{gp:0,units:0};
  if(!Number.isInteger(result.units)||!Number.isInteger(result.gp))throw Error('Statistique incomplète.');
  const counted=entry.status==='active';if(counted){units+=result.units;gp+=result.gp;}
  rows.push({...entry,...result,counted});
 }
 return {units,gp,rows};
}
