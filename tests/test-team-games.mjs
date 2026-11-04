import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usageRows,combineUsage,organizationCode} from '../bhl-team-games.mjs';
const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url)));
const periods=Array.from({length:8},(_,i)=>({number:i+1,end:i===7?'2099-01-01':'2020-01-01',available:i!==6}));
const fixture={season:'test',firstPlayoffPeriod:3,periods,teams:{a:{name:'Cleveland Barons'},b:{name:'Detroit Red Wings'}},lineups:{one:[[1,1,'a','ACTIVE','LW'],[2,2,'a','RESERVE','C'],[3,4,'a','ACTIVE','C'],[5,5,'a','INJURED_RESERVE','C'],[6,8,'b','MINORS','D']]}};
const rounds={rounds:[{period:3,matches:[{teams:[{id:'a'},{id:'b'}]}]},{period:4,matches:[{teams:[{id:'b'}]}]},{period:5,matches:[{teams:[{id:'b'}]}]}]};
const rows=usageRows(fixture,{one:{name:'Test'}},rounds).rows;
const regular=combineUsage(rows,'BOS','all','regular')[0],playoffs=combineUsage(rows,'BOS','all','playoffs')[0];
assert.equal(regular.act,1);assert.equal(regular.res,1);assert.equal(regular.lw,1);assert.equal(regular.c,0);
assert.equal(playoffs.act,1);assert.equal(playoffs.ir,0);assert.equal(playoffs.c,1);
assert.equal(combineUsage(rows,'DET').length,0); // No counting after the final, missing or future periods.
assert.equal(combineUsage(rows,'BOS')[0].act,2);
assert.equal(organizationCode('Montréal Maroons'),'MTL');assert.equal(organizationCode('Edmonton Oilers'),'OTT');
const manifest=read('data/ownership/index.json'),players=read('data/ownership/players.json').players,brackets=read('data/playoffs.json').seasons;
let all=[];
for(const entry of manifest.seasons){
 const archive=read('data/ownership/'+entry.file),bracket=brackets.find(s=>s.season===archive.season);
 const report=usageRows(archive,players,bracket);assert.deepEqual(report.missingPeriods,[]);
 for(const row of report.rows){assert.equal(row.act,row.g+row.d+row.lw+row.c+row.rw);assert.ok(row.name);}
 if(bracket){
  for(const row of report.rows.filter(r=>r.phase==='playoffs')){
   const eligible=bracket.rounds.filter(r=>r.matches.some(m=>m.teams.some(t=>organizationCode(t.name)===row.organization))).length;
   assert.ok(row.act+row.res+row.ir+row.min<=eligible,JSON.stringify(row));
  }
 }
 for(const org of new Set(report.rows.map(r=>r.organization))){
  const total=combineUsage(report.rows,org),reg=combineUsage(report.rows,org,'all','regular'),post=combineUsage(report.rows,org,'all','playoffs');
  for(const p of total)for(const field of ['act','res','ir','min'])assert.equal(p[field],(reg.find(r=>r.id===p.id)?.[field]||0)+(post.find(r=>r.id===p.id)?.[field]||0));
 }
 all.push(...report.rows);
}
const ott=combineUsage(all,'OTT','2025-26','playoffs');assert.equal(Math.max(...ott.map(p=>p.act)),3);
const covid=all.filter(r=>r.season==='2019-20'&&r.phase==='playoffs');assert.ok(covid.every(r=>r.act+r.res+r.ir+r.min<=2));
console.log('PASS: status changes, transfers, eliminated teams, COVID, missing/open periods, phase totals and all '+manifest.seasons.length+' seasons.');
