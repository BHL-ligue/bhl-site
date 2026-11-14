import {attachBanners,registerBanners} from './bhl-news-banners.js?v=1';
import {registerArticleImages,attachInlineImages} from './bhl-news-inline-images.js?v=team-banners1';
import {cleanHTML,richFragment,ARTICLE_COLORS} from './bhl-news-format.js?v=team-banners1';
export async function attachEditor(textarea,onChange,options={}){
 let preservedHTML=null;
 const fallback={set(body,format='plain'){preservedHTML=format==='html'&&/data-bhl-(image|banner)=/.test(String(body))?cleanHTML(body):null;textarea.readOnly=!!preservedHTML;if(format==='html'){const holder=document.createElement('div');holder.append(richFragment(body));textarea.value=[...holder.children].map(el=>el.textContent).join('\n\n');}else textarea.value=body||'';},value(){return preservedHTML?{body:preservedHTML,body_format:'html'}:{body:textarea.value.trim(),body_format:'plain'};},enable(v){textarea.disabled=!v;},valid(){return textarea.reportValidity();}};
 let Quill;try{({default:Quill}=await import('https://esm.sh/quill@2.0.3'));}catch{const note=document.createElement('p');note.className='muted';note.textContent='La barre d’édition ne s’est pas chargée. Actualise la page pour conserver toute la mise en forme. Si tu enregistres maintenant, le contenu sera enregistré en texte simple. Les articles contenant des photos restent en lecture seule pour préserver leurs images.';textarea.after(note);return fallback;}
 const Color=Quill.import('attributors/style/color');Color.whitelist=ARTICLE_COLORS;Quill.register(Color,true);
 registerArticleImages(Quill);
 const bannerMatcher=registerBanners(Quill);
 const container=document.createElement('div');container.id='bodyRich';textarea.after(container);
 const editor=new Quill(container,{theme:'snow',placeholder:'Raconte ta nouvelle…',formats:['header','bold','italic','underline','strike','blockquote','list','align','color','link','articleImage','articleBanner'],modules:{toolbar:{container:[[{header:[2,3,false]}],['bold','italic','underline','strike'],[{list:'bullet'},{list:'ordered'}],['blockquote','link'],['image','cropImage'],[{align:[]},{color:ARTICLE_COLORS}],['clean']],handlers:{image(){},cropImage(){}}},history:{userOnly:true}}});
 const toolbar=editor.getModule('toolbar').container;toolbar.classList.add('bhl-rich-toolbar');toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Mise en forme de l’article');
 const names={bold:'Gras',italic:'Italique',underline:'Souligner',strike:'Barrer',blockquote:'Citation',link:'Insérer un lien',image:'Insérer une photo',cropImage:'Recadrer la photo sélectionnée',clean:'Retirer la mise en forme',header:'Style du paragraphe',align:'Alignement',color:'Couleur du texte'};
 for(const button of toolbar.querySelectorAll('button')){const key=[...button.classList].find(c=>c.startsWith('ql-'))?.slice(3);const name=key==='list'?(button.value==='bullet'?'Liste à puces':'Liste numérotée'):names[key]||key;button.type='button';button.title=name;button.setAttribute('aria-label',name);}
 for(const [key,name] of Object.entries(names)){const picker=toolbar.querySelector('.ql-picker.ql-'+key+' .ql-picker-label');if(picker){picker.setAttribute('aria-label',name);picker.title=name;}}
 for(const option of toolbar.querySelectorAll('.ql-color .ql-picker-item')){const label=({'#191919':'Noir','#626b75':'Gris BHL','#cc0000':'Rouge BHL'})[option.dataset.value];if(label){option.title=label;option.setAttribute('aria-label',label);}}
 const cropButton=toolbar.querySelector('.ql-cropImage');if(cropButton){cropButton.textContent='Recadrer';cropButton.style.width='auto';}
 attachInlineImages(editor,Quill,toolbar,{...options,onChange});
 editor.clipboard.addMatcher('IMG',(image,delta)=>bannerMatcher(image)||delta);
 attachBanners(editor,toolbar);
 editor.root.setAttribute('role','textbox');editor.root.setAttribute('aria-label','Article complet');editor.root.setAttribute('aria-multiline','true');
 const caption=document.createElement('div');caption.className='bhl-editor-caption';const hint=document.createElement('span');hint.textContent='Sélectionne du texte pour le mettre en forme. Ctrl+B : gras · Ctrl+I : italique.';const counter=document.createElement('span');caption.append(hint,counter);container.after(caption);
 textarea.hidden=true;textarea.required=false;
 function value(){return {body:cleanHTML(editor.getSemanticHTML()).trim(),body_format:'html'};}
 function sync(){textarea.value=value().body;const length=textarea.value.length;counter.textContent=editor.getText().trim().length+' caractères';if(length>20000){counter.textContent+=' · article trop long';counter.classList.add('over-limit');}else counter.classList.remove('over-limit');}
 editor.on('text-change',(delta,old,source)=>{sync();if(source==='user')onChange();});sync();
 return {set(body,format='plain'){if(format==='html')editor.setContents(editor.clipboard.convert({html:cleanHTML(body||'')}),'silent');else editor.setText(body||'','silent');editor.history.clear();sync();},value,enable(v){editor.enable(v);for(const b of toolbar.querySelectorAll('button'))b.disabled=!v;toolbar.hidden=!v;},valid(){const good=editor.getText().trim().length>0&&value().body.length<=20000;if(!good){counter.textContent=editor.getText().trim()?'Article trop long : raccourcis le texte ou simplifie la mise en forme.':'Écris le texte de ton article.';counter.classList.add('over-limit');editor.focus();}return good;}};
}
