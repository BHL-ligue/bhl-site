export const GRID_LIMITS={columns:8,rows:30,cell:160};
const text=(value,max)=>String(value??'').replace(/\r\n?/g,'\n').slice(0,max);
export function normalizeGrid(value){
 if(!value||!Array.isArray(value.columns)||value.columns.length<1||value.columns.length>GRID_LIMITS.columns||!Array.isArray(value.rows)||value.rows.length>GRID_LIMITS.rows)return null;
 const columns=value.columns.map((v,i)=>text(v,40).trim()||'Colonne '+(i+1));
 if(value.rows.some(row=>!Array.isArray(row)))return null;
 const rows=value.rows.map(row=>columns.map((_,i)=>text(row[i],GRID_LIMITS.cell)));
 return {version:1,title:text(value.title,100),columns,rows};
}
export function readGrid(value){try{return normalizeGrid(typeof value==='string'?JSON.parse(value):value);}catch{return null;}}
export function parseGridPaste(input,withHeaders=true){
 const lines=String(input||'').replace(/\r\n?/g,'\n').replace(/\n+$/,'').split('\n');
 if(!input?.trim())throw Error('Colle des cellules avant de les importer.');
 const matrix=lines.map(line=>line.split(line.includes('\t')?'\t':'|').map(v=>v.trim()));
 const width=Math.max(...matrix.map(r=>r.length));
 if(width>GRID_LIMITS.columns||matrix.length>(GRID_LIMITS.rows+(withHeaders?1:0)))throw Error('Maximum de 8 colonnes et 30 lignes.');
 const columns=withHeaders?matrix.shift():Array.from({length:width},(_,i)=>'Colonne '+(i+1));
 while(columns.length<width)columns.push('Colonne '+(columns.length+1));
 return normalizeGrid({title:'',columns,rows:matrix.length?matrix:[Array(width).fill('')]});
}
export function createGridElement(value){
 const grid=normalizeGrid(value);if(!grid)return null;
 const root=document.createElement('div');root.className='bhl-article-grid';root.dataset.bhlGrid=JSON.stringify(grid);root.setAttribute('contenteditable','false');
 const table=document.createElement('table');table.setAttribute('data-bhl-table-skip','');
 if(grid.title){const caption=document.createElement('caption');caption.textContent=grid.title;table.append(caption);}else table.setAttribute('aria-label','Grille de l’article');
 const thead=document.createElement('thead'),header=document.createElement('tr');
 for(const name of grid.columns){const th=document.createElement('th');th.scope='col';th.textContent=name;if(/^(joueur|nom|élément|description|information)$/i.test(name.trim()))th.className='bhl-grid-text-column';header.append(th);}thead.append(header);table.append(thead);
 const tbody=document.createElement('tbody');for(const row of grid.rows){const tr=document.createElement('tr');for(const [i,cell]of row.entries()){const td=document.createElement('td');td.textContent=cell;if(/^(joueur|nom|élément|description|information)$/i.test(grid.columns[i].trim()))td.className='bhl-grid-text-column';tr.append(td);}tbody.append(tr);}table.append(tbody);root.append(table);return root;
}
