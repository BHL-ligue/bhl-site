import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.isConnected=true;this.textContent='';this.value='';this.classList={add(){}};}
 append(...nodes){this.children.push(...nodes);if(this.tagName==='select'&&!this.value&&nodes.length)this.value=nodes[0].value;}replaceChildren(...nodes){this.children=nodes;}setAttribute(){}
}
globalThis.document={createElement:tag=>new Element(tag),head:new Element('head'),querySelector:()=>true};
globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL('../'+path,import.meta.url)))});
const source=await fs.readFile(new URL('../bhl-ownership.js',import.meta.url),'utf8');
const core=new URL('../bhl-ownership-core.mjs?v=1',import.meta.url).href;
const {renderOwnership}=await import('data:text/javascript;base64,'+Buffer.from(source.replace('./bhl-ownership-core.mjs?v=1',core)).toString('base64'));
const target=new Element('section');await renderOwnership('Nick Suzuki',target,'');
assert.equal(target.children.length,4);const controls=target.children[1],season=controls.children[0].children[0],mode=controls.children[1].children[0],content=target.children[2];
assert.equal(season.children.length,10);season.value='2025-26';await season.onchange();
const table=content.children[1].children[0],body=table.children[2];assert.equal(body.children.length,2);assert.equal(body.children[0].children[1].textContent,'Périodes 1 à 18');
assert.equal(body.children[1].children[2].children[0].children[1].textContent,'Anaheim Mighty Ducks');
mode.value='periods';await mode.onchange();assert.equal(content.children[1].children[0].children[2].children.length,24);
mode.value='lineups';await mode.onchange();assert.equal(content.children[1].children[0].children[2].children[0].children.length,6);season.value='all';await season.onchange();assert(content.children[1].children[0].children[2].children.length>100);
const unknown=new Element('section');await renderOwnership('Nick Suzuki',unknown,'nonexistent');assert(unknown.children[1].textContent.includes('Aucune identité'));
console.log('PASS: UI season switching, period mode, all seasons, safe unknown identity, generated rows and team labels.');
