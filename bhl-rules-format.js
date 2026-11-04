export const ARTICLE_COLORS=['#191919','#626b75','#cc0000'];
const colorMap=new Map([['rgb(25,25,25)','#191919'],['rgb(98,107,117)','#626b75'],['rgb(204,0,0)','#cc0000'],...ARTICLE_COLORS.map(c=>[c,c])]);
export function articleColor(value){
 const normalized=String(value||'').trim();
 // Only literal colors survive; CSS variables, URLs and other CSS are discarded.
 if(!/^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\))$/i.test(normalized))return null;
 const test=document.createElement('span');test.style.color=normalized;return test.style.color||null;
}
// Render a deliberately small subset of rich article content, creating fresh DOM
// nodes. No event attributes, embeds, raw HTML, scripts or unsafe URLs survive.
const allowed=new Set(['P','BR','H2','H3','STRONG','B','EM','I','U','S','BLOCKQUOTE','UL','OL','LI','A','SPAN','FONT']);
const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','TEMPLATE','IMG','VIDEO','AUDIO']);
export function safeLink(value){try{const u=new URL(String(value).trim());return ['https:','http:','mailto:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function richFragment(html){const parsed=new DOMParser().parseFromString(String(html),'text/html');const out=document.createDocumentFragment();
 function copy(source,parent){for(const child of source.childNodes){if(child.nodeType===3){parent.append(document.createTextNode(child.textContent.replace(/\u00a0/g,' ')));continue;}if(child.nodeType!==1||blocked.has(child.tagName))continue;
 if(!allowed.has(child.tagName)){copy(child,parent);continue;}
 const el=document.createElement(child.tagName==='FONT'?'span':child.tagName.toLowerCase());
 if(child.tagName==='A'){const href=safeLink(child.getAttribute('href'));if(href){el.href=href;el.rel='noopener noreferrer';el.target='_blank';}}
 // The CSSOM parses values before this allowlist, rejecting invalid CSS syntax.
 const color=articleColor(child.style.color||child.getAttribute('color'));if(color)el.style.color=color;
 const weight=child.style.fontWeight;if(/^(bold|[7-9]00)$/.test(weight))el.style.fontWeight='700';else if(/^(normal|400)$/.test(weight))el.style.fontWeight='400';
 const align=child.style.textAlign||[...child.classList].find(c=>/^ql-align-(center|right|justify)$/.test(c))?.slice(9);if(['left','center','right','justify'].includes(align))el.style.textAlign=align;
 copy(child,el);parent.append(el);
 }}copy(parsed.body,out);return out;}
export function cleanHTML(html){const holder=document.createElement('div');holder.append(richFragment(html));return holder.innerHTML;}
export function renderBody(target,body,format='plain'){target.classList.add('bhl-article-body');if(format==='html'){target.replaceChildren(richFragment(body));return;}const p=document.createElement('p');p.textContent=String(body);target.replaceChildren(p);}
