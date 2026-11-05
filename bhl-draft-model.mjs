export const PROSPECT_ODDS=[32,21,15,10,8.5,6.5,4.5,2.5];
export function lottery(standings,random=Math.random){
 const inverse=standings.slice().sort((a,b)=>b.rank-a.rank);if(inverse.length!==16)throw Error('Le classement doit contenir 16 équipes.');
 const pool=inverse.slice(0,8).map((t,i)=>({...t,weight:PROSPECT_ODDS[i]})),winners=[];
 for(let draw=0;draw<3;draw++){let n=random()*pool.reduce((s,t)=>s+t.weight,0),index=pool.length-1;for(let i=0;i<pool.length;i++){n-=pool[i].weight;if(n<0){index=i;break;}}winners.push(pool.splice(index,1)[0]);}
 return [...winners,...inverse.filter(t=>!winners.some(w=>w.teamId===t.teamId))].map((t,i)=>({...t,pick:i+1,initialPick:17-t.rank,lotteryWinner:i<3}));
}
const positions=p=>String(p||'').toUpperCase().split(/[\/, ]+/).map(p=>p==='L'?'LW':p==='R'?'RW':p).filter(p=>['C','LW','RW','D','G'].includes(p));
export function teamNeeds(team){const targets={C:4,LW:4,RW:4,D:6,G:1},counts={C:0,LW:0,RW:0,D:0,G:0};for(const p of team?.players||[]){const pos=positions(p.position);for(const k of pos)counts[k]+=1/pos.length;}return Object.fromEntries(Object.keys(targets).map(k=>[k,Math.max(0,1-counts[k]/targets[k])]));}
export function mockDraft(order,prospects,data,{needsWeight=.15}={}){
 const available=prospects.slice().sort((a,b)=>a.rank-b.rank),picks=(data.draft?.futurePicks||[]).filter(p=>p.year===2027&&p.round===1);const needs=new Map(data.teams.map(t=>[t.id,teamNeeds(t)]));
 return order.map(slot=>{const ownership=picks.filter(p=>p.originalOwnerTeamId===slot.teamId);const ownerId=ownership.length===1?ownership[0].currentOwnerTeamId:slot.teamId;const owner=data.teams.find(t=>t.id===ownerId);const teamNeed=needs.get(ownerId)||{};
  let best=-1,bestValue=-Infinity;for(let i=0;i<Math.min(5,available.length);i++){const p=available[i],fit=Math.max(0,...positions(p.position).map(k=>teamNeed[k]||0));const value=100-3*(p.rank-1)+needsWeight*100*fit;if(value>bestValue){best=i;bestValue=value;}}
  const prospect=best<0?null:available.splice(best,1)[0];return {...slot,ownerId,ownerName:owner?.name||slot.teamName,ownershipConfirmed:ownership.length===1,prospect,need:prospect?Math.max(0,...positions(prospect.position).map(k=>teamNeed[k]||0)):0};
 });
}
