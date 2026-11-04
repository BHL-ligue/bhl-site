const seasonLabel=season=>String(season||'').replace('-', '–');
const imageSeasons=season=>{const [year,end]=String(season||'').split('-');if(!year||!end)return ['20252026'];const prior=String(Number(year)-1);return [year+'20'+end,prior+'20'+year.slice(-2)]};
const number=value=>Number(value||0).toLocaleString('fr-CA',{minimumFractionDigits:1,maximumFractionDigits:2});
const groups=[['forward','Attaquants'],['defense','Défenseurs'],['goalie','Gardiens']];
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('fr');
function renderPlayer(player,rank,season){
 const row=document.createElement('li');row.className='home-leader-row';
 const place=document.createElement('span');place.className='home-leader-rank';place.textContent=String(rank).padStart(2,'0');
 const photo=document.createElement('span');photo.className='home-leader-photo';photo.setAttribute('aria-hidden','true');photo.textContent=initials(player.name);
 if(player.nhlId){
  const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';
  const team=String(player.nhlTeam||'NHL').toUpperCase();
  const seasons=imageSeasons(season),sources=[...seasons.map(year=>`https://assets.nhle.com/mugs/nhl/${year}/${team}/${player.nhlId}.png`),`https://assets.nhle.com/mugs/nhl/${seasons.at(-1)}/NHL/${player.nhlId}.png`];
  let source=0;image.onload=()=>{photo.childNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)node.remove()})};image.onerror=()=>{source++;if(source<sources.length)image.src=sources[source];else image.remove()};photo.append(image);image.src=sources[0];
 }
 const name=document.createElement('button');name.type='button';name.className='home-leader-name bhl-player-inline-link';name.dataset.bhlPlayerId=player.id;name.dataset.bhlPlayerName=player.name;name.setAttribute('aria-label','Ouvrir la fiche de '+player.name);name.title='Ouvrir la fiche de '+player.name;name.textContent=player.name;
 const info=document.createElement('div');info.className='home-leader-person';info.append(photo,name);
 const points=document.createElement('span');points.className='home-leader-points';points.innerHTML='<strong>'+number(player.fpts)+'</strong><small>FPTS</small>';
 row.append(place,info,points);return row;
}
async function load(){
 const status=document.getElementById('home-leaders-status'),grid=document.getElementById('home-leaders-grid');
 try{
  const response=await fetch('data/home-top-scorers.json',{cache:'no-cache'});if(!response.ok)throw Error('Classements indisponibles');
  const data=await response.json();document.getElementById('home-leaders-season').textContent='Saison régulière '+seasonLabel(data.season)+' · FPTS produits pendant les présences dans les alignements BHL · données provisoires';
  for(const [key,title] of groups){
   const card=document.createElement('section');card.className='home-leader-card';card.setAttribute('aria-labelledby','home-leader-'+key);
   const heading=document.createElement('h3');heading.id='home-leader-'+key;heading.textContent=title;
   const list=document.createElement('ol');list.className='home-leader-list';
   (data.leaders?.[key]||[]).forEach((player,index)=>list.append(renderPlayer(player,index+1,data.season)));
   if(!list.children.length){const empty=document.createElement('li');empty.className='home-leader-empty';empty.textContent='Aucune donnée disponible.';list.append(empty)}
   card.append(heading,list);grid.append(card);
  }
  grid.hidden=false;status.hidden=true;
 }catch(error){status.textContent='Les classements FPTS ne sont pas disponibles pour le moment.';console.warn(error)}
}
load();
