/* Makes exact, unambiguous BHL player names open their profile across the site. */
(function(){
 'use strict';
 const excluded='a,button,input,textarea,select,option,script,style,noscript,code,pre,svg,math,[contenteditable="true"],[data-no-player-link],.bhl-player-inline-link,.bhl-player-dialog';
 function escape(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
 function eligible(node){
  const parent=node.parentElement;
  return parent&&!parent.closest(excluded)&&node.nodeValue&&/[\p{L}]/u.test(node.nodeValue);
 }
 function addLinks(root,pattern,players){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){return eligible(node)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const textNode of nodes){
   const text=textNode.nodeValue;pattern.lastIndex=0;let match,last=0,changed=false;
   const fragment=document.createDocumentFragment();
   while((match=pattern.exec(text))){
    const name=match[0],item=players.get(name.toLocaleLowerCase('fr'));
    if(!item){continue}
    if(match.index>last)fragment.append(document.createTextNode(text.slice(last,match.index)));
    const button=document.createElement('button');button.type='button';button.className='bhl-player-inline-link';
    button.dataset.bhlPlayerId=item.id;button.dataset.bhlPlayerName=item.canonicalName||item.name;
    button.setAttribute('aria-label','Ouvrir la fiche de '+(item.canonicalName||item.name));
    button.title='Ouvrir la fiche de '+(item.canonicalName||item.name);button.textContent=name;fragment.append(button);
    last=match.index+name.length;changed=true;
   }
   if(changed){if(last<text.length)fragment.append(document.createTextNode(text.slice(last)));textNode.replaceWith(fragment)}
  }
 }
 fetch('data/player-profile-index.json',{cache:'force-cache'}).then(response=>{
  if(!response.ok)throw Error('Player profile index unavailable');return response.json();
 }).then(data=>{
  const players=new Map();
  for(const player of data.players||[])if(player?.name&&player?.id&&!players.has(player.name.toLocaleLowerCase('fr')))players.set(player.name.toLocaleLowerCase('fr'),player);
  const names=[...players.keys()].sort((a,b)=>b.length-a.length||a.localeCompare(b,'fr'));
  if(!names.length)return;
  const pattern=new RegExp('(?<![\\p{L}\\p{N}])(?:'+names.map(escape).join('|')+')(?![\\p{L}\\p{N}])','giu');
  const enhanceAnchors=root=>{
   const anchors=[];if(root.matches?.('a'))anchors.push(root);anchors.push(...(root.querySelectorAll?.('a:not([data-bhl-player-id])')||[]));
   for(const anchor of anchors){
    if(anchor.hasAttribute('data-bhl-player-id'))continue;
    const label=anchor.textContent.trim().replace(/\s+/g,' '),item=players.get(label.toLocaleLowerCase('fr'));
    if(!item)continue;
    anchor.dataset.bhlPlayerId=item.id;anchor.dataset.bhlPlayerName=item.canonicalName||item.name;anchor.classList.add('bhl-player-inline-link');
    anchor.setAttribute('aria-label','Ouvrir la fiche de '+(item.canonicalName||item.name));anchor.title='Ouvrir la fiche de '+(item.canonicalName||item.name);
   }
  };
  enhanceAnchors(document.body);
  addLinks(document.body,pattern,players);
  new MutationObserver(records=>{
   for(const record of records)for(const node of record.addedNodes){
    if(node.nodeType===Node.TEXT_NODE){if(eligible(node))addLinks(node.parentNode,pattern,players)}
    else if(node.nodeType===Node.ELEMENT_NODE&&!node.closest(excluded)){enhanceAnchors(node);addLinks(node,pattern,players)}
   }
  }).observe(document.body,{childList:true,subtree:true});
 }).catch(error=>console.warn('Profils joueurs indisponibles',error));
})();
