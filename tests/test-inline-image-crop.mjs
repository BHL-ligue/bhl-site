import assert from 'node:assert/strict';
import {cropGeometry} from '../bhl-news-crop.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
const g=cropGeometry(1600,900,960,540);close(g.left,0);close(g.top,0);close(g.width,960);close(g.height,540);
const square=cropGeometry(1600,900,960,960);close(square.top,0);close(square.height,960);assert.ok(square.left<0);
for(const [sw,sh] of [[1600,900],[900,1600],[1200,1200]])for(const [w,h] of [[960,540],[960,960]])for(const zoom of [1,2,4])for(const [x,y] of [[0,0],[99999,-99999],[-99999,99999]]){
 const p=cropGeometry(sw,sh,w,h,zoom,x,y);assert.ok(p.left<=1e-7&&p.top<=1e-7);assert.ok(p.left+p.width>=w-1e-7&&p.top+p.height>=h-1e-7);
 const scale=1600/w,exported=cropGeometry(sw,sh,w*scale,h*scale,zoom,p.x*scale,p.y*scale);close(exported.left,p.left*scale);close(exported.top,p.top*scale);close(exported.width,p.width*scale);close(exported.height,p.height*scale);
}
console.log('Crop bounds and preview/export agreement passed for square, landscape, portrait and zoomed images.');
