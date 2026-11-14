const bundledBanners=[{"type": "file", "path": "logos/anaheimbanner.png"}, {"type": "file", "path": "logos/atlantabanner.png"}, {"type": "file", "path": "logos/bostonbanner.png"}, {"type": "file", "path": "logos/californiebanner.png"}, {"type": "file", "path": "logos/chicagobanner.png"}, {"type": "file", "path": "logos/coloradobanner.png"}, {"type": "file", "path": "logos/detroitbanner.png"}, {"type": "file", "path": "logos/floridabanner.png"}, {"type": "file", "path": "logos/hartfordbanner.png"}, {"type": "file", "path": "logos/minnesotabanner.png"}, {"type": "file", "path": "logos/montrealbanner.png"}, {"type": "file", "path": "logos/nashvillebanner.png"}, {"type": "file", "path": "logos/newyorkbanner.png"}, {"type": "file", "path": "logos/ottawabanner.png"}, {"type": "file", "path": "logos/quebecbanner.png"}, {"type": "file", "path": "logos/torontobanner.png"}];
export function validBannerPath(path){return /^logos\/[a-z0-9_-]+banner\.(png|jpe?g|webp)$/i.test(String(path||''));}
export function bannerLabel(path){const city=path.split('/').pop().replace(/banner\.[^.]+$/i,'');const names={montreal:'Montréal',newyork:'New York',quebec:'Québec',detroit:'Détroit',florida:'Floride',californie:'Californie',california:'Californie'};return names[city.toLowerCase()]||city.charAt(0).toUpperCase()+city.slice(1);}
export function attachBanners(editor,toolbar){
 const button=document.createElement('button');button.type='button';button.className='bhl-banner-tool';button.textContent='Bannière';button.title='Insérer une bannière d’équipe';button.setAttribute('aria-label',button.title);toolbar.append(button);
 const dialog=document.createElement('dialog');dialog.className='bhl-banner-dialog';
 const title=document.createElement('h2');title.textContent='Insérer une bannière d’équipe';
 const note=document.createElement('p');note.textContent='Choisis une bannière pour l’insérer à la position du curseur.';
 const close=document.createElement('button');close.type='button';close.textContent='Fermer';close.className='secondary';
 const status=document.createElement('p');status.setAttribute('role','status');
 const grid=document.createElement('div');grid.className='bhl-banner-grid';dialog.append(title,note,status,grid,close);document.body.append(dialog);close.onclick=()=>dialog.close();
 let range=null,loaded=false;
 button.onclick=async()=>{
  if(!editor.isEnabled())return;range=editor.getSelection(true)||{index:editor.getLength()-1,length:0};dialog.showModal();if(loaded)return;
  status.textContent='Chargement des bannières…';
  try{let catalog=bundledBanners;try{const response=await fetch('https://api.github.com/repos/BHL-ligue/bhl-site/contents/logos',{headers:{Accept:'application/vnd.github+json'}});if(response.ok){const latest=await response.json();if(Array.isArray(latest))catalog=latest;}}catch{}
   const files=catalog.filter(f=>f.type==='file'&&validBannerPath(f.path)).sort((a,b)=>bannerLabel(a.path).localeCompare(bannerLabel(b.path),'fr'));
   grid.replaceChildren();
   for(const file of files){const choice=document.createElement('button');choice.type='button';choice.className='bhl-banner-choice';const image=document.createElement('img');image.src=file.path;image.alt='Bannière '+bannerLabel(file.path);image.loading='lazy';const label=document.createElement('span');label.textContent=bannerLabel(file.path);choice.append(image,label);grid.append(choice);
    choice.onclick=()=>{if(!editor.isEnabled())return;const index=Math.min(range.index,editor.getLength()-1);editor.history.cutoff();editor.insertEmbed(index,'articleBanner',{path:file.path,alt:image.alt},'user');editor.insertText(index+1,'\n','user');editor.setSelection(index+2,0,'silent');dialog.close();editor.focus();};
   }
   status.textContent=files.length?'':'Aucune bannière disponible. Ajoute les fichiers villebanner.png, .jpg ou .webp au dossier logos du dépôt, puis rouvre ce menu.';loaded=files.length>0;
  }catch(error){status.textContent=error.message;}
 };
}
export function registerBanners(Quill){
 const BlockEmbed=Quill.import('blots/block/embed'),Delta=Quill.import('delta');
 class ArticleBanner extends BlockEmbed{
  static blotName='articleBanner';static tagName='IMG';static className='bhl-team-banner';
  static create(value){const image=super.create();if(validBannerPath(value?.path)){image.dataset.bhlBanner=value.path;image.src=value.path;image.alt=String(value.alt||'Bannière d’équipe').slice(0,200);}return image;}
  static value(image){return {path:image.dataset.bhlBanner,alt:image.alt};}
 }
 Quill.register(ArticleBanner,true);
 return image=>validBannerPath(image.dataset.bhlBanner)?new Delta().insert({articleBanner:{path:image.dataset.bhlBanner,alt:image.alt}}):null;
}
