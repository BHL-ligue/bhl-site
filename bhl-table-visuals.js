/* Shared presentation only. Cell content, row order and application handlers stay owned by each page. */
(()=>{
'use strict';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[↕↥↧↑↓▲▼]/g,'').replace(/\s+/g,' ').trim();
const states=new WeakMap(),pending=new Set();let scheduled=false;
const numberText=s=>/^[\d\s.,%$€+−\-–—():/hmsM]+$/.test(s.trim())&&/\d/.test(s);
function describe(header,index,rows){
 const label=normalize(header.textContent),cells=rows.map(r=>r.cells[index]).filter(c=>c&&c.colSpan===1),texts=cells.map(c=>c.textContent.trim()).filter(Boolean);
 const controls=cells.some(c=>c.querySelector('input,select,textarea,button:not(.bhl-player-open):not(.bhl-player-click):not(.bhl-player-link):not(.player-profile):not(.scorer-player):not(.gp-sort):not(.bhl-player-name)'));
 // A player's profile button is content, not an administrative action column.
 const isPlayer=/joueur|player/.test(label);
 if(label==='#'||/^(rang(?: bhl)?|choix|no\.?|numero)$/.test(label))return{kind:'rank',width:38};
 if(/^(pos(?:ition)?|poste)$/.test(label))return{kind:'short',width:48};
 if(/saison|annee/.test(label))return{kind:'season',width:/saisons/.test(label)?112:68};
 if(/equipe|organisation|adversaire|proprietaire|club/.test(label)){
  const hasImages=cells.some(c=>c.querySelector('img'));
  if(hasImages&&texts.length===0){const count=Math.max(1,...cells.map(c=>c.querySelectorAll('img').length));return{kind:'logos',width:Math.max(28,Math.min(label.length*5+10,84),Math.min(count,3)*17+8)}}
  if(!hasImages&&texts.length&&texts.every(t=>t.length<=5))return{kind:'short',width:52};
  return{kind:'team',width:144};
 }
 if(isPlayer||/capitaine|assistant|responsable|gagnant|^nom$|auteur/.test(label))return{kind:'person',width:144};
 if(/courriel|email/.test(label))return{kind:'text',width:190};
 if(/contexte|detail|distinction|trophee|provenance/.test(label))return{kind:'text',width:170};
 if(/date|modification/.test(label))return{kind:'text',width:108};
 if(controls||/action|gestion|decision|attribuer/.test(label))return{kind:'control',width:164};
 if(/resultat|statut|origine/.test(label))return{kind:'text',width:104};
 if(/^(pj|gp|v|d|n|b|a|g|c|lw|rw|ir|act|res|min|pts|w|ba|arr|bl|tk)$/.test(label))return{kind:'number',width:44};
 const numeric=/fpts|fp\/|fpt|points|total|victoire|defaite|pourcentage|%|ecart|pour|contre|moyenne|buts|passes|tirs|departs|protections|matchs|valeur|coupe|trophees/.test(label)||texts.length>0&&texts.every(numberText);
 if(numeric){const money=texts.some(t=>/[$€]/.test(t)),longest=Math.max(label.length,...texts.map(t=>t.length),0);return{kind:'number',width:money?88:/fp\/|fpts|total|valeur/.test(label)?72:longest>10?80:52,primary:/^(fpts|fpts pour|total|valeur)$/.test(label)}}
 return{kind:'text',width:120};
}
function wrap(table){
 const parent=table.parentElement;if(!parent)return;
 const known=parent.matches('.tablewrap,.table-wrap,.table-scroll,.scroll,.bhl-player-scroll,.bhl-ft-table,.bhl-table-scroll,.bhl-ownership-scroll')||/^(auto|scroll)$/.test(getComputedStyle(parent).overflowX);
 let wrapper=parent;
 if(!known){wrapper=document.createElement('div');wrapper.className='bhl-table-scroll';table.before(wrapper);wrapper.append(table)}
 wrapper.classList.add('bhl-table-scroll');
 for(let p=wrapper.parentElement,depth=0;p&&depth<3&&p.tagName!=='BODY';p=p.parentElement,depth++)p.classList.add('bhl-table-host');
}
function enhance(table){
 if(!table.isConnected||table.matches('.scorer-table,[data-bhl-table-skip]')||table.closest('[contenteditable="true"]'))return;
 const header=table.tHead?.rows[0]||([...table.rows][0]?.querySelector('th')?[...table.rows][0]:null);
 if(!header){if([...table.rows].every(r=>r.cells.length===2))table.classList.add('bhl-summary-table');return}
 const labels=[...header.cells];if(labels.length<2)return;
 const rows=[...table.tBodies].flatMap(body=>[...body.rows]).filter(r=>r!==header&&r.cells.length===labels.length&&[...r.cells].every(c=>c.colSpan===1&&c.rowSpan===1));
 if(labels.some(c=>c.colSpan!==1||c.rowSpan!==1)||table.tHead?.rows.length>1)return;
 const samples=rows.slice(0,12),descriptions=labels.map((h,i)=>describe(h,i,samples));
 const signature=labels.map(h=>h.textContent).join('|')+';'+rows.length+';'+descriptions.map(d=>d.kind+':'+d.width).join('|');
 const previous=states.get(table);if(previous?.signature===signature&&previous.header===header&&previous.rows.length===rows.length&&previous.rows.every((r,i)=>r===rows[i]))return;states.set(table,{signature,header,rows});
 wrap(table);table.classList.add('bhl-data-table','bhl-visual-table');
 let group=table.querySelector(':scope > colgroup');
 if(!group){group=document.createElement('colgroup');group.dataset.bhlVisualColumns='true';table.prepend(group)}
 // Existing authored colgroups are retained. They remain the page's geometry authority.
 if(group.dataset.bhlVisualColumns){
  group.replaceChildren();const total=descriptions.reduce((sum,d)=>sum+d.width,0);
  table.style.setProperty('--bhl-table-width',total+'px');
  for(const d of descriptions){const col=document.createElement('col');col.className='bhl-visual-column';col.style.setProperty('--bhl-column-width',d.width+'px');col.style.setProperty('--bhl-column-ratio',(d.width/total*100)+'%');group.append(col)}
 }
 const pin=[];
 if(descriptions.length>=4){
  if(['rank','short','season','team','person'].includes(descriptions[0].kind))pin.push(0);
  if(['rank','short','season'].includes(descriptions[0].kind)&&['team','person'].includes(descriptions[1].kind)&&descriptions[0].width+descriptions[1].width<=214)pin.push(1);
 }
 const allRows=[header,...rows];
 for(const row of allRows)for(let i=0;i<descriptions.length;i++){
  const cell=row.cells[i],d=descriptions[i];if(!cell)continue;
  for(const cls of [...cell.classList])if(cls.startsWith('bhl-cell-'))cell.classList.remove(cls);
  cell.classList.add('bhl-cell-'+d.kind);
  if(d.primary)cell.classList.add('bhl-cell-primary');
  if(pin.includes(i)){cell.classList.add('bhl-cell-pinned');cell.style.setProperty('--bhl-cell-left',descriptions.slice(0,i).reduce((n,c)=>n+c.width,0)+'px');if(i===pin.at(-1))cell.classList.add('bhl-cell-pin-edge')}
 }
}
function flush(){scheduled=false;const batch=[...pending];pending.clear();for(const table of batch)enhance(table)}
function queue(table){if(table?.tagName!=='TABLE')return;pending.add(table);if(!scheduled){scheduled=true;requestAnimationFrame(flush)}}
function scan(root){if(root.nodeType!==1&&root.nodeType!==9)return;if(root.tagName==='TABLE')queue(root);for(const table of root.querySelectorAll('table'))queue(table)}
function start(){scan(document);const observer=new MutationObserver(records=>{for(const record of records){const target=record.target.nodeType===1?record.target:record.target.parentElement;const table=target?.closest('table');if(table)queue(table);for(const node of record.addedNodes)scan(node)}});observer.observe(document.body,{childList:true,subtree:true})}
window.BHLTableVisuals={refresh:()=>scan(document)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
