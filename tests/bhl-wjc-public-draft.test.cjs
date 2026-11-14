const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('bhl-mondial-junior.js','utf8');
let html='';
const context={publicDraft:null,liveEdition:{teams:[{id:'a',name:'Équipe A'}]},liveLoadError:'',lastLiveCheck:null,
 $:()=>({set innerHTML(value){html=value}}),esc:s=>String(s??'').replace(/</g,'&lt;'),
 head:t=>t,teamLink:t=>t.name,playerLink:p=>p.name,
 table:(headers,rows)=>rows.join('')};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function renderPublicDraft(){')),context);
function render(board){context.publicDraft=board;context.renderPublicDraft();return html;}
assert.match(render(null),/Chargement du repêchage/);
const picks=[{number:1,teamId:'a',player:null},{number:2,teamId:'a',player:null}];
assert.match(render({status:'setup',completed:0,picks}),/Prochain choix : nº 1/);
assert.match(render({status:'open',completed:0,picks}),/Au tour de Équipe A/);
picks[0].player={name:'Joueur Test',position:'D',birthYear:2008,country:'Canada'};
assert.match(render({status:'open',completed:1,picks}),/Joueur Test/);
assert.match(html,/Prochain choix : nº 2/);
assert.match(render({status:'paused',completed:1,picks}),/En pause/);
assert.match(render({status:'complete',completed:2,picks}),/Toutes les sélections/);
context.liveLoadError='offline';
assert.match(render({status:'open',completed:1,picks}),/dernières données reçues/);
assert.match(html,/Joueur Test/);
console.log('Public draft board: loading, setup, live picks, unequal repeated picks, pause, completion and stale connection passed.');
