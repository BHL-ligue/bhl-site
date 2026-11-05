export const PROSPECT_ODDS=[32,21,15,10,8.5,6.5,4.5,2.5];
export function lottery(standings,random=Math.random){
 const inverse=standings.slice().sort((a,b)=>b.rank-a.rank);if(inverse.length!==16)throw Error('Le classement doit contenir 16 équipes.');
 const pool=inverse.slice(0,8).map((t,i)=>({...t,weight:PROSPECT_ODDS[i]})),winners=[];
 for(let draw=0;draw<3;draw++){let n=random()*pool.reduce((s,t)=>s+t.weight,0),index=pool.length-1;for(let i=0;i<pool.length;i++){n-=pool[i].weight;if(n<0){index=i;break;}}winners.push(pool.splice(index,1)[0]);}
 return [...winners,...inverse.filter(t=>!winners.some(w=>w.teamId===t.teamId))].map((t,i)=>({...t,pick:i+1,initialPick:17-t.rank,lotteryWinner:i<3}));
}
const positions=p=>String(p||'').toUpperCase().split(/[\/, ]+/).map(p=>p==='L'?'LW':p==='R'?'RW':p).flatMap(p=>p==='F'?['C','LW','RW']:[p]).filter(p=>['C','LW','RW','D','G'].includes(p));
const TARGETS={C:4,LW:4,RW:4,D:6,G:1};
function depthFor(team){const counts={C:0,LW:0,RW:0,D:0,G:0};for(const p of team?.players||[]){const pos=[...new Set(positions(p.position))];const status=String(p.status||'ACTIVE').toUpperCase();const weight=/MINOR|RESERVE_MINORS/.test(status)?.45:/INJUR|IR/.test(status)?.6:/BENCH|RESERVE/.test(status)?.8:1;for(const k of pos)counts[k]+=weight/pos.length;}return counts;}
const needsFor=counts=>Object.fromEntries(Object.entries(TARGETS).map(([k,target])=>[k,target/(target+(counts[k]||0))]));
export function teamNeeds(team){return needsFor(depthFor(team));}
export function mockDraft(order,prospects,data,{needsWeight=.15,candidateWindow=5,variation=3,random=null}={}){
 const available=prospects.slice().sort((a,b)=>a.rank-b.rank),picks=(data.draft?.futurePicks||[]).filter(p=>p.year===2027&&p.round===1),depth=new Map(data.teams.map(t=>[t.id,depthFor(t)]));
 const variability=Number.isFinite(Number(variation))?Math.max(0,Math.min(10,Number(variation))):3;
 return order.map(slot=>{const ownership=picks.filter(p=>p.originalOwnerTeamId===slot.teamId);const ownerId=ownership.length===1?ownership[0].currentOwnerTeamId:slot.teamId,owner=data.teams.find(t=>t.id===ownerId);if(!depth.has(ownerId))depth.set(ownerId,{C:0,LW:0,RW:0,D:0,G:0});const counts=depth.get(ownerId),teamNeed=needsFor(counts);
  const candidates=available.slice(0,candidateWindow).map((p,index)=>{const fit=Math.max(0,...positions(p.position).map(k=>teamNeed[k]||0)),strength=p.strength==null?Math.max(0,100-3*(p.rank-1)):Number(p.strength);return {index,fit,strength,score:(1-needsWeight)*strength+needsWeight*100*fit};});
  candidates.sort((a,b)=>b.score-a.score||available[a.index].rank-available[b.index].rank);
  let chosen=candidates[0];
  if(chosen&&random&&variability>0){
   // Vary only comparable candidates. Strongly weaker fits cannot jump the best score.
   const best=chosen.score,close=candidates.filter(c=>best-c.score<=Math.min(8,variability*2));const weights=close.map(c=>Math.exp((c.score-best)/variability));let draw=random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<close.length;i++){draw-=weights[i];if(draw<0){chosen=close[i];break;}}
  }
  const prospect=chosen?available.splice(chosen.index,1)[0]:null;
  if(prospect){const pos=[...new Set(positions(prospect.position))];for(const k of pos)counts[k]+=1/pos.length;}
  return {...slot,ownerId,ownerName:owner?.name||slot.teamName,ownershipConfirmed:ownership.length===1,prospect,need:chosen?.fit||0,selectionScore:chosen?.score??null,strength:chosen?.strength??null};
 });
}
