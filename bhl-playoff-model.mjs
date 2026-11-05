export function seededRandom(seed=12345){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const record=t=>{const a=String(t.points||'').match(/(\d+)-(\d+)-(\d+)/);return {w:Number(t.wins??a?.[1]??0),l:Number(t.losses??a?.[2]??0),d:Number(t.ties??a?.[3]??0)};};
export function playoffModel(data,{runs=10000,seed=2027,slots=8}={}){
 const teams=data.standings.slice().sort((a,b)=>a.rank-b.rank);if(!teams.length)return null;
 const ids=new Map(teams.map((t,i)=>[String(t.teamId),i]));const schedule=(data.schedule||[]).filter(p=>p.matchups?.length);
 const completed=schedule.filter(p=>Number(p.period)<Number(data.scoringPeriod));const future=schedule.filter(p=>Number(p.period)>=Number(data.scoringPeriod));
 const duration=p=>Math.max(1,Math.round((Date.parse(p.endDate)-Date.parse(p.startDate))/86400000))/7;
 const histories=teams.map(()=>[]);for(const p of completed){const seen=new Set();for(const g of p.matchups)for(const side of [g.home,g.away]){const i=ids.get(String(side?.teamId));if(i===undefined||seen.has(i))continue;if(side.score==null||!Number.isFinite(Number(side.score)))return null;seen.add(i);histories[i].push(Number(side.score)/duration(p));}}
 if(completed.length===0||histories.some(a=>!a.length))return null;
 const all=histories.flat(),leagueMean=all.reduce((a,b)=>a+b,0)/all.length;
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const leagueVar=histories.flatMap(a=>a.map(x=>(x-mean(a))**2)).reduce((a,b)=>a+b,0)/all.length||400;
 const strengths=histories.map(a=>{const overall=mean(a),recent=mean(a.slice(-3)),n=a.length;return {mean:(n*(.7*overall+.3*recent)+3*leagueMean)/(n+3),n,sd:Math.sqrt((a.reduce((s,x)=>s+(x-overall)**2,0)+3*leagueVar)/(n+3))};});
 const remaining=teams.map(()=>0);for(const p of future)for(const g of p.matchups){for(const side of [g.home,g.away]){const i=ids.get(String(side?.teamId));if(i===undefined)return null;remaining[i]++;}}
 const rand=seededRandom(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(rand(),1e-12)))*Math.cos(2*Math.PI*rand());const qualified=teams.map(()=>0),projected=teams.map(()=>0);
 for(let run=0;run<runs;run++){
  const points=teams.map(t=>{const r=record(t);return Number(t.totalPoints??(2*r.w+r.d));}),fpts=teams.map(t=>Number(t.totalPointsFor)||0);
  const latent=strengths.map(s=>s.mean+normal()*s.sd/Math.sqrt(s.n+3));
  for(const p of future){const scale=duration(p);const scores=strengths.map((s,i)=>Math.round(Math.max(0,latent[i]*scale+normal()*s.sd*Math.sqrt(scale))*100)/100);
   // The same weekly total is used for all three opponents, as in BHL.
   for(const g of p.matchups){const a=ids.get(String(g.away.teamId)),b=ids.get(String(g.home.teamId));const diff=scores[a]-scores[b];points[a]+=diff>0?2:diff===0?1:0;points[b]+=diff<0?2:diff===0?1:0;fpts[a]+=scores[a];fpts[b]+=scores[b];}
  }
  const order=teams.map((_,i)=>i).sort((a,b)=>points[b]-points[a]||fpts[b]-fpts[a]||Number(teams[a].rank)-Number(teams[b].rank));order.slice(0,slots).forEach(i=>qualified[i]++);points.forEach((v,i)=>projected[i]+=v);
 }
 return {runs,slots,completedPeriods:completed.length,remainingPeriods:future.length,teams:Object.fromEntries(teams.map((t,i)=>[String(t.teamId),{probability:qualified[i]/runs,projectedPoints:projected[i]/runs,weeklyStrength:strengths[i].mean,remainingGames:remaining[i]}]))};
}
