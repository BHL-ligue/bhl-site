import {normalizeGrid,readGrid,parseGridPaste,createGridElement,GRID_LIMITS} from './bhl-news-grid-model.mjs?v=1';
export function registerGrid(Quill){
 const BlockEmbed=Quill.import('blots/block/embed');
 class ArticleGrid extends BlockEmbed{
  static blotName='articleGrid';static tagName='DIV';static className='bhl-article-grid';
  static create(value){const root=super.create(),safe=createGridElement(value);if(safe){root.dataset.bhlGrid=safe.dataset.bhlGrid;root.setAttribute('contenteditable','false');root.append(...safe.childNodes);}return root;}
  static value(root){return readGrid(root.dataset.bhlGrid);}
 }
 Quill.register(ArticleGrid,true);
}
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
export function attachGrid(editor,Quill,toolbar){
 const Delta=Quill.import('delta');editor.clipboard.addMatcher('div[data-bhl-grid]',node=>{const value=readGrid(node.dataset.bhlGrid);return value?new Delta().insert({articleGrid:value}):new Delta();});
 const tool=el('button','Grille','bhl-grid-tool');tool.type='button';tool.title='Insérer ou modifier une grille';toolbar.append(tool);
 let selected=null;
 editor.root.addEventListener('click',event=>{selected=event.target.closest('.bhl-article-grid');editor.root.querySelectorAll('.bhl-grid-selected').forEach(n=>n.classList.remove('bhl-grid-selected'));if(selected)selected.classList.add('bhl-grid-selected');});
 editor.root.addEventListener('dblclick',event=>{if(event.target.closest('.bhl-article-grid')&&editor.isEnabled())open();});
 tool.onclick=()=>{if(editor.isEnabled())open();};
 function open(){
  const replacing=selected?.isConnected?selected:null;
  const range=editor.getSelection(true)||{index:editor.getLength()-1,length:0};
  let data=readGrid(replacing?.dataset.bhlGrid)||{title:'',columns:['Nom','Position','Cote'],rows:[['','',''],['','',''],['','','']]};
  const dialog=el('dialog',undefined,'bhl-grid-dialog');dialog.setAttribute('aria-label','Créer ou modifier une grille');
  const heading=el('h2',replacing?'Modifier la grille':'Insérer une grille'),hint=el('p','Renomme les colonnes et remplis les cases. Tu peux aussi importer des cellules depuis Excel ou Google Sheets.');
  const titleLabel=el('label','Titre de la grille (facultatif)'),title=el('input');title.type='text';title.maxLength=100;title.value=data.title;titleLabel.append(title);
  const presets=el('div',undefined,'bhl-grid-actions'),tableWrap=el('div',undefined,'bhl-grid-edit-scroll'),table=el('table',undefined,'bhl-grid-edit');table.setAttribute('data-bhl-table-skip','');tableWrap.append(table);
  const tools=el('div',undefined,'bhl-grid-actions'),preview=el('div',undefined,'bhl-grid-preview'),feedback=el('p','','bhl-grid-feedback');feedback.setAttribute('role','status');
  function button(label,action,parent=tools){const b=el('button',label);b.type='button';b.onclick=action;parent.append(b);return b;}
  button('Grille simple',()=>{if(!confirmReset())return;data={title:title.value,columns:['Élément','Information','Valeur'],rows:[['','',''],['','',''],['','','']]};draw();},presets);
  button('Joueurs et cotes',()=>{if(!confirmReset())return;data={title:title.value,columns:['Joueur','Pos.','Palier','SK','PS','HS','CO','SH'],rows:[Array(8).fill(''),Array(8).fill(''),Array(8).fill('')]};draw();},presets);
  function confirmReset(){return !data.rows.some(r=>r.some(v=>v.trim()))||confirm('Remplacer les cellules de cette grille par le modèle choisi?');}
  const addRow=button('+ Ligne',()=>{if(data.rows.length<GRID_LIMITS.rows){data.rows.push(Array(data.columns.length).fill(''));draw();}});
  const addColumn=button('+ Colonne',()=>{if(data.columns.length<GRID_LIMITS.columns){data.columns.push('Colonne '+(data.columns.length+1));data.rows.forEach(r=>r.push(''));draw();}});
  const paste=el('details',undefined,'bhl-grid-paste'),summary=el('summary','Importer des cellules'),pasteHint=el('p','Copie une plage de cellules, puis colle-la ici. Pour du texte simple, sépare les colonnes avec | et les lignes avec Entrée.'),pasteArea=el('textarea');pasteArea.rows=4;pasteArea.placeholder='Joueur\tPosition\tCote\nNick Suzuki\tC\t8';pasteArea.setAttribute('aria-label','Cellules à importer');
  const hasHeaders=el('input');hasHeaders.type='checkbox';hasHeaders.checked=true;const headerLabel=el('label',undefined,'bhl-grid-check');headerLabel.append(hasHeaders,document.createTextNode('La première ligne contient les titres des colonnes'));paste.append(summary,pasteHint,pasteArea,headerLabel);
  button('Importer',()=>{try{const imported=parseGridPaste(pasteArea.value,hasHeaders.checked);data={...imported,title:title.value};draw();feedback.textContent='Cellules importées. Vérifie l’aperçu avant d’insérer.';}catch(error){feedback.textContent=error.message;}},paste);
  const actions=el('div',undefined,'bhl-grid-actions bhl-grid-final');button('Annuler',()=>dialog.close(),actions);
  button(replacing?'Enregistrer la grille':'Insérer la grille',()=>{
   if(!editor.isEnabled())return;data.title=title.value;const value=normalizeGrid(data);if(!value||!value.rows.some(r=>r.some(v=>v.trim()))){feedback.textContent='Ajoute au moins une cellule de contenu.';return;}
   const rendered=createGridElement(value);const oldLength=replacing?.outerHTML.length||0;
   if(editor.getSemanticHTML().length-oldLength+rendered.outerHTML.length>199500){feedback.textContent='Cette grille rendrait l’article trop long. Réduis le nombre de lignes ou le texte dans les cases.';return;}
   const index=replacing?editor.getIndex(Quill.find(replacing)):Math.min(range.index,editor.getLength()-1);
   editor.history.cutoff();if(replacing)editor.deleteText(index,1,'user');editor.insertEmbed(index,'articleGrid',value,'user');if(!replacing)editor.insertText(index+1,'\n','user');editor.setSelection(index+2,0,'silent');selected=null;dialog.close();editor.focus();
  },actions).className='primary';
  function updatePreview(){data.title=title.value;preview.replaceChildren(createGridElement(data));}
  function draw(){
   table.replaceChildren();const thead=el('thead'),tr=el('tr');
   data.columns.forEach((name,c)=>{const th=el('th'),input=el('input');input.value=name;input.maxLength=40;input.setAttribute('aria-label','Titre de la colonne '+(c+1));input.oninput=()=>{data.columns[c]=input.value;updatePreview();};th.append(input);const remove=el('button','×');remove.type='button';remove.setAttribute('aria-label','Supprimer la colonne '+(c+1));remove.disabled=data.columns.length===1;remove.onclick=()=>{data.columns.splice(c,1);data.rows.forEach(r=>r.splice(c,1));draw();};th.append(remove);tr.append(th);});tr.append(el('th',''));thead.append(tr);table.append(thead);
   const tbody=el('tbody');data.rows.forEach((row,r)=>{const tr=el('tr');data.columns.forEach((_,c)=>{const td=el('td'),input=el('input');input.value=row[c]||'';input.maxLength=GRID_LIMITS.cell;input.setAttribute('aria-label','Ligne '+(r+1)+', colonne '+(c+1));input.oninput=()=>{data.rows[r][c]=input.value;updatePreview();};td.append(input);tr.append(td);});const td=el('td'),remove=el('button','×');remove.type='button';remove.setAttribute('aria-label','Supprimer la ligne '+(r+1));remove.disabled=data.rows.length===1;remove.onclick=()=>{data.rows.splice(r,1);draw();};td.append(remove);tr.append(td);tbody.append(tr);});table.append(tbody);addRow.disabled=data.rows.length>=GRID_LIMITS.rows;addColumn.disabled=data.columns.length>=GRID_LIMITS.columns;updatePreview();
  }
  title.oninput=updatePreview;dialog.append(heading,hint,titleLabel,presets,tableWrap,tools,paste,el('h3','Aperçu'),preview,feedback,actions);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});draw();dialog.showModal();title.focus();
 }
}
