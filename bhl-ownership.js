import {resolvePlayer,ownershipRows,lineupRows,periodLabel,nameKey} from './bhl-ownership-core.mjs?v=1';
const requests=new Map();
function json(path){if(!requests.has(path))requests.set(path,fetch(path,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Archive indisponible');return r.json();}).catch(e=>{requests.delete(path);throw e;}));return requests.get(path);}
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
const logos={
 anaheimmightyducks:'anaheim-mightyducks.png',atlantathrashers:'atlanta-thrashers.png',clevelandbarons:'cleveland-barons.png',bostonbruins:'boston-bruins.png',californiagoldenseals:'california-goldenseals.png',chicagoblackhawks:'chicago-blackhawks.png',winnipegjets:'winnipeg-jets.png',coloradoavalanche:'colorado-avalanche.png',detroitcougars:'detroit-cougars.png',detroitredwings:'detroit-redwings.png',floridapanthers:'florida-panthers.png',vegasgoldenknights:'vegas-golden-knights.png',hartfordwhalers:'hartford-whalers.png',minnesotanorthstars:'minnesota-northstars.png',montrealmaroons:'montreal-maroons.png',montrealcanadiens:'montreal-canadiens.png',nashvillepredators:'nashville-predators.png',newyorkrangers:'newyork-rangers.png',edmontonoilers:'edmonton-oilers.png',ottawasenators:'ottawa-senators.png',quebecnordiques:'quebec-nordiques.png',torontomapleleafs:'toronto-mapleleafs.png'};
const date=value=>new Intl.DateTimeFormat('fr-CA',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Toronto'}).format(new Date(value));
export async function renderOwnership(name,target,fantraxId){
 if(!document.querySelector('link[href^="bhl-ownership.css"]')){const css=el('link');css.rel='stylesheet';css.href='bhl-ownership.css?v=1';document.head.append(css);}
 target.classList.add('bhl-ownership');target.replaceChildren(el('p','Chargement de l’historique d’appartenance…','ownership-note'));
 try{
  const [manifest,directory]=await Promise.all([json('data/ownership/index.json'),json('data/ownership/players.json')]);
  if(!target.isConnected)return;
  const id=resolvePlayer(directory.players,fantraxId,name);
  if(!id){target.replaceChildren(el('h4','Appartenance BHL'),el('p','Aucune identité Fantrax unique n’a pu être confirmée pour ce joueur. Ouvre sa fiche depuis un effectif pour consulter un historique confirmé.','ownership-empty'));return;}
  target.replaceChildren();const intro=el('div',undefined,'ownership-intro');intro.append(el('h4','Appartenance BHL'),el('p','Les organisations auxquelles ce joueur appartenait dans les effectifs Fantrax de chaque période.'));target.append(intro);
  const controls=el('div',undefined,'ownership-controls'),seasonLabel=el('label','Saison'),seasonSelect=el('select'),modeLabel=el('label','Affichage'),modeSelect=el('select');
  seasonSelect.setAttribute('aria-label','Saison de l’historique d’appartenance');modeSelect.setAttribute('aria-label','Regrouper les périodes d’appartenance');
  for(const item of manifest.seasons){const opt=el('option',item.season);opt.value=item.season;seasonSelect.append(opt);}const all=el('option','Toutes les saisons');all.value='all';seasonSelect.append(all);if(directory.players[id].seasons?.length)seasonSelect.value=directory.players[id].seasons[0];
  for(const [value,label] of [['ranges','Regrouper les périodes'],['periods','Une ligne par période'],['lineups','Statut dans l’alignement']]){const opt=el('option',label);opt.value=value;modeSelect.append(opt);}
  seasonLabel.append(seasonSelect);modeLabel.append(modeSelect);controls.append(seasonLabel,modeLabel);target.append(controls);
  const content=el('div'),notice=el('p','Source : effectifs Fantrax archivés par période. Les mouvements effectués entre deux instantanés ne sont pas détaillés.','ownership-note');content.setAttribute('aria-live','polite');target.append(content,notice);let generation=0;
  async function draw(){
   const token=++generation;content.replaceChildren(el('p','Chargement…','ownership-note'));
   const selected=manifest.seasons.filter(s=>seasonSelect.value==='all'||s.season===seasonSelect.value);
   const results=await Promise.allSettled(selected.map(s=>json('data/ownership/'+s.file)));
   if(token!==generation||!target.isConnected)return;
   const rows=[],failed=[];results.forEach((r,i)=>{if(r.status==='fulfilled')rows.push(...(modeSelect.value==='lineups'?lineupRows(r.value,id):ownershipRows(r.value,id,modeSelect.value==='periods')));else failed.push(selected[i].season);});
   content.replaceChildren();
   if(failed.length){const warning=el('div',undefined,'ownership-empty');warning.append(el('p','Archives momentanément indisponibles : '+failed.join(', ')+'.'));const retry=el('button','Réessayer');retry.type='button';retry.onclick=()=>draw().catch(showError);warning.append(retry);content.append(warning);}
   if(!rows.length){if(!failed.length)content.append(el('p','Aucun effectif archivé pour cette saison.','ownership-empty'));return;}
   const owned=rows.filter(r=>r.state==='owned');const summary=el('div',undefined,'ownership-summary');summary.append(el('strong',new Set(owned.map(r=>r.team)).size+' organisation'+(new Set(owned.map(r=>r.team)).size>1?'s':'')),el('span',owned.length?' dans la sélection':' · Aucune équipe répertoriée dans la sélection'));content.append(summary);
   const scroll=el('div',undefined,'ownership-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Historique d’appartenance de '+name);
   const table=el('table'),caption=el('caption','Appartenance BHL — '+name);table.append(caption);const head=el('thead'),tr=el('tr');for(const h of ['Saison','Période','Équipe BHL',...(modeSelect.value==='lineups'?['Statut','Poste']:[]),'Dates Fantrax']){const th=el('th',h);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=el('tbody');
   for(const row of rows){const tr=el('tr');tr.append(el('td',row.season),el('td',periodLabel(row)+(Date.now()>=Date.parse(row.start)&&Date.now()<=Date.parse(row.end)?' · en cours':'')));const team=el('td');if(row.state==='owned'){const label=el('span',undefined,'ownership-team'),file=logos[nameKey(row.team)];if(file){const img=el('img');img.src='logos/'+file;img.alt='';img.loading='lazy';img.width=30;img.height=30;img.onerror=()=>img.hidden=true;label.append(img);}label.append(el('strong',row.team));team.append(label);}else team.append(el('span',row.state==='missing'?'Archive indisponible':'Aucune équipe répertoriée','ownership-unlisted'));tr.append(team);if(modeSelect.value==='lineups'){tr.append(el('td',({ACTIVE:'Partant',RESERVE:'Banc',MINORS:'Mineures',INJURED_RESERVE:'Blessés'})[row.status]||'—'),el('td',row.position||'—'));}tr.append(el('td',date(row.start)+' au '+date(row.end)));body.append(tr);}table.append(body);scroll.append(table);content.append(scroll);
   if(rows.some(r=>r.state==='unlisted'))content.append(el('p','« Aucune équipe répertoriée » indique une absence des effectifs archivés; cela ne prouve pas une signature ou une libération à une date précise.','ownership-note'));
   if(rows.some(r=>r.state==='missing'))content.append(el('p','Les périodes indisponibles restent signalées; aucune appartenance n’est extrapolée.','ownership-note'));
  }
  function showError(){content.replaceChildren(el('p','Impossible de charger cette archive. Réessaie en changeant de saison.','ownership-empty'));}
  seasonSelect.onchange=()=>draw().catch(showError);modeSelect.onchange=()=>draw().catch(showError);await draw();
 }catch(error){if(target.isConnected){target.replaceChildren(el('p','Impossible de charger l’historique d’appartenance.','ownership-empty'));const retry=el('button','Réessayer');retry.type='button';retry.onclick=()=>renderOwnership(name,target,fantraxId);target.append(retry);}}
}
