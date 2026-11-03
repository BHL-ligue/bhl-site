// Render a deliberately small subset of rich article content, creating fresh DOM
// nodes. No event attributes, embeds, raw HTML, scripts or unsafe URLs survive.
const allowed=new Set(['P','BR','H2','H3','STRONG','B','EM','I','U','S','BLOCKQUOTE','UL','OL','LI','A','SPAN']);
const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','TEMPLATE','IMG','VIDEO','AUDIO']);
export function safeLink(value){try{const u=new URL(String(value).trim());return ['https:','http:','mailto:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function richFragment(html){const parsed=new DOMParser().parseFromString(String(html),'text/html');const out=document.createDocumentFragment();
 function copy(source,parent){for(const child of source.childNodes){if(child.nodeType===3){parent.append(document.createTextNode(child.textContent));continue;}if(child.nodeType!==1||blocked.has(child.tagName))continue;
 if(!allowed.has(child.tagName)){copy(child,parent);continue;}
 const el=document.createElement(child.tagName.toLowerCase());
 if(child.tagName==='A'){const href=safeLink(child.getAttribute('href'));if(href){el.href=href;el.rel='noopener noreferrer';el.target='_blank';}}
 // The CSSOM parses values before this allowlist, rejecting invalid CSS syntax.
 for(const prop of ['color','backgroundColor']){const value=child.style[prop];if(/^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i.test(value)&&value.length<60)el.style[prop]=value;}
 const align=child.style.textAlign||[...child.classList].find(c=>/^ql-align-(center|right|justify)$/.test(c))?.slice(9);if(['left','center','right','justify'].includes(align))el.style.textAlign=align;
 copy(child,el);parent.append(el);
 }}copy(parsed.body,out);return out;}
export function cleanHTML(html){const holder=document.createElement('div');holder.append(richFragment(html));return holder.innerHTML;}
export function renderBody(target,body,format='plain'){target.classList.add('bhl-article-body');if(format==='html'){target.replaceChildren(richFragment(body));return;}target.replaceChildren(...String(body).split(/\n\s*\n/).map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));}
