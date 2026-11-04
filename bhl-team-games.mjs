// Usage counts are BHL lineup periods, not NHL games. No points or identities are inferred.
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const organizations={clevelandbarons:'BOS',bostonbruins:'BOS',winnipegjets:'COL',coloradoavalanche:'COL',detroitcougars:'DET',detroitredwings:'DET',vegasgoldenknights:'FLA',floridapanthers:'FLA',montrealmaroons:'MTL',montrealcanadiens:'MTL',edmontonoilers:'OTT',ottawasenators:'OTT',anaheimmightyducks:'ANA',atlantathrashers:'ATL',californiagoldenseals:'CAL',chicagoblackhawks:'CHI',hartfordwhalers:'HAR',minnesotanorthstars:'MIN',nashvillepredators:'NSH',newyorkrangers:'NYR',quebecnordiques:'QUE',torontomapleleafs:'TOR'};
const statuses={ACTIVE:'act',RESERVE:'res',INJURED_RESERVE:'ir',MINORS:'min'};
const empty=()=>({act:0,res:0,ir:0,min:0,g:0,d:0,lw:0,c:0,rw:0});
export function organizationCode(name){return organizations[key(name)]||null}
export function usageRows(archive,players,playoffSeason,now=Date.now()){
 const rounds=playoffSeason?.rounds||[],first=archive.firstPlayoffPeriod||Math.min(...rounds.map(r=>r.period));
 const periods=new Map(),missing=[];
 for(const p of archive.periods){
  // The Christmas shutdown had no BHL matchup; post-final roster snapshots are not games.
  if(archive.season==='2021-22'&&p.number===11)continue;
  if(Date.parse(p.end)>now)continue;
  const phase=p.number>=first?'playoffs':'regular';
  const round=rounds.find(r=>r.period===p.number);
  if(phase==='playoffs'&&!round){
   if(rounds.length&&p.number>Math.max(...rounds.map(r=>r.period)))continue;
   missing.push(p.number);continue;
  }
  if(!p.available){missing.push(p.number);continue}
  const eligible=phase==='playoffs'?new Set(round.matches.flatMap(m=>m.teams.map(t=>t.id))):null;
  periods.set(p.number,{phase,eligible});
 }
 const grouped=new Map();
 for(const [id,spans] of Object.entries(archive.lineups||{}))for(const [start,end,teamId,status,position] of spans){
  const field=statuses[status],team=archive.teams[teamId]?.name,org=organizationCode(team);if(!field||!org)continue;
  for(let period=start;period<=end;period++){
   const p=periods.get(period);if(!p||p.eligible&&!p.eligible.has(teamId))continue;
   const rowKey=[org,id,p.phase].join('|');
   if(!grouped.has(rowKey))grouped.set(rowKey,{id,name:players[id]?.name||'Joueur non identifié ('+id+')',organization:org,season:archive.season,phase:p.phase,...empty()});
   const row=grouped.get(rowKey);row[field]++;
   if(status==='ACTIVE'&&['G','D','LW','C','RW'].includes(position))row[position.toLowerCase()]++;
  }
 }
 return{rows:[...grouped.values()],missingPeriods:missing};
}
export function combineUsage(rows,organization,season='all',phase='all'){
 const grouped=new Map();
 for(const row of rows){
  if(row.organization!==organization||season!=='all'&&row.season!==season||phase!=='all'&&row.phase!==phase)continue;
  if(!grouped.has(row.id))grouped.set(row.id,{id:row.id,name:row.name,...empty()});
  const total=grouped.get(row.id);for(const field of Object.keys(empty()))total[field]+=row[field];
 }
 return[...grouped.values()];
}
let pending;
async function json(path){const response=await fetch(new URL(path,import.meta.url),{cache:'no-cache'});if(!response.ok)throw Error('Archives indisponibles : '+path);return response.json()}
export function loadUsage(){
 if(!pending)pending=(async()=>{
  const [manifest,directory,playoffs]=await Promise.all([json('data/ownership/index.json'),json('data/ownership/players.json'),json('data/playoffs.json')]);
  const archives=await Promise.all(manifest.seasons.map(s=>json('data/ownership/'+s.file)));
  const reports=archives.map(a=>({season:a.season,...usageRows(a,directory.players,playoffs.seasons.find(s=>s.season===a.season))}));
  return{rows:reports.flatMap(r=>r.rows),seasons:manifest.seasons.map(s=>s.season).sort().reverse(),updatedAt:manifest.updatedAt,missing:reports.filter(r=>r.missingPeriods.length).map(r=>r.season+' : '+r.missingPeriods.join(', '))};
 })().catch(error=>{pending=null;throw error});
 return pending;
}
