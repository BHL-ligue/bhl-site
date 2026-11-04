import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolvePlayer,ownershipRows,lineupRows,periodLabel} from '../bhl-ownership-core.mjs';
const dir=new URL('../data/ownership/',import.meta.url),players=JSON.parse(fs.readFileSync(new URL('players.json',dir))).players;
const suzuki=resolvePlayer(players,null,'Nick Suzuki');assert(suzuki);
const archive=JSON.parse(fs.readFileSync(new URL('2025-26.json',dir)));
const rows=ownershipRows(archive,suzuki).filter(r=>r.state==='owned');
assert.equal(rows.length,2);assert.equal(rows[0].first,1);assert.equal(rows[0].last,18);assert.equal(rows[0].team,'Detroit Red Wings');assert.equal(rows[1].first,19);assert.equal(rows[1].last,24);assert.equal(rows[1].team,'Anaheim Mighty Ducks');
assert.equal(ownershipRows(archive,suzuki,true).length,24);
assert.equal(resolvePlayer(players,'invalid-id','Nick Suzuki'),null);
assert.equal(resolvePlayer({a:{name:'Homonyme'},b:{name:'Homonyme'}},null,'Homonyme'),null);
const sample={season:'2020-21',teams:{a:{name:'Équipe A'}},periods:[{number:1,available:true},{number:2,available:false},{number:3,available:true},{number:4,available:true}],ownership:{p:[[1,1,'a'],[3,3,'a']]}};
const split=ownershipRows(sample,'p');assert.deepEqual(split.map(r=>r.state),['owned','missing','owned','unlisted']);assert.equal(periodLabel(split[0]),'Période 1');
const empty=ownershipRows(sample,'unknown');assert.equal(empty[0].state,'unlisted');assert.equal(empty[1].state,'missing');
console.log('PASS: exact IDs, ambiguous names, period gaps, unlisted players, regrouping and confirmed Suzuki history.');

assert.equal(lineupRows(archive,suzuki).length,24);assert(lineupRows(archive,suzuki).every(r=>r.status));
