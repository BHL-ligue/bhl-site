import {db} from './bhl-news-db.js?v=team-banners1';
import {coverURL,validCoverPath} from './bhl-news-images.js?v=inline1';
import {chooseInlineCrop} from './bhl-news-crop.js?v=inline1';
export function registerArticleImages(Quill){
 const BlockEmbed=Quill.import('blots/block/embed');
 class ArticleImage extends BlockEmbed{
  static blotName='articleImage';static tagName='IMG';static className='bhl-inline-image';
  static create(value){const image=super.create();if(validCoverPath(value?.path)){image.dataset.bhlImage=value.path;image.alt=String(value.alt||'Photo de l’article').slice(0,200);image.title='Clique sur la photo puis sur Recadrer pour modifier son cadrage';coverURL(db,value.path).then(url=>image.src=url).catch(()=>{});}return image}
  static value(image){return {path:image.dataset.bhlImage,alt:image.getAttribute('alt')||''}}
 }
 Quill.register(ArticleImage,true);
}
export function attachInlineImages(editor,Quill,toolbar,{onBusy=()=>{},onChange=()=>{}}={}){
 const Delta=Quill.import('delta'),input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.hidden=true;
 const feedback=document.createElement('p');feedback.className='bhl-inline-feedback';feedback.setAttribute('role','status');toolbar.after(input,feedback);
 let range=null,selected=null,busy=false;
 editor.clipboard.addMatcher('IMG',image=>validCoverPath(image.dataset.bhlImage)?new Delta().insert({articleImage:{path:image.dataset.bhlImage,alt:image.getAttribute('alt')||''}}):new Delta());
 editor.root.addEventListener('click',event=>{const image=event.target.closest('img[data-bhl-image]');editor.root.querySelectorAll('.bhl-inline-selected').forEach(el=>el.classList.remove('bhl-inline-selected'));selected=image||null;if(selected)selected.classList.add('bhl-inline-selected')});
 const tools=editor.getModule('toolbar');
 tools.addHandler('image',()=>{if(busy||!editor.isEnabled())return;range=editor.getSelection(true)||{index:Math.max(0,editor.getLength()-1),length:0};input.click()});
 tools.addHandler('cropImage',async()=>{if(busy||!editor.isEnabled())return;if(!selected?.isConnected){feedback.textContent='Clique d’abord sur la photo à recadrer dans le texte.';return}await addImage(async()=>{const response=await fetch(await coverURL(db,selected.dataset.bhlImage));if(!response.ok)throw new Error('Impossible de charger la photo.');return new File([await response.blob()],'photo.webp',{type:'image/webp'})},selected)});
 input.onchange=()=>{const file=input.files?.[0];if(file)addImage(()=>file)};
 async function addImage(getFile,replacing=null){
  if(busy)return;
  if(!replacing&&editor.root.querySelectorAll('img[data-bhl-image]').length>=20){feedback.textContent='Maximum de 20 photos par article.';input.value='';return}
  busy=true;onBusy(true);feedback.textContent='Ouverture du cadrage…';
  try{
   const {data,error:authError}=await db.auth.getUser();if(authError||!data.user)throw new Error('Connecte-toi avant d’ajouter une photo.');
   const file=await getFile(),result=await chooseInlineCrop(file,{alt:replacing?.alt||''});if(!result){feedback.textContent='Insertion annulée.';return}
   feedback.textContent='Envoi de la photo recadrée…';const path=data.user.id+'/'+crypto.randomUUID()+'.webp';
   const {error}=await db.storage.from('bhl-news-images').upload(path,result.blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'});if(error)throw error;
   onBusy(false);editor.history.cutoff();
   let index=range?.index??Math.max(0,editor.getLength()-1);
   if(replacing?.isConnected){const blot=Quill.find(replacing);index=editor.getIndex(blot);editor.deleteText(index,1,'user')}
   editor.insertEmbed(index,'articleImage',{path,alt:result.alt||'Photo de l’article'},'user');
   if(!replacing)editor.insertText(index+1,'\n','user');
   editor.setSelection(index+2,0,'silent');selected=null;onChange();feedback.textContent='Photo insérée. Enregistre ton article pour conserver les modifications.';
  }catch(error){feedback.textContent='Photo non ajoutée : '+error.message}
  finally{busy=false;input.value='';onBusy(false)}
 }
}
